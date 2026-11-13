'use strict';
/**
 * GET /.netlify/functions/proxy-image?url=<image url>
 * Downloads a public image and serves it from our own origin so the browser
 * can draw it on a canvas and export the finished card without CORS errors.
 */

const { HttpError, safeGet, errorResponse, checkOrigin } = require('./safe');

// Netlify limits a function response to 6 MB, and base64 adds ~33 %.
const MAX_BYTES = 4 * 1024 * 1024;
const ALLOWED = /^image\/(jpeg|jpg|png|webp|gif|avif|bmp)$/i;

exports.handler = async (event) => {
  try {
    if (event.httpMethod !== 'GET') throw new HttpError(405, 'শুধু GET চলবে');
    checkOrigin(event);
    const target = (event.queryStringParameters || {}).url;
    const res = await safeGet(target, {
      maxBytes: MAX_BYTES,
      truncate: false,
      accept: 'image/avif,image/webp,image/jpeg,image/png,*/*;q=0.5',
      timeoutMs: 8000,
    });
    if (res.status >= 400) throw new HttpError(502, 'ছবিটি আনা যায়নি');

    const type = String(res.headers['content-type'] || '').split(';')[0].trim().toLowerCase();
    if (!ALLOWED.test(type)) throw new HttpError(415, 'ছবির ধরন সমর্থিত নয়');

    return {
      statusCode: 200,
      headers: {
        'Content-Type': type,
        'Cache-Control': 'public, max-age=3600',
        'X-Content-Type-Options': 'nosniff',
        'Content-Security-Policy': "default-src 'none'; sandbox",
      },
      body: res.body.toString('base64'),
      isBase64Encoded: true,
    };
  } catch (e) {
    return errorResponse(e);
  }
};
