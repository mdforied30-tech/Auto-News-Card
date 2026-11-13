'use strict';
/**
 * Shared helpers for the Netlify Functions.
 *
 * The two "fetch something from the internet" functions (fetch-news and
 * proxy-image) take a URL from an anonymous visitor, so they must never be
 * usable to reach private/internal addresses (SSRF). Protection lives here:
 *   1. only http/https, no credentials in the URL, no obvious internal hostnames
 *   2. IP-literal hosts are checked directly
 *   3. hostnames are resolved by a custom `lookup` that is used for the real
 *      connection itself, so a DNS-rebinding trick cannot swap the address
 *      between "check" and "connect"
 *   4. redirects are followed manually and every hop goes through 1-3 again
 *   5. response size and total time are capped
 */

const http = require('node:http');
const https = require('node:https');
const dns = require('node:dns');
const net = require('node:net');
const zlib = require('node:zlib');

class HttpError extends Error {
  constructor(status, publicMessage) {
    super(publicMessage);
    this.status = status;
    this.publicMessage = publicMessage;
  }
}

/* ---------- IP checks ---------- */

function isPrivateIPv4(ip) {
  const p = ip.split('.').map(Number);
  if (p.length !== 4 || p.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return true;
  const [a, b, c] = p;
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) || // carrier-grade NAT
    (a === 169 && b === 254) || // link-local / cloud metadata
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 0 && c === 0) ||
    (a === 192 && b === 0 && c === 2) ||
    (a === 192 && b === 168) ||
    (a === 198 && (b === 18 || b === 19)) ||
    (a === 198 && b === 51 && c === 100) ||
    (a === 203 && b === 0 && c === 113) ||
    a >= 224 // multicast, reserved, broadcast
  );
}

function isPrivateIPv6(ip) {
  const v = ip.toLowerCase();
  if (v === '::' || v === '::1') return true;
  if (v.startsWith('::ffff:')) {
    const tail = v.slice(7);
    return net.isIPv4(tail) ? isPrivateIPv4(tail) : true; // hex form: be conservative
  }
  if (/^f[cd]/.test(v)) return true; // unique local fc00::/7
  if (/^fe[89ab]/.test(v)) return true; // link-local fe80::/10
  if (v.startsWith('ff')) return true; // multicast
  if (v.startsWith('64:ff9b:')) return true; // NAT64 (could wrap a private v4)
  return false;
}

function isPrivateIp(ip) {
  if (net.isIPv4(ip)) return isPrivateIPv4(ip);
  if (net.isIPv6(ip)) return isPrivateIPv6(ip);
  return true;
}

/* ---------- URL checks ---------- */

function parsePublicUrl(raw) {
  if (typeof raw !== 'string' || !raw.trim() || raw.length > 2048) {
    throw new HttpError(400, 'লিংকটি সঠিক নয়');
  }
  let u;
  try {
    u = new URL(raw.trim());
  } catch {
    throw new HttpError(400, 'লিংকটি সঠিক নয়');
  }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') {
    throw new HttpError(400, 'শুধু http বা https লিংক চলবে');
  }
  if (u.username || u.password) throw new HttpError(400, 'লিংকটি সঠিক নয়');
  const host = u.hostname.replace(/^\[|\]$/g, '').toLowerCase();
  if (
    !host ||
    host === 'localhost' ||
    host.endsWith('.localhost') ||
    host.endsWith('.local') ||
    host.endsWith('.internal') ||
    host.endsWith('.lan') ||
    (!host.includes('.') && !net.isIP(host))
  ) {
    throw new HttpError(400, 'এই ঠিকানায় অনুমতি নেই');
  }
  if (net.isIP(host) && isPrivateIp(host)) {
    throw new HttpError(400, 'এই ঠিকানায় অনুমতি নেই');
  }
  return u;
}

/** Used as the real connection lookup, so the checked address is the connected address. */
function guardedLookup(hostname, options, callback) {
  if (typeof options === 'function') {
    callback = options;
    options = {};
  }
  dns.lookup(hostname, { ...options, all: true }, (err, addrs) => {
    if (err) return callback(err);
    if (!addrs || !addrs.length || addrs.some((a) => isPrivateIp(a.address))) {
      return callback(new HttpError(400, 'এই ঠিকানায় অনুমতি নেই'));
    }
    if (options && options.all) return callback(null, addrs);
    return callback(null, addrs[0].address, addrs[0].family);
  });
}

/* ---------- HTTP GET with limits ---------- */

const UA = 'Mozilla/5.0 (compatible; AutoNewsCardBot/1.0; +https://autonewscard.netlify.app)';

function requestOnce(u, { maxBytes, truncate, accept, timeoutMs }) {
  return new Promise((resolve, reject) => {
    const lib = u.protocol === 'https:' ? https : http;
    let settled = false;
    const done = (err, val) => {
      if (settled) return;
      settled = true;
      clearTimeout(deadline);
      if (err) reject(err);
      else resolve(val);
    };

    const req = lib.request(
      {
        protocol: u.protocol,
        hostname: u.hostname.replace(/^\[|\]$/g, ''),
        port: u.port || undefined,
        path: u.pathname + u.search,
        method: 'GET',
        lookup: guardedLookup,
        timeout: timeoutMs,
        headers: {
          'User-Agent': UA,
          Accept: accept || '*/*',
          'Accept-Language': 'bn,en;q=0.8',
          'Accept-Encoding': 'gzip, deflate, br',
        },
      },
      (res) => {
        const status = res.statusCode || 0;
        // Redirects: hand back to the caller, which re-validates the new URL.
        if (status >= 300 && status < 400 && res.headers.location) {
          res.resume();
          return done(null, { status, headers: res.headers, redirect: res.headers.location });
        }

        const declared = Number(res.headers['content-length']);
        if (!truncate && declared && declared > maxBytes) {
          res.resume();
          req.destroy();
          return done(new HttpError(413, 'ফাইলটি অনেক বড়'));
        }

        let stream = res;
        const enc = String(res.headers['content-encoding'] || '').toLowerCase();
        if (enc === 'gzip' || enc === 'x-gzip') stream = res.pipe(zlib.createGunzip());
        else if (enc === 'deflate') stream = res.pipe(zlib.createInflate());
        else if (enc === 'br') stream = res.pipe(zlib.createBrotliDecompress());

        const chunks = [];
        let size = 0;
        stream.on('data', (chunk) => {
          if (settled) return;
          size += chunk.length;
          if (size > maxBytes) {
            if (truncate) {
              chunks.push(chunk.subarray(0, chunk.length - (size - maxBytes)));
              done(null, { status, headers: res.headers, body: Buffer.concat(chunks) });
            } else {
              done(new HttpError(413, 'ফাইলটি অনেক বড়'));
            }
            req.destroy();
            return;
          }
          chunks.push(chunk);
        });
        stream.on('end', () => done(null, { status, headers: res.headers, body: Buffer.concat(chunks) }));
        stream.on('error', () => done(new HttpError(502, 'সাইট থেকে তথ্য পড়া যায়নি')));
      }
    );

    const deadline = setTimeout(() => {
      req.destroy();
      done(new HttpError(504, 'সাইট থেকে সাড়া পেতে দেরি হচ্ছে'));
    }, timeoutMs + 1500);

    req.on('timeout', () => {
      req.destroy();
      done(new HttpError(504, 'সাইট থেকে সাড়া পেতে দেরি হচ্ছে'));
    });
    req.on('error', (e) => {
      if (e instanceof HttpError) return done(e);
      done(new HttpError(502, 'সাইটটি খোলা যায়নি'));
    });
    req.end();
  });
}

/**
 * GET a public URL. Follows up to 4 redirects, re-validating each hop.
 * Resolves { status, headers, body, finalUrl }.
 */
async function safeGet(rawUrl, opts = {}) {
  const options = {
    maxBytes: opts.maxBytes || 1024 * 1024,
    truncate: !!opts.truncate,
    accept: opts.accept,
    timeoutMs: opts.timeoutMs || 7000,
  };
  // Netlify's free plan stops a function after 10 s, so keep the whole chain inside ~8.5 s.
  const started = Date.now();
  let url = parsePublicUrl(rawUrl);
  for (let hop = 0; hop <= 4; hop++) {
    const left = 8500 - (Date.now() - started);
    if (left < 1200) throw new HttpError(504, 'সাইট থেকে সাড়া পেতে দেরি হচ্ছে');
    const res = await requestOnce(url, { ...options, timeoutMs: Math.min(options.timeoutMs, left - 1000) });
    if (res.redirect) {
      let next;
      try {
        next = new URL(res.redirect, url);
      } catch {
        throw new HttpError(502, 'সাইটটি খোলা যায়নি');
      }
      url = parsePublicUrl(next.toString());
      continue;
    }
    return { ...res, finalUrl: url.toString() };
  }
  throw new HttpError(502, 'সাইটটি অনেকবার রিডাইরেক্ট করছে');
}

/* ---------- response + request helpers ---------- */

function json(status, data, extraHeaders) {
  return {
    statusCode: status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      ...(extraHeaders || {}),
    },
    body: JSON.stringify(data),
  };
}

function errorResponse(e) {
  if (e instanceof HttpError) return json(e.status, { error: e.publicMessage });
  console.error('Unhandled function error:', e && e.message ? e.message : e);
  return json(500, { error: 'কিছু একটা সমস্যা হয়েছে, আবার চেষ্টা করুন' });
}

/**
 * Optional protection against other websites using your functions.
 * Set ALLOWED_HOSTS (comma separated, e.g. "autonewscard.netlify.app,www.mysite.com")
 * in Netlify environment variables to turn it on. When it is not set, all hosts are allowed.
 */
function checkOrigin(event) {
  const list = (process.env.ALLOWED_HOSTS || '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  if (!list.length) return;
  const h = event.headers || {};
  const src = h.origin || h.referer || h.Origin || h.Referer || '';
  let host = '';
  try {
    host = new URL(src).host.toLowerCase();
  } catch {
    /* no usable origin */
  }
  if (!host || !list.includes(host)) throw new HttpError(403, 'এই সাইট থেকে অনুমতি নেই');
}

module.exports = {
  HttpError,
  isPrivateIp,
  guardedLookup,
  parsePublicUrl,
  safeGet,
  json,
  errorResponse,
  checkOrigin,
};

// This file sits next to the real functions, so Netlify also publishes it as a function.
// It is only a shared helper, so if someone calls it directly just answer "not found".
module.exports.handler = async () => ({ statusCode: 404, headers: { 'Content-Type': 'text/plain; charset=utf-8' }, body: 'Not found' });
