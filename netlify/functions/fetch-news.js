'use strict';
/**
 * GET /.netlify/functions/fetch-news?url=<news page url>
 * Reads a public news page and returns { title, siteName, description, images[], published, url }.
 */

const { HttpError, safeGet, json, errorResponse, checkOrigin } = require('./safe');

/* ---------- small HTML helpers (no dependencies) ---------- */

const NAMED = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', ndash: '–', mdash: '—', hellip: '…', lsquo: '‘', rsquo: '’', ldquo: '“', rdquo: '”' };

function decodeEntities(s) {
  return String(s || '')
    .replace(/&#x([0-9a-f]+);/gi, (m, h) => safeCodePoint(parseInt(h, 16), m))
    .replace(/&#(\d+);/g, (m, d) => safeCodePoint(parseInt(d, 10), m))
    .replace(/&([a-z]+);/gi, (m, n) => (NAMED[n.toLowerCase()] !== undefined ? NAMED[n.toLowerCase()] : m));
}

function safeCodePoint(cp, fallback) {
  try {
    return cp > 0 && cp <= 0x10ffff ? String.fromCodePoint(cp) : fallback;
  } catch {
    return fallback;
  }
}

function clean(s, max) {
  const t = decodeEntities(s).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  return max && t.length > max ? t.slice(0, max).trim() : t;
}

function decodeBody(buf, contentType) {
  let charset = (/charset=([\w-]+)/i.exec(contentType || '') || [])[1];
  if (!charset) {
    const head = buf.subarray(0, 4096).toString('latin1');
    charset = (/<meta[^>]+charset=["']?([\w-]+)/i.exec(head) || [])[1];
  }
  try {
    return new TextDecoder((charset || 'utf-8').toLowerCase()).decode(buf);
  } catch {
    return new TextDecoder('utf-8').decode(buf);
  }
}

function parseAttrs(tag) {
  const attrs = {};
  const re = /([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+))/g;
  let m;
  while ((m = re.exec(tag))) attrs[m[1].toLowerCase()] = m[2] !== undefined ? m[2] : m[3] !== undefined ? m[3] : m[4];
  return attrs;
}

function absoluteHttp(raw, base) {
  if (!raw) return null;
  try {
    const u = new URL(decodeEntities(raw).trim(), base);
    return u.protocol === 'http:' || u.protocol === 'https:' ? u.toString() : null;
  } catch {
    return null;
  }
}

/* ---------- main extraction ---------- */

function extractMeta(html, pageUrl) {
  const meta = {};
  const links = [];
  const metaRe = /<meta\b[^>]*>/gi;
  let m;
  while ((m = metaRe.exec(html))) {
    const a = parseAttrs(m[0]);
    const key = (a.property || a.name || a.itemprop || '').toLowerCase();
    if (key && a.content !== undefined && !(key in meta)) meta[key] = a.content;
  }
  const linkRe = /<link\b[^>]*>/gi;
  while ((m = linkRe.exec(html))) links.push(parseAttrs(m[0]));

  const host = (() => {
    try {
      return new URL(pageUrl).hostname.replace(/^www\./, '');
    } catch {
      return '';
    }
  })();

  const siteName = clean(meta['og:site_name'] || meta['application-name'] || host, 80);

  const titleTag = (/<title[^>]*>([\s\S]*?)<\/title>/i.exec(html) || [])[1];
  const h1 = (/<h1[^>]*>([\s\S]*?)<\/h1>/i.exec(html) || [])[1];
  let title = clean(meta['og:title'] || meta['twitter:title'] || titleTag || h1 || '', 300);
  // Remove a trailing " | Site name" / " - Site name"
  if (siteName && title.length > siteName.length + 6) {
    const esc = siteName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    title = title.replace(new RegExp('\\s*[|\\-–—:]\\s*' + esc + '\\s*$', 'i'), '').trim() || title;
  }

  const description = clean(meta['og:description'] || meta['twitter:description'] || meta['description'] || '', 600);

  const candidates = [
    meta['og:image:secure_url'],
    meta['og:image'],
    meta['og:image:url'],
    meta['twitter:image'],
    meta['twitter:image:src'],
    (links.find((l) => (l.rel || '').toLowerCase() === 'image_src') || {}).href,
  ];

  // A few in-article pictures as extra options.
  const imgRe = /<img\b[^>]*>/gi;
  let seen = 0;
  while ((m = imgRe.exec(html)) && seen < 40) {
    seen++;
    const a = parseAttrs(m[0]);
    const src = a['data-src'] || a['data-original'] || a.src;
    if (!src || /^data:/i.test(src)) continue;
    if (/(logo|icon|avatar|sprite|banner|ads?[-_/]|pixel|tracking|placeholder)/i.test(src)) continue;
    const w = parseInt(a.width, 10);
    if (w && w < 300) continue;
    candidates.push(src);
  }

  const images = [];
  for (const c of candidates) {
    const abs = absoluteHttp(c, pageUrl);
    if (abs && !images.includes(abs)) images.push(abs);
    if (images.length >= 4) break;
  }

  return {
    title,
    siteName,
    description,
    images,
    published: clean(meta['article:published_time'] || meta['og:updated_time'] || '', 40),
    url: pageUrl,
  };
}

/* ---------- handler ---------- */

exports.handler = async (event) => {
  try {
    if (event.httpMethod !== 'GET') throw new HttpError(405, 'শুধু GET চলবে');
    checkOrigin(event);
    const target = (event.queryStringParameters || {}).url;
    const res = await safeGet(target, {
      maxBytes: 900 * 1024,
      truncate: true, // meta tags live near the top; a partial page is enough
      accept: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.5',
    });
    if (res.status >= 400) {
      throw new HttpError(502, 'এই লিংক থেকে খবর আনা যায়নি (সাইটটি অ্যাক্সেস ব্লক করতে পারে)');
    }
    const type = String(res.headers['content-type'] || '').toLowerCase();
    if (type && !/html|xml/.test(type)) throw new HttpError(415, 'এটি কোনো খবরের পেজ নয়');

    const data = extractMeta(decodeBody(res.body, type), res.finalUrl);
    if (!data.title && !data.images.length) {
      throw new HttpError(422, 'এই পেজ থেকে শিরোনাম বা ছবি পাওয়া যায়নি');
    }
    return json(200, data);
  } catch (e) {
    return errorResponse(e);
  }
};

exports.extractMeta = extractMeta; // exported for tests
