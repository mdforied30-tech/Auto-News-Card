/* Low-level canvas helpers: fonts, colours, images, Bengali text layout. No UI code here. */

/* ---------- fonts ---------- */

export const FONTS = {
  hind: { label: 'হিন্দ সিলিগুড়ি', family: 'Hind Siliguri', weight: 700 },
  noto: { label: 'নোটো সান্স', family: 'Noto Sans Bengali', weight: 800 },
  anek: { label: 'আনেক বাংলা', family: 'Anek Bangla', weight: 800 },
  baloo: { label: 'বালু দা', family: 'Baloo Da 2', weight: 800 },
  mina: { label: 'মীনা', family: 'Mina', weight: 700 },
  atma: { label: 'আত্মা (গোলগাল)', family: 'Atma', weight: 700 },
  tiro: { label: 'টিরো (সেরিফ)', family: 'Tiro Bangla', weight: 400 },
  notoserif: { label: 'নোটো সেরিফ', family: 'Noto Serif Bengali', weight: 800 },
  galada: { label: 'গলদা (হাতের লেখা)', family: 'Galada', weight: 400 },
};

/** Fonts that use a lighter weight for small text (subtitle, date, footer). */
export const BODY_FONT = 'hind';

const FALLBACK = '"Hind Siliguri","Noto Sans Bengali","Kalpurush","Nirmala UI","Vrinda","Lohit Bengali",sans-serif';

export function fontStack(key) {
  const f = FONTS[key] || FONTS.hind;
  return `"${f.family}",${FALLBACK}`;
}

/* ---------- colours ---------- */

export function hexToRgb(hex) {
  let h = String(hex || '').replace('#', '').trim();
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  if (!/^[0-9a-f]{6}$/i.test(h)) return [0, 0, 0];
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

export function rgba(hex, a) {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r},${g},${b},${a})`;
}

/** amt > 0 mixes toward white, amt < 0 toward black (-1..1). */
export function shade(hex, amt) {
  const [r, g, b] = hexToRgb(hex);
  const t = amt < 0 ? 0 : 255;
  const p = Math.abs(amt);
  const m = (c) => Math.round(c + (t - c) * p);
  return `rgb(${m(r)},${m(g)},${m(b)})`;
}

export function luminance(hex) {
  const [r, g, b] = hexToRgb(hex);
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
}

export function onColor(hex) {
  return luminance(hex) > 0.6 ? '#111827' : '#ffffff';
}

/* ---------- shapes ---------- */

export function rr(ctx, x, y, w, h, r) {
  r = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export function vGradient(ctx, x, y, w, h, stops) {
  const g = ctx.createLinearGradient(0, y, 0, y + h);
  stops.forEach(([o, col]) => g.addColorStop(o, col));
  ctx.fillStyle = g;
  ctx.fillRect(x, y, w, h);
}

/* ---------- images ---------- */

export function imgSize(img) {
  return [img.naturalWidth || img.width, img.naturalHeight || img.height];
}

/** Fill the box with the image (like CSS object-fit: cover). fx/fy = focus 0..1, zoom >= 1. */
export function drawCover(ctx, img, x, y, w, h, fx = 0.5, fy = 0.5, zoom = 1) {
  const [iw, ih] = imgSize(img);
  if (!iw || !ih) return;
  const s = Math.max(w / iw, h / ih) * Math.max(1, zoom);
  const dw = iw * s;
  const dh = ih * s;
  const dx = x - (dw - w) * fx;
  const dy = y - (dh - h) * fy;
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, dx, dy, dw, dh);
  ctx.restore();
}

/* (drawCover is also used by app.js for the small photo thumbnails) */

/** Fit the whole image inside the box (like object-fit: contain). Returns drawn rect. */
export function drawContain(ctx, img, x, y, w, h, align = 'center') {
  const [iw, ih] = imgSize(img);
  if (!iw || !ih) return { x, y, w: 0, h: 0 };
  const s = Math.min(w / iw, h / ih);
  const dw = iw * s;
  const dh = ih * s;
  let dx = x + (w - dw) / 2;
  if (align === 'left') dx = x;
  if (align === 'right') dx = x + w - dw;
  const dy = y + (h - dh) / 2;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, dx, dy, dw, dh);
  return { x: dx, y: dy, w: dw, h: dh };
}

const grayCache = new WeakMap();

/** Returns a black-and-white copy of an image (cached). Falls back to the original on failure. */
export function grayCanvas(img) {
  if (grayCache.has(img)) return grayCache.get(img);
  let out = img;
  try {
    const [iw, ih] = imgSize(img);
    const s = Math.min(1, 1400 / Math.max(iw, ih));
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(iw * s));
    c.height = Math.max(1, Math.round(ih * s));
    const cx = c.getContext('2d');
    cx.drawImage(img, 0, 0, c.width, c.height);
    const data = cx.getImageData(0, 0, c.width, c.height);
    const d = data.data;
    for (let i = 0; i < d.length; i += 4) {
      const g = d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114;
      d[i] = d[i + 1] = d[i + 2] = g;
    }
    cx.putImageData(data, 0, 0);
    out = c;
  } catch {
    out = img;
  }
  grayCache.set(img, out);
  return out;
}

/* ---------- rich text (*word* => highlighted) ---------- */

/** Text -> list of words; each word is a list of segments { t, hl }. { br: true } marks a line break. */
export function parseRich(text) {
  const items = [];
  let segs = [];
  let buf = '';
  let hl = false;
  const flushBuf = () => {
    if (buf) {
      segs.push({ t: buf, hl });
      buf = '';
    }
  };
  const flushWord = () => {
    flushBuf();
    if (segs.length) {
      items.push({ segs });
      segs = [];
    }
  };
  for (const ch of String(text || '').replace(/\r/g, '')) {
    if (ch === '*') {
      flushBuf();
      hl = !hl;
    } else if (ch === '\n') {
      flushWord();
      items.push({ br: true });
    } else if (/\s/.test(ch)) {
      flushWord();
    } else {
      buf += ch;
    }
  }
  flushWord();
  return items;
}

export function stripRich(text) {
  return String(text || '').replace(/\*/g, '');
}

function measureItems(ctx, items) {
  return items.map((it) => (it.br ? it : { segs: it.segs, w: it.segs.reduce((a, s) => a + ctx.measureText(s.t).width, 0) }));
}

/** Word-wrap using the font that is currently set on ctx. */
export function wrapItems(ctx, items, maxW) {
  const space = ctx.measureText(' ').width;
  const words = measureItems(ctx, items);
  const lines = [];
  let cur = { words: [], width: 0 };
  const push = () => {
    if (cur.words.length) lines.push(cur);
    cur = { words: [], width: 0 };
  };
  for (const w of words) {
    if (w.br) {
      push();
      continue;
    }
    if (cur.words.length && cur.width + space + w.w > maxW) push();
    cur.width += (cur.words.length ? space : 0) + w.w;
    cur.words.push(w);
  }
  push();
  return { lines, space };
}

function ellipsize(ctx, line, maxW, space) {
  const dots = { segs: [{ t: '…', hl: false }], w: ctx.measureText('…').width };
  while (line.words.length > 1 && line.width + space + dots.w > maxW) {
    const w = line.words.pop();
    line.width -= w.w + space;
  }
  line.words.push(dots);
  line.width += space + dots.w;
}

/**
 * Find the largest font size (<= o.size) at which the text fits.
 * o: { fontKey, weight?, maxW, maxH, maxLines, size, minSize, lh }
 */
export function fitText(ctx, text, o) {
  const items = parseRich(text);
  const family = fontStack(o.fontKey);
  const weight = o.weight || (FONTS[o.fontKey] || FONTS.hind).weight;
  const lhf = o.lh || 1.3;
  const min = Math.max(10, Math.round(o.minSize || 24));
  const build = (size) => {
    const font = `${weight} ${size}px ${family}`;
    ctx.font = font;
    const { lines, space } = wrapItems(ctx, items, o.maxW);
    return { size, font, lines, space, lineH: size * lhf };
  };

  let size = Math.max(min, Math.round(o.size));
  let r = build(size);
  while (size > min) {
    const fits = r.lines.length <= o.maxLines && r.lines.length * r.lineH <= o.maxH && r.lines.every((l) => l.width <= o.maxW + 1);
    if (fits) break;
    size = Math.max(min, size - 2);
    r = build(size);
  }

  // Still too big at the minimum size: cut it off with an ellipsis instead of overflowing.
  const maxByHeight = Math.max(1, Math.floor(o.maxH / r.lineH));
  const limit = Math.min(o.maxLines, maxByHeight);
  if (r.lines.length > limit) {
    r.lines = r.lines.slice(0, limit);
    ellipsize(ctx, r.lines[limit - 1], o.maxW, r.space);
  }
  r.height = r.lines.length * r.lineH;
  return r;
}

/** Draw a layout produced by fitText. y = top of the first line box. */
export function drawLines(ctx, fit, x, y, maxW, o = {}) {
  ctx.save();
  ctx.font = fit.font;
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left';
  if (o.shadow) {
    ctx.shadowColor = 'rgba(0,0,0,0.55)';
    ctx.shadowBlur = o.shadow;
    ctx.shadowOffsetY = o.shadow * 0.3;
  }
  fit.lines.forEach((line, i) => {
    let cx = x;
    if (o.align === 'center') cx = x + (maxW - line.width) / 2;
    else if (o.align === 'right') cx = x + maxW - line.width;
    const by = y + i * fit.lineH + fit.lineH * 0.74;
    for (const w of line.words) {
      for (const s of w.segs) {
        ctx.fillStyle = s.hl ? o.hl || o.color : o.color;
        ctx.fillText(s.t, cx, by);
        cx += ctx.measureText(s.t).width;
      }
      cx += fit.space;
    }
  });
  ctx.restore();
}

/* ---------- single-line text, pills ---------- */

export function setFont(ctx, fontKey, size, weight) {
  const f = FONTS[fontKey] || FONTS.hind;
  ctx.font = `${weight || f.weight} ${size}px ${fontStack(fontKey)}`;
}

/** Shrinks the size until the text fits maxW. Returns { size, width }. */
export function fitOneLine(ctx, text, { fontKey = 'hind', weight, size, minSize = 14, maxW }) {
  let s = size;
  setFont(ctx, fontKey, s, weight);
  let width = ctx.measureText(text).width;
  while (maxW && width > maxW && s > minSize) {
    s -= 1;
    setFont(ctx, fontKey, s, weight);
    width = ctx.measureText(text).width;
  }
  return { size: s, width };
}

/** Draw one line of text. y is the vertical centre. */
export function drawOneLine(ctx, text, x, y, o) {
  const { size } = fitOneLine(ctx, text, o);
  ctx.save();
  setFont(ctx, o.fontKey || 'hind', size, o.weight);
  ctx.textBaseline = 'middle';
  ctx.textAlign = o.align || 'left';
  ctx.fillStyle = o.color || '#fff';
  if (o.shadow) {
    ctx.shadowColor = 'rgba(0,0,0,0.5)';
    ctx.shadowBlur = o.shadow;
  }
  ctx.fillText(text, x, y + size * 0.06);
  ctx.restore();
}

/** Rounded label. (x, y) is the top-left, or top-right / top-centre depending on align. */
export function drawPill(ctx, text, x, y, o) {
  const padX = o.padX == null ? o.h * 0.4 : o.padX;
  const fit = fitOneLine(ctx, text, { fontKey: o.fontKey || 'hind', weight: o.weight || 700, size: o.size, minSize: 12, maxW: (o.maxW || 1e9) - padX * 2 });
  const w = fit.width + padX * 2;
  let px = x;
  if (o.align === 'right') px = x - w;
  else if (o.align === 'center') px = x - w / 2;
  ctx.save();
  if (o.bg) {
    ctx.fillStyle = o.bg;
    rr(ctx, px, y, w, o.h, o.radius == null ? o.h / 2 : o.radius);
    ctx.fill();
  }
  setFont(ctx, o.fontKey || 'hind', fit.size, o.weight || 700);
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  ctx.fillStyle = o.color || '#fff';
  ctx.fillText(text, px + padX, y + o.h / 2 + fit.size * 0.06);
  ctx.restore();
  return { x: px, y, w, h: o.h };
}
