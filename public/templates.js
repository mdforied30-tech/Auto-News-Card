/* The card designs. Each template is draw(ctx, c) where c comes from render.js:
   c.W, c.H        canvas size in px          c.u   layout unit (min side / 1080)
   c.state         text + options             c.brand  { name, website, primary, accent }
   c.photo / c.logo   canvases or null        c.P / c.A  primary / highlight colours
   c.headline      text to show               c.font   font key to use for headlines
   c.size(base)    font size for a base size at 1080 px, with the user's size slider applied */

import {
  rr, vGradient, rgba, shade, luminance, onColor,
  drawCover, drawContain, grayCanvas, imgSize,
  fitText, drawLines, fitOneLine, drawOneLine, drawPill,
} from './draw.js';

/* ---------- shared building blocks ---------- */

function photoBg(ctx, c, x, y, w, h) {
  const { photo, state, P } = c;
  if (photo) {
    drawCover(ctx, photo, x, y, w, h, state.focusX, state.focusY, state.zoom);
    return;
  }
  const g = ctx.createLinearGradient(x, y, x + w, y + h);
  g.addColorStop(0, shade(P, -0.2));
  g.addColorStop(1, shade(P, -0.7));
  ctx.fillStyle = g;
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = 'rgba(255,255,255,0.06)';
  ctx.beginPath();
  ctx.arc(x + w * 0.82, y + h * 0.22, Math.min(w, h) * 0.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(x + w * 0.12, y + h * 0.78, Math.min(w, h) * 0.2, 0, Math.PI * 2);
  ctx.fill();
}

/** White badge with the channel logo (or the channel name when there is no logo). */
function logoBadge(ctx, c, x, y, h, o = {}) {
  const { brand, logo, P } = c;
  if (!logo && !brand.name) return { x, y, w: 0, h: 0 };
  const pad = h * 0.16;
  let w;
  let textFit = null;
  if (logo) {
    const [iw, ih] = imgSize(logo);
    w = Math.min(h * 3.4, Math.max(h, (h - pad * 2) * (iw / ih) + pad * 2));
  } else {
    textFit = fitOneLine(ctx, brand.name, { fontKey: 'hind', weight: 700, size: h * 0.42, minSize: 14, maxW: c.W * 0.5 });
    w = textFit.width + h * 0.6;
  }
  let bx = x;
  if (o.align === 'right') bx = x - w;
  else if (o.align === 'center') bx = x - w / 2;
  ctx.save();
  if (o.shadow !== false) {
    ctx.shadowColor = 'rgba(0,0,0,0.28)';
    ctx.shadowBlur = h * 0.25;
    ctx.shadowOffsetY = h * 0.06;
  }
  ctx.fillStyle = o.bg || '#ffffff';
  rr(ctx, bx, y, w, h, o.radius == null ? h * 0.26 : o.radius);
  ctx.fill();
  ctx.restore();
  if (logo) drawContain(ctx, logo, bx + pad, y + pad, w - pad * 2, h - pad * 2);
  else drawOneLine(ctx, brand.name, bx + w / 2, y + h / 2, { fontKey: 'hind', weight: 700, size: textFit.size, color: P, align: 'center' });
  return { x: bx, y, w, h };
}

/** Website on the left, date on the right (or both centred). */
function footerRow(ctx, c, y, h, color, o = {}) {
  const { W, u, k, state, site } = c;
  const m = o.m == null ? 56 * u : o.m;
  const size = 30 * u * k;
  const cy = y + h / 2;
  if (o.center) {
    const txt = [site, state.date].filter(Boolean).join('   •   ');
    if (txt) drawOneLine(ctx, txt, W / 2, cy, { fontKey: 'hind', weight: 600, size, color, align: 'center', maxW: W - 2 * m });
    return;
  }
  if (site) drawOneLine(ctx, site, m, cy, { fontKey: 'hind', weight: 600, size, color, align: 'left', maxW: (W - 2 * m) * 0.62 });
  if (state.date) drawOneLine(ctx, state.date, W - m, cy, { fontKey: 'hind', weight: 600, size, color, align: 'right', maxW: (W - 2 * m) * 0.38 });
}

function subFit(ctx, c, maxW, base, maxLines = 2) {
  if (!c.state.subtitle) return null;
  const size = c.size(base);
  return fitText(ctx, c.state.subtitle, { fontKey: 'hind', weight: 500, maxW, maxH: size * 1.35 * maxLines, maxLines, size, minSize: 18 * c.u, lh: 1.35 });
}

const hasFooterText = (c) => !!(c.site || c.state.date);

/* ---------- 1. Breaking news ---------- */

function drawBreaking(ctx, c) {
  const { W, H, u, state, A } = c;
  const m = 56 * u;
  photoBg(ctx, c, 0, 0, W, H);
  vGradient(ctx, 0, 0, W, 240 * u, [[0, 'rgba(0,0,0,0.6)'], [1, 'rgba(0,0,0,0)']]);
  vGradient(ctx, 0, H * 0.28, W, H * 0.72, [[0, 'rgba(0,0,0,0)'], [0.5, 'rgba(0,0,0,0.7)'], [1, 'rgba(0,0,0,0.94)']]);

  const topH = 76 * u;
  drawPill(ctx, state.category || 'ব্রেকিং নিউজ', m, m, { h: topH, bg: '#dc2626', color: '#fff', size: 38 * u, radius: 12 * u, padX: 28 * u, maxW: W * 0.55 });
  logoBadge(ctx, c, W - m, m, topH, { align: 'right' });

  const footerH = hasFooterText(c) ? 92 * u : 30 * u;
  const bottom = H - footerH;
  const maxW = W - 2 * m;
  const sub = subFit(ctx, c, maxW, 36, 2);
  const subH = sub ? sub.height + 18 * u : 0;
  const barH = 10 * u;
  const barGap = 26 * u;
  const topLimit = m + topH + 36 * u;
  const fit = fitText(ctx, c.headline, {
    fontKey: c.font, maxW, maxH: bottom - subH - barH - barGap - topLimit, maxLines: 7, size: c.size(88), minSize: 30 * u, lh: 1.28,
  });
  const y = bottom - subH - fit.height;
  ctx.fillStyle = A;
  ctx.fillRect(m, y - barGap - barH, 150 * u, barH);
  drawLines(ctx, fit, m, y, maxW, { color: '#fff', hl: A, shadow: 14 * u });
  if (sub) drawLines(ctx, sub, m, y + fit.height + 18 * u, maxW, { color: 'rgba(255,255,255,0.88)', hl: '#fff' });
  if (hasFooterText(c)) {
    ctx.fillStyle = 'rgba(255,255,255,0.28)';
    ctx.fillRect(m, bottom + 4 * u, W - 2 * m, 2 * u);
    footerRow(ctx, c, bottom + 6 * u, footerH - 6 * u, 'rgba(255,255,255,0.9)');
  }
}

/* ---------- 2. TV channel style ---------- */

function drawTv(ctx, c) {
  const { W, H, u, state, P, A } = c;
  const m = 52 * u;
  const wide = W / H > 1.5;
  const panelY = Math.round(H * (wide ? 0.58 : 0.6));
  const tickerH = 84 * u;

  ctx.fillStyle = shade(P, -0.6);
  ctx.fillRect(0, 0, W, H);
  photoBg(ctx, c, 0, 0, W, panelY);

  const g = ctx.createLinearGradient(0, panelY, W, H);
  g.addColorStop(0, shade(P, -0.1));
  g.addColorStop(1, shade(P, -0.5));
  ctx.fillStyle = g;
  ctx.fillRect(0, panelY, W, H - panelY - tickerH);
  ctx.fillStyle = A;
  ctx.fillRect(0, panelY, W, 8 * u);

  const lbH = 96 * u;
  logoBadge(ctx, c, m, panelY - lbH * 0.5, lbH);
  drawPill(ctx, state.category || 'সর্বশেষ', W - m, panelY - 34 * u, { h: 68 * u, bg: A, color: onColor(A), size: 34 * u, align: 'right', radius: 10 * u, maxW: W * 0.4 });

  const top = panelY + lbH * 0.5 + 22 * u;
  const bottom = H - tickerH - 22 * u;
  const maxW = W - 2 * m;
  const sub = subFit(ctx, c, maxW, 32, 2);
  const subH = sub ? sub.height + 14 * u : 0;
  const fit = fitText(ctx, c.headline, { fontKey: c.font, maxW, maxH: bottom - top - subH, maxLines: 5, size: c.size(78), minSize: 26 * u, lh: 1.28 });
  const y = top + Math.max(0, (bottom - top - fit.height - subH) / 2);
  drawLines(ctx, fit, m, y, maxW, { color: '#fff', hl: A });
  if (sub) drawLines(ctx, sub, m, y + fit.height + 14 * u, maxW, { color: 'rgba(255,255,255,0.85)', hl: '#fff' });

  ctx.fillStyle = shade(P, -0.78);
  ctx.fillRect(0, H - tickerH, W, tickerH);
  ctx.fillStyle = A;
  ctx.fillRect(0, H - tickerH, 16 * u, tickerH);
  footerRow(ctx, c, H - tickerH, tickerH, 'rgba(255,255,255,0.92)', { m: 44 * u });
}

/* ---------- 3. Newspaper style ---------- */

function framedPhoto(ctx, c, x, y, w, h) {
  ctx.fillStyle = '#16130e';
  ctx.fillRect(x, y, w, h);
  const b = 5 * c.u;
  drawCover(ctx, c.photo, x + b, y + b, w - 2 * b, h - 2 * b, c.state.focusX, c.state.focusY, c.state.zoom);
}

function drawPaper(ctx, c) {
  const { W, H, u, k, state, brand, logo, photo } = c;
  const paper = '#f5f0e4';
  const ink = '#16130e';
  const grey = '#6b6457';
  const m = 54 * u;
  const wide = W / H > 1.5;
  ctx.fillStyle = paper;
  ctx.fillRect(0, 0, W, H);

  let y = m;
  const mastH = logo || brand.name ? 118 * u : 0;
  if (mastH) {
    if (logo) drawContain(ctx, logo, m, y, W - 2 * m, mastH);
    else drawOneLine(ctx, brand.name, W / 2, y + mastH / 2, { fontKey: 'tiro', weight: 400, size: 86 * u, color: ink, align: 'center', maxW: W - 2 * m });
    y += mastH + 16 * u;
  }
  ctx.fillStyle = ink;
  ctx.fillRect(m, y, W - 2 * m, 7 * u);
  ctx.fillRect(m, y + 15 * u, W - 2 * m, 2 * u);
  y += 30 * u;

  const metaH = 50 * u;
  if (state.date) drawOneLine(ctx, state.date, m, y + metaH / 2, { fontKey: 'hind', weight: 600, size: 28 * u * k, color: grey, align: 'left', maxW: (W - 2 * m) * 0.5 });
  if (state.category) drawOneLine(ctx, state.category, W - m, y + metaH / 2, { fontKey: 'hind', weight: 700, size: 28 * u * k, color: c.hlLight, align: 'right', maxW: (W - 2 * m) * 0.5 });
  y += metaH;
  ctx.fillStyle = 'rgba(22,19,14,0.35)';
  ctx.fillRect(m, y, W - 2 * m, 2 * u);
  y += 22 * u;

  const footerH = c.site ? 56 * u : 0;
  const bottom = H - m - footerH;
  const area = bottom - y;

  let tx = m;
  let tw = W - 2 * m;
  let ty = y;
  let tArea = area;
  if (photo) {
    if (wide) {
      const pw = (W - 2 * m) * 0.46;
      framedPhoto(ctx, c, m, y, pw, area);
      tx = m + pw + 34 * u;
      tw = W - m - tx;
    } else {
      const ph = area * 0.5;
      framedPhoto(ctx, c, m, y, W - 2 * m, ph);
      ty = y + ph + 28 * u;
      tArea = bottom - ty;
    }
  }
  const sub = subFit(ctx, c, tw, 34, 3);
  const subH = sub ? sub.height + 16 * u : 0;
  const fit = fitText(ctx, c.headline, { fontKey: c.font, maxW: tw, maxH: tArea - subH, maxLines: 8, size: c.size(photo && !wide ? 70 : 84), minSize: 26 * u, lh: 1.3 });
  drawLines(ctx, fit, tx, ty, tw, { color: ink, hl: c.hlLight });
  if (sub) drawLines(ctx, sub, tx, ty + fit.height + 16 * u, tw, { color: grey, hl: ink });

  if (footerH) {
    ctx.fillStyle = 'rgba(22,19,14,0.35)';
    ctx.fillRect(m, bottom + 10 * u, W - 2 * m, 2 * u);
    drawOneLine(ctx, c.site, W / 2, bottom + 10 * u + footerH / 2, { fontKey: 'hind', weight: 600, size: 26 * u * k, color: grey, align: 'center', maxW: W - 2 * m });
  }
}

/* ---------- 4. Online portal (centre logo, white headline card) ---------- */

function drawPortal(ctx, c) {
  const { W, H, u, state, P, A } = c;
  const m = 50 * u;
  photoBg(ctx, c, 0, 0, W, H);
  vGradient(ctx, 0, 0, W, 280 * u, [[0, 'rgba(0,0,0,0.55)'], [1, 'rgba(0,0,0,0)']]);
  vGradient(ctx, 0, H * 0.45, W, H * 0.55, [[0, 'rgba(0,0,0,0)'], [1, 'rgba(0,0,0,0.78)']]);
  logoBadge(ctx, c, W / 2, m, 100 * u, { align: 'center' });

  const footerH = hasFooterText(c) ? 78 * u : 36 * u;
  const cardBottom = H - footerH;
  const cardX = m;
  const cardW = W - 2 * m;
  const pad = 38 * u;
  const strip = 16 * u;
  const innerX = cardX + strip + pad;
  const innerW = cardW - strip - pad * 2;
  const sub = subFit(ctx, c, innerW, 32, 2);
  const subH = sub ? sub.height + 12 * u : 0;
  const fit = fitText(ctx, c.headline, {
    fontKey: c.font, maxW: innerW, maxH: H * 0.55 - pad * 2 - subH, maxLines: 6, size: c.size(72), minSize: 26 * u, lh: 1.3,
  });
  const cardH = fit.height + subH + pad * 2;
  const cardY = cardBottom - cardH;

  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.35)';
  ctx.shadowBlur = 30 * u;
  ctx.shadowOffsetY = 10 * u;
  ctx.fillStyle = '#fff';
  rr(ctx, cardX, cardY, cardW, cardH, 26 * u);
  ctx.fill();
  ctx.restore();
  ctx.save();
  rr(ctx, cardX, cardY, cardW, cardH, 26 * u);
  ctx.clip();
  ctx.fillStyle = A;
  ctx.fillRect(cardX, cardY, strip, cardH);
  ctx.restore();

  drawLines(ctx, fit, innerX, cardY + pad, innerW, { color: '#0f172a', hl: c.hlLight });
  if (sub) drawLines(ctx, sub, innerX, cardY + pad + fit.height + 12 * u, innerW, { color: '#475569', hl: '#0f172a' });
  if (state.category) drawPill(ctx, state.category, innerX, cardY - 32 * u, { h: 60 * u, bg: P, color: onColor(P), size: 30 * u, radius: 12 * u, maxW: W * 0.6 });
  if (hasFooterText(c)) footerRow(ctx, c, cardBottom, footerH, 'rgba(255,255,255,0.92)', { center: true });
}

/* ---------- 5. Sports ---------- */

function drawSports(ctx, c) {
  const { W, H, u, state, P, A } = c;
  const m = 54 * u;
  photoBg(ctx, c, 0, 0, W, H);
  vGradient(ctx, 0, 0, W, 240 * u, [[0, 'rgba(0,0,0,0.5)'], [1, 'rgba(0,0,0,0)']]);

  const yL = H * 0.6;
  const yR = H * 0.5;
  const yAt = (x) => yL + (yR - yL) * (x / W);

  ctx.fillStyle = A;
  ctx.beginPath();
  ctx.moveTo(0, yL - 16 * u);
  ctx.lineTo(W, yR - 16 * u);
  ctx.lineTo(W, yR);
  ctx.lineTo(0, yL);
  ctx.closePath();
  ctx.fill();

  const g = ctx.createLinearGradient(0, yR, 0, H);
  g.addColorStop(0, shade(P, -0.15));
  g.addColorStop(1, shade(P, -0.6));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(0, yL);
  ctx.lineTo(W, yR);
  ctx.lineTo(W, H);
  ctx.lineTo(0, H);
  ctx.closePath();
  ctx.fill();

  logoBadge(ctx, c, m, m, 84 * u);
  drawPill(ctx, state.category || 'খেলার খবর', m, yAt(m + 400 * u) - 16 * u - 70 * u, { h: 62 * u, bg: A, color: onColor(A), size: 32 * u, radius: 10 * u, maxW: W * 0.5 });

  const footerH = hasFooterText(c) ? 80 * u : 30 * u;
  const top = yL + 30 * u;
  const bottom = H - footerH;
  const maxW = W - 2 * m;
  const sub = subFit(ctx, c, maxW, 32, 2);
  const subH = sub ? sub.height + 12 * u : 0;
  const fit = fitText(ctx, c.headline, { fontKey: c.font, maxW, maxH: bottom - top - subH, maxLines: 5, size: c.size(76), minSize: 26 * u, lh: 1.26 });
  drawLines(ctx, fit, m, top, maxW, { color: '#fff', hl: A });
  if (sub) drawLines(ctx, sub, m, top + fit.height + 12 * u, maxW, { color: 'rgba(255,255,255,0.85)', hl: '#fff' });
  if (hasFooterText(c)) footerRow(ctx, c, bottom, footerH, 'rgba(255,255,255,0.9)');
}

/* ---------- 6. Quote card (subtitle = speaker's designation, "speaker" = name) ---------- */

function drawQuote(ctx, c) {
  const { W, H, u, state, P, A, photo } = c;
  const m = 64 * u;
  const g = ctx.createLinearGradient(0, 0, W, H);
  g.addColorStop(0, shade(P, -0.1));
  g.addColorStop(1, shade(P, -0.65));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = 'rgba(255,255,255,0.05)';
  ctx.beginPath();
  ctx.arc(W * 0.88, H * 0.12, Math.min(W, H) * 0.38, 0, Math.PI * 2);
  ctx.fill();

  ctx.save();
  ctx.fillStyle = rgba(A, 0.95);
  ctx.font = `700 ${300 * u}px Georgia, "Times New Roman", serif`;
  ctx.textBaseline = 'alphabetic';
  ctx.fillText('“', m - 6 * u, m + 230 * u);
  ctx.restore();
  logoBadge(ctx, c, W - m, m, 84 * u, { align: 'right' });

  const hasSpeaker = !!state.speaker;
  const spkH = hasSpeaker ? (photo ? 170 * u : 110 * u) : 0;
  const footerH = hasFooterText(c) ? 70 * u : 0;
  const top = m + 190 * u;
  const bottom = H - m - footerH - spkH - (hasSpeaker ? 30 * u : 0);
  const maxW = W - 2 * m;
  const fit = fitText(ctx, c.headline, { fontKey: c.font, maxW, maxH: bottom - top, maxLines: 9, size: c.size(70), minSize: 26 * u, lh: 1.34 });
  drawLines(ctx, fit, m, top, maxW, { color: '#fff', hl: A });

  if (hasSpeaker) {
    const y0 = H - m - footerH - spkH;
    let tx = m;
    if (photo) {
      const d = 150 * u;
      const cx = m + d / 2;
      const cy = y0 + spkH / 2;
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, d / 2, 0, Math.PI * 2);
      ctx.clip();
      drawCover(ctx, photo, cx - d / 2, cy - d / 2, d, d, state.focusX, state.focusY, state.zoom);
      ctx.restore();
      ctx.strokeStyle = A;
      ctx.lineWidth = 6 * u;
      ctx.beginPath();
      ctx.arc(cx, cy, d / 2 + 3 * u, 0, Math.PI * 2);
      ctx.stroke();
      tx = m + d + 32 * u;
    } else {
      ctx.fillStyle = A;
      ctx.fillRect(m, y0 + spkH / 2 - 38 * u, 8 * u, 76 * u);
      tx = m + 32 * u;
    }
    const tw = W - m - tx;
    const cy = y0 + spkH / 2;
    drawOneLine(ctx, state.speaker, tx, state.subtitle ? cy - 22 * u : cy, { fontKey: c.font, weight: 700, size: 46 * u, color: '#fff', align: 'left', maxW: tw });
    if (state.subtitle) drawOneLine(ctx, state.subtitle, tx, cy + 26 * u, { fontKey: 'hind', weight: 500, size: 30 * u, color: 'rgba(255,255,255,0.72)', align: 'left', maxW: tw });
  }
  if (footerH) footerRow(ctx, c, H - m - footerH + 10 * u, footerH, 'rgba(255,255,255,0.7)', { m });
}

/* ---------- 7. Mourning ---------- */

function drawMourning(ctx, c) {
  const { W, H, u, k, state, photo, A } = c;
  const m = 60 * u;
  ctx.fillStyle = '#08080a';
  ctx.fillRect(0, 0, W, H);
  const rg = ctx.createRadialGradient(W / 2, H * 0.35, 0, W / 2, H * 0.35, Math.max(W, H) * 0.7);
  rg.addColorStop(0, '#26262b');
  rg.addColorStop(1, '#08080a');
  ctx.fillStyle = rg;
  ctx.fillRect(0, 0, W, H);

  ctx.fillStyle = '#000';
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(250 * u, 0);
  ctx.lineTo(0, 250 * u);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.55)';
  ctx.lineWidth = 3 * u;
  ctx.beginPath();
  ctx.moveTo(250 * u, 0);
  ctx.lineTo(0, 250 * u);
  ctx.stroke();

  let y = m;
  const label = state.category || 'শোক সংবাদ';
  const lf = fitOneLine(ctx, label, { fontKey: 'hind', weight: 700, size: 44 * u * Math.min(k, 1.1), maxW: W * 0.5 });
  const ly = y + 30 * u;
  drawOneLine(ctx, label, W / 2, ly, { fontKey: 'hind', weight: 700, size: lf.size, color: '#e5e7eb', align: 'center' });
  const lineW = Math.min(170 * u, (W / 2 - lf.width / 2 - m - 24 * u) * 0.9);
  if (lineW > 20) {
    ctx.fillStyle = 'rgba(255,255,255,0.45)';
    ctx.fillRect(W / 2 - lf.width / 2 - 24 * u - lineW, ly - u, lineW, 2 * u);
    ctx.fillRect(W / 2 + lf.width / 2 + 24 * u, ly - u, lineW, 2 * u);
  }
  y += 88 * u;

  const hasLogo = !!(c.logo || c.brand.name);
  const logoH = 78 * u;
  const bottom = H - m - (hasLogo ? logoH + 24 * u : 0);

  if (photo) {
    const r = W / H > 1.5 ? H * 0.19 : Math.min(W * 0.26, H * 0.19);
    const cx = W / 2;
    const cy = y + r + 8 * u;
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.clip();
    drawCover(ctx, grayCanvas(photo), cx - r, cy - r, r * 2, r * 2, state.focusX, state.focusY, state.zoom);
    ctx.restore();
    ctx.strokeStyle = '#f3f4f6';
    ctx.lineWidth = 8 * u;
    ctx.beginPath();
    ctx.arc(cx, cy, r + 4 * u, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.lineWidth = 2 * u;
    ctx.beginPath();
    ctx.arc(cx, cy, r + 22 * u, 0, Math.PI * 2);
    ctx.stroke();
    y = cy + r + 22 * u + 34 * u;
  }

  const maxW = W - 2 * m;
  const sub = subFit(ctx, c, maxW, 34, 2);
  const subH = sub ? sub.height + 14 * u : 0;
  const dateH = state.date ? 46 * u : 0;
  const fit = fitText(ctx, c.headline, { fontKey: c.font, maxW, maxH: bottom - y - subH - dateH, maxLines: 6, size: c.size(photo ? 64 : 82), minSize: 26 * u, lh: 1.3 });
  const block = fit.height + subH + dateH;
  const by = photo ? y : y + Math.max(0, (bottom - y - block) / 2);
  drawLines(ctx, fit, m, by, maxW, { color: '#fff', hl: A, align: 'center' });
  if (sub) drawLines(ctx, sub, m, by + fit.height + 14 * u, maxW, { color: 'rgba(255,255,255,0.72)', hl: '#fff', align: 'center' });
  if (state.date) drawOneLine(ctx, state.date, W / 2, by + fit.height + subH + dateH / 2 + 4 * u, { fontKey: 'hind', weight: 500, size: 28 * u * k, color: 'rgba(255,255,255,0.55)', align: 'center' });

  if (hasLogo) logoBadge(ctx, c, W / 2, H - m - logoH, logoH, { align: 'center' });
  else if (c.site) footerRow(ctx, c, H - m - 50 * u, 50 * u, 'rgba(255,255,255,0.6)', { center: true });
}

/* ---------- 8. Text only ---------- */

function drawTextOnly(ctx, c) {
  const { W, H, u, state, P, A } = c;
  const m = 64 * u;
  const g = ctx.createLinearGradient(0, 0, W, H);
  g.addColorStop(0, shade(P, -0.05));
  g.addColorStop(1, shade(P, -0.7));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = 'rgba(255,255,255,0.05)';
  ctx.beginPath();
  ctx.arc(W * 0.9, H * 0.08, Math.min(W, H) * 0.42, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(W * 0.06, H * 0.95, Math.min(W, H) * 0.3, 0, Math.PI * 2);
  ctx.fill();

  const topH = 84 * u;
  logoBadge(ctx, c, m, m, topH);
  if (state.category) drawPill(ctx, state.category, W - m, m + (topH - 62 * u) / 2, { h: 62 * u, bg: A, color: onColor(A), size: 32 * u, align: 'right', radius: 12 * u, maxW: W * 0.5 });

  const footerH = hasFooterText(c) ? 100 * u : 40 * u;
  const top = m + topH + 60 * u;
  const bottom = H - footerH - 20 * u;
  const maxW = W - 2 * m;
  const sub = subFit(ctx, c, maxW, 38, 2);
  const subH = sub ? sub.height + 20 * u : 0;
  const fit = fitText(ctx, c.headline, { fontKey: c.font, maxW, maxH: bottom - top - subH, maxLines: 9, size: c.size(104), minSize: 28 * u, lh: 1.3 });
  const y = top + Math.max(0, (bottom - top - fit.height - subH) / 2);
  ctx.fillStyle = A;
  ctx.fillRect(W / 2 - 60 * u, y - 44 * u, 120 * u, 10 * u);
  drawLines(ctx, fit, m, y, maxW, { color: '#fff', hl: A, align: 'center' });
  if (sub) drawLines(ctx, sub, m, y + fit.height + 20 * u, maxW, { color: 'rgba(255,255,255,0.8)', hl: '#fff', align: 'center' });
  if (hasFooterText(c)) {
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.fillRect(m, H - footerH, W - 2 * m, 2 * u);
    footerRow(ctx, c, H - footerH + 4 * u, footerH - 4 * u, 'rgba(255,255,255,0.85)', { center: true });
  }
}

/* ================= newer designs ================= */

function seeded(seed) {
  let s = seed >>> 0 || 1;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

const isWide = (c) => c.W / c.H > 1.5;
const isStory = (c) => c.H / c.W > 1.5;
/** Photo share of the height for "photo on top, text below" designs. */
const topShare = (c, tall = 0.54) => (isWide(c) ? 0.5 : isStory(c) ? tall - 0.06 : tall);

/** "—— বিস্তারিত কমেন্টে ——" line. cy = vertical centre. */
function ctaRule(ctx, c, cy, color, o = {}) {
  const { u, k } = c;
  const cx = o.cx == null ? c.W / 2 : o.cx;
  const span = o.span || c.W * 0.78;
  const lh = Math.max(1, 2 * u);
  const text = c.cta;
  ctx.save();
  ctx.fillStyle = o.lineColor || color;
  ctx.globalAlpha = o.lineAlpha == null ? 0.55 : o.lineAlpha;
  if (!text) {
    ctx.fillRect(cx - span / 2, cy - lh / 2, span, lh);
    ctx.restore();
    return;
  }
  const f = fitOneLine(ctx, text, { fontKey: 'hind', weight: 600, size: (o.size || 28) * u * k, minSize: 12, maxW: span * 0.6 });
  const half = f.width / 2 + 22 * u;
  ctx.fillRect(cx - span / 2, cy - lh / 2, span / 2 - half, lh);
  ctx.fillRect(cx + half, cy - lh / 2, span / 2 - half, lh);
  ctx.restore();
  drawOneLine(ctx, text, cx, cy, { fontKey: 'hind', weight: 600, size: f.size, color, align: 'center' });
}

/** Thin rule, website on the left and the call-to-action with an arrow on the right (light designs). */
function lightFooter(ctx, c, x, y, w, h, o) {
  const { u, k } = c;
  const size = 28 * u * k;
  if (o.rule !== false) {
    ctx.fillStyle = o.line || 'rgba(0,0,0,0.18)';
    ctx.fillRect(x, y, w, 2 * u);
  }
  const cy = y + h / 2 + u;
  if (c.site) drawOneLine(ctx, c.site, x, cy, { fontKey: 'hind', weight: 600, size, color: o.grey, align: 'left', maxW: w * 0.55 });
  if (c.cta) drawOneLine(ctx, c.cta + ' →', x + w, cy, { fontKey: 'hind', weight: 700, size, color: o.accent, align: 'right', maxW: w * 0.45 });
}

const hasLightFooter = (c) => !!(c.site || c.cta);

/** Logo drawn straight on a light background (no badge); falls back to the channel name. */
function plainLogo(ctx, c, x, y, h, color) {
  if (c.logo) {
    const [iw, ih] = imgSize(c.logo);
    const w = Math.min(h * 4, h * (iw / ih));
    drawContain(ctx, c.logo, x, y, w, h, 'left');
    return w;
  }
  if (c.brand.name) {
    const f = fitOneLine(ctx, c.brand.name, { fontKey: 'hind', weight: 700, size: h * 0.55, minSize: 14, maxW: c.W * 0.45 });
    drawOneLine(ctx, c.brand.name, x, y + h / 2, { fontKey: 'hind', weight: 700, size: f.size, color, align: 'left' });
    return f.width;
  }
  return 0;
}

function dateParts(s) {
  const t = String(s || '').trim().split(/\s+/).filter(Boolean);
  if (t.length && /[0-9০-৯]/.test(t[0])) return { day: t[0].replace(/[^0-9০-৯]/g, ''), rest: t.slice(1).join(' ') };
  return { day: '', rest: String(s || '').trim() };
}

function diamond(ctx, cx, cy, r, color) {
  ctx.save();
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(cx, cy - r);
  ctx.lineTo(cx + r, cy);
  ctx.lineTo(cx, cy + r);
  ctx.lineTo(cx - r, cy);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function silhouette(ctx, cx, cy, r, bg, fg) {
  const g = ctx.createLinearGradient(0, cy - r, 0, cy + r);
  g.addColorStop(0, bg);
  g.addColorStop(1, shade(bg.startsWith('#') ? bg : '#334155', -0.4));
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.clip();
  ctx.fillStyle = g;
  ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
  ctx.fillStyle = fg;
  ctx.beginPath();
  ctx.arc(cx, cy - r * 0.18, r * 0.36, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(cx, cy + r * 0.95, r * 0.78, r * 0.62, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/* ---------- 9-11. centred stack: logo on top, centred headline, rule, website ---------- */

function centerStack(ctx, c, o) {
  const { W, H, u, k, state, A } = c;
  const m = 64 * u;
  if (c.photo) {
    photoBg(ctx, c, 0, 0, W, H);
    if (o.tintAlpha) {
      ctx.fillStyle = rgba(o.tint, o.tintAlpha);
      ctx.fillRect(0, 0, W, H);
    }
  } else {
    const g = ctx.createLinearGradient(0, 0, W * 0.6, H);
    g.addColorStop(0, shade(o.tint, -0.05));
    g.addColorStop(1, shade(o.tint, -0.7));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = 'rgba(255,255,255,0.05)';
    ctx.beginPath();
    ctx.arc(W * 0.85, H * 0.18, Math.min(W, H) * 0.32, 0, Math.PI * 2);
    ctx.fill();
  }
  vGradient(ctx, 0, 0, W, H * 0.28, [[0, 'rgba(0,0,0,0.5)'], [1, 'rgba(0,0,0,0)']]);
  vGradient(ctx, 0, H * 0.34, W, H * 0.66, [[0, rgba(o.dark, 0)], [0.5, rgba(o.dark, 0.8)], [1, rgba(o.dark, 0.97)]]);

  ctx.save();
  ctx.strokeStyle = 'rgba(255,255,255,0.11)';
  ctx.lineWidth = 3 * u;
  for (let i = 0; i < 4; i++) {
    const r = (240 + i * 64) * u;
    ctx.beginPath();
    ctx.arc(0, H, r, -Math.PI / 2, 0);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(W, H, r, Math.PI, Math.PI * 1.5);
    ctx.stroke();
  }
  ctx.restore();

  const badgeH = 84 * u;
  const topY = m * 0.75;
  logoBadge(ctx, c, W / 2, topY, badgeH, { align: 'center' });

  let bottom = H - 50 * u;
  if (c.site) {
    drawOneLine(ctx, c.site, W / 2, bottom - 14 * u, { fontKey: 'hind', weight: 600, size: 28 * u * k, color: 'rgba(255,255,255,0.9)', align: 'center', maxW: W - 2 * m });
    bottom -= 52 * u;
  }
  if (c.cta) {
    ctaRule(ctx, c, bottom - 20 * u, 'rgba(255,255,255,0.85)');
    bottom -= 62 * u;
  }
  const label = state.category || o.label || c.brand.name;
  const pillH = label ? 64 * u : 0;
  const top = topY + badgeH + 30 * u;
  const maxW = W - 2 * m;
  const sub = subFit(ctx, c, maxW, 34, 2);
  const subH = sub ? sub.height + 14 * u : 0;
  const availH = bottom - top - (pillH ? pillH + 24 * u : 0) - subH - 10 * u;
  const fit = fitText(ctx, c.headline, { fontKey: c.font, maxW, maxH: availH, maxLines: 7, size: c.size(80), minSize: 26 * u, lh: 1.3 });
  const hy = bottom - 10 * u - subH - fit.height;
  drawLines(ctx, fit, m, hy, maxW, { color: '#fff', hl: A, align: 'center', shadow: 12 * u });
  if (sub) drawLines(ctx, sub, m, hy + fit.height + 14 * u, maxW, { color: 'rgba(255,255,255,0.85)', hl: '#fff', align: 'center' });
  if (label) {
    const pc = o.pill || A;
    drawPill(ctx, label, W / 2, hy - 24 * u - pillH, { h: pillH, bg: pc, color: onColor(pc), size: 32 * u, align: 'center', radius: 8 * u, padX: 34 * u, maxW: W * 0.7 });
  }
}

const drawCenterLogo = (ctx, c) => centerStack(ctx, c, { tint: c.P, tintAlpha: 0.22, dark: '#04070d', pill: c.A });
const drawRedTint = (ctx, c) => centerStack(ctx, c, { tint: '#b91c1c', tintAlpha: 0.55, dark: '#2a0509', pill: '#dc2626' });
const drawNight = (ctx, c) => centerStack(ctx, c, { tint: '#0b1f5c', tintAlpha: 0.5, dark: '#050b24', pill: c.A });
const drawCenterBreak = (ctx, c) => centerStack(ctx, c, { tint: '#000000', tintAlpha: 0.12, dark: '#070709', pill: '#dc2626', label: 'ব্রেকিং নিউজ' });
const drawCenterSport = (ctx, c) => centerStack(ctx, c, { tint: '#065f46', tintAlpha: 0.45, dark: '#021a12', pill: '#facc15', label: 'খেলার খবর' });
const drawCenterRoyal = (ctx, c) => centerStack(ctx, c, { tint: '#4c1d95', tintAlpha: 0.5, dark: '#0f0524', pill: '#f472b6' });
const drawCenterGreen = (ctx, c) => centerStack(ctx, c, { tint: '#14532d', tintAlpha: 0.5, dark: '#03150a', pill: c.A });

/* ---------- 12. editorial (cream paper, photo fades into the page) ---------- */

function drawEditorial(ctx, c) {
  const { W, H, u, k, state, hlLight } = c;
  const paper = '#fbf6ec';
  const ink = '#17130d';
  const grey = '#6f675a';
  const m = 60 * u;
  ctx.fillStyle = paper;
  ctx.fillRect(0, 0, W, H);
  let tx = m;
  let tw = W - 2 * m;
  let y;
  if (isWide(c)) {
    const pw = W * 0.46;
    photoBg(ctx, c, 0, 0, pw, H);
    tx = pw + m * 0.8;
    tw = W - tx - m;
    y = m;
  } else {
    const ph = H * topShare(c, 0.52);
    photoBg(ctx, c, 0, 0, W, ph);
    vGradient(ctx, 0, ph - ph * 0.32, W, ph * 0.32 + 1, [[0, rgba(paper, 0)], [1, paper]]);
    y = ph + 4 * u;
  }
  logoBadge(ctx, c, m, m * 0.7, 72 * u);
  if (state.category) {
    ctx.fillStyle = hlLight;
    ctx.fillRect(tx, y + 14 * u, 54 * u, 8 * u);
    drawOneLine(ctx, state.category, tx + 70 * u, y + 18 * u, { fontKey: 'hind', weight: 700, size: 32 * u * k, color: hlLight, align: 'left', maxW: tw - 70 * u });
    y += 58 * u;
  }
  const footerH = hasLightFooter(c) ? 70 * u : 0;
  const bottom = H - m;
  const sub = subFit(ctx, c, tw, 32, 2);
  const subH = sub ? sub.height + 14 * u : 0;
  const maxH = bottom - (footerH ? footerH + 16 * u : 0) - y - subH;
  const fit = fitText(ctx, c.headline, { fontKey: c.font, maxW: tw, maxH, maxLines: 7, size: c.size(isWide(c) ? 62 : 74), minSize: 26 * u, lh: 1.3 });
  drawLines(ctx, fit, tx, y, tw, { color: ink, hl: hlLight });
  if (sub) drawLines(ctx, sub, tx, y + fit.height + 14 * u, tw, { color: grey, hl: ink });
  if (footerH) lightFooter(ctx, c, tx, bottom - footerH, tw, footerH, { grey, accent: hlLight });
}

/* ---------- 13. cinema (letterbox bars, gold bar beside the headline) ---------- */

function drawCinema(ctx, c) {
  const { W, H, u, k, state, A } = c;
  const m = 64 * u;
  const bar = Math.round(H * 0.085);
  photoBg(ctx, c, 0, 0, W, H);
  ctx.fillStyle = 'rgba(0,0,0,0.38)';
  ctx.fillRect(0, 0, W, H);
  const rg = ctx.createRadialGradient(W / 2, H * 0.45, Math.min(W, H) * 0.2, W / 2, H * 0.5, Math.max(W, H) * 0.8);
  rg.addColorStop(0, 'rgba(0,0,0,0)');
  rg.addColorStop(1, 'rgba(0,0,0,0.65)');
  ctx.fillStyle = rg;
  ctx.fillRect(0, 0, W, H);
  vGradient(ctx, 0, H * 0.4, W, H * 0.6, [[0, 'rgba(0,0,0,0)'], [1, 'rgba(0,0,0,0.85)']]);
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, W, bar);
  ctx.fillRect(0, H - bar, W, bar);

  const bh = bar * 0.7;
  logoBadge(ctx, c, m, (bar - bh) / 2, bh, { shadow: false, radius: 10 * u });
  if (state.category) drawOneLine(ctx, state.category, W - m, bar / 2, { fontKey: 'hind', weight: 700, size: 30 * u * k, color: A, align: 'right', maxW: W * 0.4 });
  const fy = H - bar / 2;
  if (state.date) drawOneLine(ctx, state.date, m, fy, { fontKey: 'hind', weight: 500, size: 26 * u * k, color: 'rgba(255,255,255,0.7)', align: 'left', maxW: W * 0.45 });
  const right = c.cta || c.site;
  if (right) drawOneLine(ctx, right, W - m, fy, { fontKey: 'hind', weight: 600, size: 26 * u * k, color: 'rgba(255,255,255,0.8)', align: 'right', maxW: W * 0.45 });

  const tx = m + 30 * u;
  const tw = W - tx - m;
  const top = bar + 40 * u;
  const bottom = H - bar - 44 * u;
  const sub = subFit(ctx, c, tw, 32, 2);
  const subH = sub ? sub.height + 14 * u : 0;
  const fit = fitText(ctx, c.headline, { fontKey: c.font, maxW: tw, maxH: bottom - top - subH, maxLines: 6, size: c.size(78), minSize: 26 * u, lh: 1.26 });
  const y = bottom - subH - fit.height;
  ctx.fillStyle = A;
  ctx.fillRect(m, y + 4 * u, 10 * u, fit.height + subH - 8 * u);
  drawLines(ctx, fit, tx, y, tw, { color: '#fff', hl: A, shadow: 14 * u });
  if (sub) drawLines(ctx, sub, tx, y + fit.height + 14 * u, tw, { color: 'rgba(255,255,255,0.82)', hl: '#fff' });
}

/* ---------- 14. gold frame ---------- */

function drawGoldFrame(ctx, c) {
  const { W, H, u, k, state, P, A, photo } = c;
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, shade(P, -0.45));
  g.addColorStop(1, shade(P, -0.82));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = rgba(A, 0.85);
  ctx.lineWidth = 3 * u;
  ctx.strokeRect(28 * u, 28 * u, W - 56 * u, H - 56 * u);
  ctx.strokeStyle = rgba(A, 0.35);
  ctx.lineWidth = 1.5 * u;
  ctx.strokeRect(40 * u, 40 * u, W - 80 * u, H - 80 * u);

  const m = 74 * u;
  let tx = m;
  let tw = W - 2 * m;
  let y = m;
  let centered = true;
  if (photo) {
    let pw = W - 2 * m;
    let ph;
    if (isWide(c)) {
      pw = W * 0.4;
      ph = H - 2 * m;
      tx = m + pw + 52 * u;
      tw = W - m - tx;
      centered = false;
    } else {
      ph = H * (isStory(c) ? 0.32 : 0.4);
      y = m + ph + 44 * u;
    }
    ctx.save();
    ctx.beginPath();
    ctx.rect(m, m, pw, ph);
    ctx.clip();
    drawCover(ctx, photo, m, m, pw, ph, state.focusX, state.focusY, state.zoom);
    ctx.restore();
    ctx.strokeStyle = A;
    ctx.lineWidth = 5 * u;
    ctx.strokeRect(m, m, pw, ph);
    ctx.strokeStyle = rgba(A, 0.5);
    ctx.lineWidth = 2 * u;
    ctx.strokeRect(m - 12 * u, m - 12 * u, pw + 24 * u, ph + 24 * u);
    logoBadge(ctx, c, m + 18 * u, m + 18 * u, 64 * u);
    if (isWide(c)) y = m;
  } else {
    logoBadge(ctx, c, W / 2, m, 80 * u, { align: 'center' });
    y = m + 130 * u;
  }

  const footerH = c.site || c.cta ? 64 * u : 0;
  const bottom = H - m - footerH;
  let catH = 0;
  if (state.category) catH = 56 * u;
  const sub = subFit(ctx, c, tw, 32, 2);
  const subH = sub ? sub.height + 14 * u : 0;
  const fit = fitText(ctx, c.headline, { fontKey: c.font, maxW: tw, maxH: bottom - y - catH - subH, maxLines: 6, size: c.size(70), minSize: 26 * u, lh: 1.3 });
  const block = catH + fit.height + subH;
  const by = photo ? y : y + Math.max(0, (bottom - y - block) / 2);
  const align = centered ? 'center' : 'left';
  if (state.category) {
    const f = fitOneLine(ctx, state.category, { fontKey: 'hind', weight: 700, size: 32 * u * k, minSize: 14, maxW: tw * 0.7 });
    const cx = centered ? tx + tw / 2 : tx + f.width / 2 + 34 * u;
    drawOneLine(ctx, state.category, cx, by + catH / 2 - 6 * u, { fontKey: 'hind', weight: 700, size: f.size, color: A, align: 'center' });
    diamond(ctx, cx - f.width / 2 - 24 * u, by + catH / 2 - 6 * u, 8 * u, A);
    diamond(ctx, cx + f.width / 2 + 24 * u, by + catH / 2 - 6 * u, 8 * u, A);
  }
  drawLines(ctx, fit, tx, by + catH, tw, { color: '#fff', hl: A, align });
  if (sub) drawLines(ctx, sub, tx, by + catH + fit.height + 14 * u, tw, { color: 'rgba(255,255,255,0.78)', hl: '#fff', align });
  if (footerH) {
    const text = [c.cta, c.site].filter(Boolean).join('   •   ');
    drawOneLine(ctx, text, tx + (centered ? tw / 2 : 0), H - m - footerH / 2 + 4 * u, { fontKey: 'hind', weight: 600, size: 27 * u * k, color: 'rgba(255,255,255,0.78)', align: centered ? 'center' : 'left', maxW: tw });
  }
}

/* ---------- 15. floating white card ---------- */

function drawFloat(ctx, c) {
  const { W, H, u, state, A, hlLight } = c;
  const mx = 44 * u;
  photoBg(ctx, c, 0, 0, W, H);
  vGradient(ctx, 0, 0, W, 220 * u, [[0, 'rgba(0,0,0,0.5)'], [1, 'rgba(0,0,0,0)']]);
  logoBadge(ctx, c, mx + 6 * u, mx, 78 * u);

  const pad = 40 * u;
  const cardW = W - 2 * mx;
  const innerW = cardW - 2 * pad;
  const footH = hasLightFooter(c) ? 62 * u : 0;
  const sub = subFit(ctx, c, innerW, 30, 2);
  const subH = sub ? sub.height + 12 * u : 0;
  const pillH = state.category ? 56 * u : 0;
  const maxCard = H * (isWide(c) ? 0.66 : 0.5);
  const fit = fitText(ctx, c.headline, { fontKey: c.font, maxW: innerW, maxH: maxCard - pad * 2 - subH - footH - pillH / 2, maxLines: 6, size: c.size(68), minSize: 26 * u, lh: 1.3 });
  const cardH = pad + pillH / 2 + fit.height + subH + (footH ? 18 * u + footH : 0) + pad * 0.6;
  const cardX = mx;
  const cardY = H - mx - cardH;

  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.35)';
  ctx.shadowBlur = 34 * u;
  ctx.shadowOffsetY = 12 * u;
  ctx.fillStyle = '#fff';
  rr(ctx, cardX, cardY, cardW, cardH, 28 * u);
  ctx.fill();
  ctx.restore();
  ctx.fillStyle = A;
  ctx.fillRect(cardX + pad, cardY, 90 * u, 8 * u);

  const ix = cardX + pad;
  let y = cardY + pad * 0.7 + pillH / 2;
  if (state.category) drawPill(ctx, state.category, ix, cardY - pillH / 2 + 8 * u, { h: pillH, bg: hlLight, color: onColor(hlLight), size: 28 * u, radius: 10 * u, padX: 26 * u, maxW: innerW });
  drawLines(ctx, fit, ix, y, innerW, { color: '#0f172a', hl: hlLight });
  y += fit.height;
  if (sub) {
    drawLines(ctx, sub, ix, y + 6 * u, innerW, { color: '#475569', hl: '#0f172a' });
    y += subH;
  }
  if (footH) lightFooter(ctx, c, ix, cardY + cardH - pad * 0.6 - footH, innerW, footH, { grey: '#64748b', accent: hlLight });
}

/* ---------- 16. glow (dark gradient, glowing photo) ---------- */

function drawGlow(ctx, c) {
  const { W, H, u, k, state, P, A, photo } = c;
  const m = 60 * u;
  const g = ctx.createLinearGradient(0, 0, W, H);
  g.addColorStop(0, shade(P, -0.82));
  g.addColorStop(1, '#0a0618');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  const blob = (x, y, r, col) => {
    const rg = ctx.createRadialGradient(x, y, 0, x, y, r);
    rg.addColorStop(0, col);
    rg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = rg;
    ctx.fillRect(x - r, y - r, 2 * r, 2 * r);
  };
  blob(W * 0.92, H * 0.12, Math.min(W, H) * 0.75, rgba(A, 0.26));
  blob(W * 0.04, H * 0.88, Math.min(W, H) * 0.65, rgba('#7c3aed', 0.3));

  logoBadge(ctx, c, m, m * 0.7, 66 * u);
  if (state.category) drawOneLine(ctx, state.category, W - m, m * 0.7 + 33 * u, { fontKey: 'hind', weight: 700, size: 30 * u * k, color: A, align: 'right', maxW: W * 0.4 });

  let px = m;
  let py = m * 0.7 + 66 * u + 26 * u;
  let pw = W - 2 * m;
  let ph = H * (isStory(c) ? 0.3 : 0.4);
  let tx = m;
  let tw = W - 2 * m;
  let y;
  if (isWide(c)) {
    pw = W * 0.44;
    ph = H - py - m * 0.7;
    tx = m + pw + 50 * u;
    tw = W - m - tx;
    y = py;
  } else {
    y = py + ph + 40 * u;
  }
  ctx.save();
  ctx.shadowColor = rgba(A, 0.75);
  ctx.shadowBlur = 38 * u;
  ctx.fillStyle = '#000';
  rr(ctx, px, py, pw, ph, 38 * u);
  ctx.fill();
  ctx.restore();
  ctx.save();
  rr(ctx, px, py, pw, ph, 38 * u);
  ctx.clip();
  photoBg(ctx, c, px, py, pw, ph);
  ctx.restore();
  ctx.strokeStyle = rgba(A, 0.95);
  ctx.lineWidth = 3 * u;
  rr(ctx, px, py, pw, ph, 38 * u);
  ctx.stroke();

  const footerH = state.date || c.cta ? 58 * u : 0;
  const bottom = H - m * 0.8 - footerH;
  const sub = subFit(ctx, c, tw, 32, 2);
  const subH = sub ? sub.height + 14 * u : 0;
  const fit = fitText(ctx, c.headline, { fontKey: c.font, maxW: tw, maxH: bottom - y - subH, maxLines: 6, size: c.size(72), minSize: 26 * u, lh: 1.28 });
  drawLines(ctx, fit, tx, y, tw, { color: '#fff', hl: A });
  if (sub) drawLines(ctx, sub, tx, y + fit.height + 14 * u, tw, { color: 'rgba(255,255,255,0.75)', hl: '#fff' });
  if (footerH) {
    const fy = H - m * 0.8 - footerH / 2;
    if (state.date) drawOneLine(ctx, state.date, tx, fy, { fontKey: 'hind', weight: 500, size: 26 * u * k, color: 'rgba(255,255,255,0.6)', align: 'left', maxW: tw * 0.5 });
    if (c.cta) drawOneLine(ctx, c.cta + ' →', tx + tw, fy, { fontKey: 'hind', weight: 700, size: 26 * u * k, color: A, align: 'right', maxW: tw * 0.5 });
  }
}

/* ---------- 17. gold seal (white box with a colour block behind it) ---------- */

function drawSeal(ctx, c) {
  const { W, H, u, k, state, P, A, hlLight } = c;
  const mx = 56 * u;
  photoBg(ctx, c, 0, 0, W, H);
  vGradient(ctx, 0, 0, W, 220 * u, [[0, 'rgba(0,0,0,0.45)'], [1, 'rgba(0,0,0,0)']]);
  vGradient(ctx, 0, H * 0.5, W, H * 0.5, [[0, 'rgba(0,0,0,0)'], [1, 'rgba(0,0,0,0.5)']]);
  logoBadge(ctx, c, mx, mx * 0.8, 76 * u);

  if (state.category) {
    const r = 82 * u;
    const cx = W - mx - r;
    const cy = mx * 0.8 + r;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(-0.17);
    const n = 22;
    ctx.fillStyle = A;
    ctx.shadowColor = 'rgba(0,0,0,0.35)';
    ctx.shadowBlur = 14 * u;
    ctx.shadowOffsetY = 5 * u;
    ctx.beginPath();
    for (let i = 0; i < n * 2; i++) {
      const a = (i / (n * 2)) * Math.PI * 2;
      const rad = i % 2 ? r * 0.9 : r;
      ctx.lineTo(Math.cos(a) * rad, Math.sin(a) * rad);
    }
    ctx.closePath();
    ctx.fill();
    ctx.shadowColor = 'transparent';
    ctx.strokeStyle = rgba(onColor(A), 0.55);
    ctx.lineWidth = 2 * u;
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.76, 0, Math.PI * 2);
    ctx.stroke();
    drawOneLine(ctx, state.category, 0, 0, { fontKey: 'hind', weight: 700, size: r * 0.3, color: onColor(A), align: 'center', maxW: r * 1.3 });
    ctx.restore();
  }

  const off = 16 * u;
  const bw = W - 2 * mx - off;
  const pad = 36 * u;
  const innerW = bw - 2 * pad;
  const footH = hasLightFooter(c) ? 60 * u : 0;
  const sub = subFit(ctx, c, innerW, 30, 2);
  const subH = sub ? sub.height + 12 * u : 0;
  const fit = fitText(ctx, c.headline, { fontKey: c.font, maxW: innerW, maxH: H * (isWide(c) ? 0.62 : 0.46) - pad * 2 - subH - footH, maxLines: 6, size: c.size(66), minSize: 26 * u, lh: 1.3 });
  const bh = pad + fit.height + subH + (footH ? 14 * u + footH : 0) + pad * 0.6;
  const bx = mx;
  const by = H - mx - off - bh;
  ctx.fillStyle = P;
  ctx.fillRect(bx + off, by + off, bw, bh);
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.3)';
  ctx.shadowBlur = 26 * u;
  ctx.fillStyle = '#fff';
  ctx.fillRect(bx, by, bw, bh);
  ctx.restore();
  ctx.fillStyle = A;
  ctx.fillRect(bx, by, 12 * u, bh);
  const ix = bx + pad + 6 * u;
  drawLines(ctx, fit, ix, by + pad, innerW - 6 * u, { color: '#0f172a', hl: hlLight });
  if (sub) drawLines(ctx, sub, ix, by + pad + fit.height + 12 * u, innerW - 6 * u, { color: '#475569', hl: '#0f172a' });
  if (footH) lightFooter(ctx, c, ix, by + bh - pad * 0.6 - footH, innerW - 6 * u, footH, { grey: '#64748b', accent: hlLight });
}

/* ---------- 18. minimal block (big date number, offset colour block) ---------- */

function drawMinimal(ctx, c) {
  const { W, H, u, k, state, P, hlLight } = c;
  const ink = '#101418';
  const grey = '#6b7280';
  const m = 60 * u;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, W, H);
  const wide = isWide(c);
  const parts = dateParts(state.date);

  plainLogo(ctx, c, m, m, 64 * u, P);
  let y0 = m + 64 * u + 26 * u;
  if (parts.day) {
    const f = fitOneLine(ctx, parts.day, { fontKey: 'noto', weight: 800, size: 150 * u, minSize: 40, maxW: W * 0.27 - m * 0.4 });
    drawOneLine(ctx, parts.day, m, y0 + f.size * 0.55, { fontKey: 'noto', weight: 800, size: f.size, color: P, align: 'left' });
    y0 += f.size * 1.15;
    if (parts.rest) {
      const rest = parts.rest.split(/[\s,]+/).filter(Boolean);
      rest.slice(0, 3).forEach((w, i) => drawOneLine(ctx, w, m, y0 + i * 36 * u, { fontKey: 'hind', weight: 600, size: 26 * u * k, color: grey, align: 'left', maxW: W * 0.27 - m * 0.4 }));
    }
  }

  let px;
  let py;
  let pw;
  let ph;
  let tx = m;
  let tw = W - 2 * m;
  let y;
  if (wide) {
    px = W * 0.52;
    py = m;
    pw = W - m - px;
    ph = H - 2 * m;
    tx = m;
    tw = px - m - 36 * u;
    y = Math.max(y0 + 90 * u, H * 0.3);
  } else {
    px = W * 0.3;
    py = m;
    pw = W - m - px;
    ph = H * (isStory(c) ? 0.3 : 0.38);
    y = py + ph + 28 * u + 44 * u;
  }
  const off = 26 * u;
  ctx.fillStyle = P;
  ctx.fillRect(px + off, py + off, pw, ph);
  ctx.save();
  ctx.beginPath();
  ctx.rect(px, py, pw, ph);
  ctx.clip();
  photoBg(ctx, c, px, py, pw, ph);
  ctx.restore();

  const footerH = hasLightFooter(c) ? 68 * u : 0;
  const bottom = H - m;
  const sub = subFit(ctx, c, tw, 30, 2);
  const subH = sub ? sub.height + 12 * u : 0;
  const cat = state.category;
  let catH = 0;
  if (cat) {
    drawOneLine(ctx, cat, tx, y + 4 * u, { fontKey: 'hind', weight: 700, size: 28 * u * k, color: hlLight, align: 'left', maxW: tw });
    catH = 44 * u;
  }
  const fit = fitText(ctx, c.headline, { fontKey: c.font, maxW: tw, maxH: bottom - (footerH ? footerH + 14 * u : 0) - y - catH - subH, maxLines: 7, size: c.size(wide ? 60 : 72), minSize: 26 * u, lh: 1.28 });
  drawLines(ctx, fit, tx, y + catH, tw, { color: ink, hl: P });
  if (sub) drawLines(ctx, sub, tx, y + catH + fit.height + 12 * u, tw, { color: grey, hl: ink });
  if (footerH) lightFooter(ctx, c, tx, bottom - footerH, wide ? tw : W - 2 * m, footerH, { grey, accent: P, line: 'rgba(0,0,0,0.22)' });
}

/* ---------- 19. torn paper ---------- */

function drawTorn(ctx, c) {
  const { W, H, u, k, state, A, hlLight } = c;
  const paper = '#f2ead8';
  const ink = '#1c1710';
  const grey = '#6b6150';
  const m = 58 * u;
  ctx.fillStyle = paper;
  ctx.fillRect(0, 0, W, H);
  const ph = H * topShare(c, 0.56);
  photoBg(ctx, c, 0, 0, W, ph + 40 * u);
  vGradient(ctx, 0, 0, W, 200 * u, [[0, 'rgba(0,0,0,0.4)'], [1, 'rgba(0,0,0,0)']]);

  const rnd = seeded(11);
  ctx.save();
  ctx.fillStyle = paper;
  ctx.shadowColor = 'rgba(0,0,0,0.4)';
  ctx.shadowBlur = 16 * u;
  ctx.shadowOffsetY = -5 * u;
  ctx.beginPath();
  ctx.moveTo(0, H);
  ctx.lineTo(0, ph);
  for (let x = 0; x <= W + 18 * u; x += 18 * u) ctx.lineTo(x, ph + (rnd() - 0.5) * 30 * u);
  ctx.lineTo(W, H);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  logoBadge(ctx, c, m, m * 0.7, 72 * u);
  let y = ph + 46 * u;
  if (state.category) {
    ctx.save();
    ctx.translate(m, ph - 34 * u);
    ctx.rotate(-0.035);
    drawPill(ctx, state.category, 0, 0, { h: 58 * u, bg: '#facc15', color: '#1c1710', size: 30 * u, radius: 6 * u, padX: 26 * u, maxW: W * 0.6 });
    ctx.restore();
  }
  const tw = W - 2 * m;
  const footerH = hasLightFooter(c) ? 68 * u : 0;
  const bottom = H - m * 0.8;
  const sub = subFit(ctx, c, tw, 30, 2);
  const subH = sub ? sub.height + 12 * u : 0;
  const fit = fitText(ctx, c.headline, { fontKey: c.font, maxW: tw, maxH: bottom - (footerH ? footerH + 12 * u : 0) - y - subH, maxLines: 6, size: c.size(74), minSize: 26 * u, lh: 1.3 });
  drawLines(ctx, fit, m, y, tw, { color: ink, hl: hlLight });
  if (sub) drawLines(ctx, sub, m, y + fit.height + 12 * u, tw, { color: grey, hl: ink });
  if (footerH) lightFooter(ctx, c, m, bottom - footerH, tw, footerH, { grey, accent: hlLight, line: 'rgba(28,23,16,0.3)' });
  void A;
}

/* ---------- 20. goal spotlight ---------- */

function drawGoal(ctx, c) {
  const { W, H, u, k, state, P, A, photo } = c;
  const m = 56 * u;
  const wide = isWide(c);
  const bg = ctx.createRadialGradient(W * (wide ? 0.27 : 0.5), H * 0.3, 0, W * 0.5, H * 0.45, Math.max(W, H) * 0.85);
  bg.addColorStop(0, shade(P, -0.2));
  bg.addColorStop(1, shade(P, -0.86));
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  const r = wide ? H * 0.33 : Math.min(W * 0.34, H * (isStory(c) ? 0.17 : 0.22));
  const cx = wide ? m + r + 20 * u : W / 2;
  const cy = wide ? H / 2 : m * 0.7 + 84 * u + r + 18 * u;
  const rg = ctx.createRadialGradient(cx, cy, r * 0.6, cx, cy, r * 1.7);
  rg.addColorStop(0, rgba(A, 0.38));
  rg.addColorStop(1, rgba(A, 0));
  ctx.fillStyle = rg;
  ctx.fillRect(cx - r * 1.8, cy - r * 1.8, r * 3.6, r * 3.6);
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.clip();
  photoBg(ctx, c, cx - r, cy - r, r * 2, r * 2);
  ctx.restore();
  ctx.strokeStyle = A;
  ctx.lineWidth = 9 * u;
  ctx.beginPath();
  ctx.arc(cx, cy, r + 5 * u, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = rgba(A, 0.4);
  ctx.lineWidth = 2 * u;
  ctx.beginPath();
  ctx.arc(cx, cy, r + 30 * u, 0, Math.PI * 2);
  ctx.stroke();
  void photo;

  logoBadge(ctx, c, m, m * 0.7, 72 * u);

  let tx = m;
  let tw = W - 2 * m;
  let y;
  let align = 'center';
  if (wide) {
    tx = cx + r + 70 * u;
    tw = W - m - tx;
    align = 'left';
    y = m;
  } else {
    y = cy + r + 60 * u;
  }
  const footerH = hasFooterText(c) ? 70 * u : 24 * u;
  const bottom = H - footerH;
  let catH = 0;
  if (state.category) catH = 70 * u;
  const sub = subFit(ctx, c, tw, 32, 2);
  const subH = sub ? sub.height + 14 * u : 0;
  const fit = fitText(ctx, c.headline, { fontKey: c.font, maxW: tw, maxH: bottom - y - catH - subH, maxLines: 6, size: c.size(74), minSize: 26 * u, lh: 1.26 });
  const by = wide ? y + Math.max(0, (bottom - y - catH - fit.height - subH) / 2) : y;
  if (state.category) drawPill(ctx, state.category, align === 'center' ? W / 2 : tx, by, { h: 56 * u, bg: A, color: onColor(A), size: 30 * u, align: align === 'center' ? 'center' : 'left', radius: 28 * u, padX: 32 * u, maxW: tw });
  drawLines(ctx, fit, tx, by + catH, tw, { color: '#fff', hl: A, align });
  if (sub) drawLines(ctx, sub, tx, by + catH + fit.height + 14 * u, tw, { color: 'rgba(255,255,255,0.8)', hl: '#fff', align });
  if (hasFooterText(c)) footerRow(ctx, c, H - footerH, footerH, 'rgba(255,255,255,0.85)', { center: !wide, m });
  void k;
}

/* ---------- 21. sports motion (slanted photo, speed stripes) ---------- */

function drawSportsMotion(ctx, c) {
  const { W, H, u, k, state, P, A } = c;
  const m = 56 * u;
  const g = ctx.createLinearGradient(0, 0, W, H);
  g.addColorStop(0, shade(P, -0.55));
  g.addColorStop(1, shade(P, -0.88));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  const yL = H * (isWide(c) ? 0.46 : 0.5);
  const yR = H * (isWide(c) ? 0.6 : 0.62);
  ctx.save();
  ctx.strokeStyle = 'rgba(255,255,255,0.06)';
  ctx.lineWidth = 7 * u;
  for (let i = -4; i < 14; i++) {
    ctx.beginPath();
    ctx.moveTo(i * 130 * u, H);
    ctx.lineTo(i * 130 * u + 360 * u, yL);
    ctx.stroke();
  }
  ctx.restore();

  ctx.save();
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(W, 0);
  ctx.lineTo(W, yR);
  ctx.lineTo(0, yL);
  ctx.closePath();
  ctx.clip();
  photoBg(ctx, c, 0, 0, W, Math.max(yL, yR) + 4);
  vGradient(ctx, 0, 0, W, 200 * u, [[0, 'rgba(0,0,0,0.5)'], [1, 'rgba(0,0,0,0)']]);
  ctx.restore();

  const band = (off, th, color) => {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(0, yL + off);
    ctx.lineTo(W, yR + off);
    ctx.lineTo(W, yR + off + th);
    ctx.lineTo(0, yL + off + th);
    ctx.closePath();
    ctx.fill();
  };
  band(0, 18 * u, A);
  band(28 * u, 8 * u, 'rgba(255,255,255,0.85)');
  band(46 * u, 8 * u, rgba(A, 0.5));

  for (let i = 0; i < 3; i++) {
    const x = W - m - 20 * u - i * 36 * u;
    const y = yR - 120 * u;
    ctx.fillStyle = rgba(A, 0.95 - i * 0.28);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + 20 * u, y);
    ctx.lineTo(x + 6 * u, y + 52 * u);
    ctx.lineTo(x - 14 * u, y + 52 * u);
    ctx.closePath();
    ctx.fill();
  }

  logoBadge(ctx, c, m, m * 0.7, 76 * u);
  const edgeAt = (x) => yL + (yR - yL) * (x / W);
  if (state.category) drawPill(ctx, state.category, m, edgeAt(m + 300 * u) - 64 * u - 20 * u, { h: 64 * u, bg: A, color: onColor(A), size: 32 * u, radius: 8 * u, padX: 30 * u, maxW: W * 0.55 });

  const top = yR + 86 * u;
  const footerH = hasFooterText(c) ? 80 * u : 30 * u;
  const bottom = H - footerH;
  const tw = W - 2 * m;
  const sub = subFit(ctx, c, tw, 30, 2);
  const subH = sub ? sub.height + 12 * u : 0;
  const fit = fitText(ctx, c.headline, { fontKey: c.font, maxW: tw, maxH: bottom - top - subH, maxLines: 5, size: c.size(74), minSize: 26 * u, lh: 1.24 });
  drawLines(ctx, fit, m, top, tw, { color: '#fff', hl: A });
  if (sub) drawLines(ctx, sub, m, top + fit.height + 12 * u, tw, { color: 'rgba(255,255,255,0.8)', hl: '#fff' });
  if (hasFooterText(c)) footerRow(ctx, c, bottom, footerH, 'rgba(255,255,255,0.82)');
  void k;
}

/* ---------- 22. classic border ---------- */

function drawClassic(ctx, c) {
  const { W, H, u, k, state, A, hlLight } = c;
  const ink = '#14161a';
  const grey = '#6a707a';
  const m = 62 * u;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, W, H);
  const ph = H * topShare(c, 0.5);
  photoBg(ctx, c, 0, 0, W, ph);
  vGradient(ctx, 0, ph - ph * 0.4, W, ph * 0.4 + 1, [[0, 'rgba(255,255,255,0)'], [1, '#ffffff']]);
  logoBadge(ctx, c, m, m * 0.8, 70 * u);

  let y = ph - 6 * u;
  if (state.category) {
    drawPill(ctx, state.category, W / 2, y - 30 * u, { h: 56 * u, bg: A, color: onColor(A), size: 28 * u, align: 'center', radius: 6 * u, padX: 30 * u, maxW: W * 0.6 });
    y += 40 * u;
  }
  const tw = W - 2 * m;
  const brandH = c.brand.name ? 52 * u : 0;
  const footerH = state.date || c.site ? 54 * u : 0;
  const bottom = H - m * 0.9;
  const sub = subFit(ctx, c, tw, 30, 2);
  const subH = sub ? sub.height + 12 * u : 0;
  const fit = fitText(ctx, c.headline, { fontKey: c.font, maxW: tw, maxH: bottom - y - subH - brandH - footerH - 20 * u, maxLines: 6, size: c.size(70), minSize: 26 * u, lh: 1.3 });
  drawLines(ctx, fit, m, y, tw, { color: ink, hl: hlLight, align: 'center' });
  if (sub) drawLines(ctx, sub, m, y + fit.height + 12 * u, tw, { color: grey, hl: ink, align: 'center' });
  let fy = bottom - footerH;
  if (footerH) {
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    ctx.fillRect(m, fy, tw, 2 * u);
    drawOneLine(ctx, [state.date, c.site].filter(Boolean).join('   |   '), W / 2, fy + footerH / 2 + 4 * u, { fontKey: 'hind', weight: 600, size: 26 * u * k, color: grey, align: 'center', maxW: tw });
  }
  if (brandH) drawOneLine(ctx, c.brand.name, W / 2, fy - brandH / 2 - 4 * u, { fontKey: 'hind', weight: 700, size: 34 * u * k, color: hlLight, align: 'center', maxW: tw });
  ctx.strokeStyle = A;
  ctx.lineWidth = 6 * u;
  ctx.strokeRect(16 * u, 16 * u, W - 32 * u, H - 32 * u);
}

/* ---------- 23. round notch (logo circle between photo and white panel) ---------- */

function drawNotch(ctx, c) {
  const { W, H, u, k, state, P, A, hlLight } = c;
  const ink = '#111827';
  const grey = '#6b7280';
  const m = 56 * u;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, W, H);
  const ph = H * topShare(c, 0.55);
  photoBg(ctx, c, 0, 0, W, ph);
  vGradient(ctx, 0, 0, W, 180 * u, [[0, 'rgba(0,0,0,0.4)'], [1, 'rgba(0,0,0,0)']]);
  if (state.category) drawPill(ctx, state.category, m, m * 0.8, { h: 58 * u, bg: A, color: onColor(A), size: 28 * u, radius: 8 * u, padX: 26 * u, maxW: W * 0.5 });

  const nr = 78 * u;
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.25)';
  ctx.shadowBlur = 20 * u;
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(W / 2, ph, nr, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  if (c.logo) {
    drawContain(ctx, c.logo, W / 2 - nr * 0.72, ph - nr * 0.72, nr * 1.44, nr * 1.44);
  } else if (c.brand.name) {
    const ch = Array.from(c.brand.name)[0];
    drawOneLine(ctx, ch, W / 2, ph, { fontKey: 'hind', weight: 700, size: nr * 0.9, color: P, align: 'center' });
  }

  const barH = hasFooterText(c) ? 70 * u : 0;
  const y = ph + nr + 24 * u;
  const tw = W - 2 * m;
  const sub = subFit(ctx, c, tw, 30, 2);
  const subH = sub ? sub.height + 12 * u : 0;
  const fit = fitText(ctx, c.headline, { fontKey: c.font, maxW: tw, maxH: H - barH - y - subH - 20 * u, maxLines: 6, size: c.size(70), minSize: 26 * u, lh: 1.3 });
  drawLines(ctx, fit, m, y, tw, { color: ink, hl: hlLight, align: 'center' });
  if (sub) drawLines(ctx, sub, m, y + fit.height + 12 * u, tw, { color: grey, hl: ink, align: 'center' });
  if (barH) {
    ctx.fillStyle = '#eef0f3';
    ctx.fillRect(0, H - barH, W, barH);
    footerRow(ctx, c, H - barH, barH, grey, { m });
  }
}

/* ---------- 24. TV breaking (tags + yellow ticker) ---------- */

function drawTvTicker(ctx, c) {
  const { W, H, u, k, state, P, A } = c;
  const m = 50 * u;
  const tickerH = 86 * u;
  const ph = H * (isWide(c) ? 0.48 : 0.5);
  ctx.fillStyle = shade(P, -0.72);
  ctx.fillRect(0, 0, W, H);
  photoBg(ctx, c, 0, 0, W, ph);
  vGradient(ctx, 0, ph - 140 * u, W, 140 * u, [[0, 'rgba(0,0,0,0)'], [1, 'rgba(0,0,0,0.55)']]);

  const tagH = 60 * u;
  const t1 = drawPill(ctx, state.category || 'ব্রেকিং নিউজ', 0, ph - tagH, { h: tagH, bg: '#dc2626', color: '#fff', size: 30 * u, radius: 0, padX: 30 * u, maxW: W * 0.5 });
  const second = c.brand.name || state.date;
  if (second) drawPill(ctx, second, t1.x + t1.w, ph - tagH, { h: tagH, bg: '#ffffff', color: '#111827', size: 28 * u, radius: 0, padX: 26 * u, maxW: W * 0.4 });
  logoBadge(ctx, c, W - m, m * 0.8, 72 * u, { align: 'right' });

  const tw = W - 2 * m;
  const top = ph + 34 * u;
  const bottom = H - tickerH - 26 * u;
  const sub = subFit(ctx, c, tw, 30, 2);
  const subH = sub ? sub.height + 12 * u : 0;
  const fit = fitText(ctx, c.headline, { fontKey: c.font, maxW: tw, maxH: bottom - top - subH, maxLines: 5, size: c.size(72), minSize: 26 * u, lh: 1.28 });
  const y = top + Math.max(0, (bottom - top - fit.height - subH) / 2);
  drawLines(ctx, fit, m, y, tw, { color: '#fff', hl: A });
  if (sub) drawLines(ctx, sub, m, y + fit.height + 12 * u, tw, { color: 'rgba(255,255,255,0.82)', hl: '#fff' });

  const ty = H - tickerH;
  ctx.fillStyle = A;
  ctx.fillRect(0, ty, W, tickerH);
  const lw = Math.min(W * 0.28, 230 * u);
  ctx.fillStyle = shade(P, -0.85);
  ctx.fillRect(0, ty, lw, tickerH);
  drawOneLine(ctx, 'শিরোনাম', lw / 2, ty + tickerH / 2, { fontKey: 'hind', weight: 700, size: 32 * u * k, color: '#fff', align: 'center', maxW: lw - 24 * u });
  const line = [c.brand.name, c.cta, c.site].filter(Boolean).join('   •   ') || state.date || '';
  if (line) drawOneLine(ctx, line, lw + 28 * u, ty + tickerH / 2, { fontKey: 'hind', weight: 600, size: 28 * u * k, color: onColor(A), align: 'left', maxW: W - lw - 56 * u });
}

/* ---------- 25. quote with a golden ring ---------- */

function drawQuoteRing(ctx, c) {
  const { W, H, u, k, state, P, A, photo } = c;
  const m = 62 * u;
  const wide = isWide(c);
  const g = ctx.createLinearGradient(0, 0, W, H);
  g.addColorStop(0, shade(P, -0.55));
  g.addColorStop(1, shade(P, -0.88));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = 'rgba(255,255,255,0.04)';
  ctx.beginPath();
  ctx.arc(W * 0.1, H * 0.9, Math.min(W, H) * 0.4, 0, Math.PI * 2);
  ctx.fill();

  const r = wide ? H * 0.3 : Math.min(W * 0.24, H * (isStory(c) ? 0.14 : 0.19));
  const cx = wide ? m + r + 14 * u : W - m - r - 6 * u;
  const cy = wide ? H / 2 : m + r + 30 * u;
  if (photo) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.clip();
    drawCover(ctx, photo, cx - r, cy - r, r * 2, r * 2, state.focusX, state.focusY, state.zoom);
    ctx.restore();
  } else {
    silhouette(ctx, cx, cy, r, '#475569', '#1e293b');
  }
  ctx.strokeStyle = A;
  ctx.lineWidth = 8 * u;
  ctx.beginPath();
  ctx.arc(cx, cy, r + 5 * u, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = rgba(A, 0.35);
  ctx.lineWidth = 2 * u;
  ctx.beginPath();
  ctx.arc(cx, cy, r + 24 * u, 0, Math.PI * 2);
  ctx.stroke();

  logoBadge(ctx, c, m, m * 0.8, 68 * u);

  let tx = m;
  let tw = W - 2 * m;
  let y;
  if (wide) {
    tx = cx + r + 80 * u;
    tw = W - m - tx;
    y = m;
  } else {
    y = cy + r + 70 * u;
  }
  ctx.save();
  ctx.fillStyle = A;
  ctx.font = `700 ${230 * u}px Georgia, "Times New Roman", serif`;
  ctx.textBaseline = 'alphabetic';
  ctx.fillText('“', tx - 4 * u, wide ? y + 150 * u : cy + r * 0.55);
  ctx.restore();
  const qOff = wide ? 150 * u : 0;

  const footerH = hasFooterText(c) ? 70 * u : 0;
  const bottom = H - m * 0.7 - footerH;
  const spkH = state.speaker ? 94 * u : 0;
  const fit = fitText(ctx, c.headline, { fontKey: c.font, maxW: tw, maxH: bottom - y - qOff - spkH, maxLines: 8, size: c.size(66), minSize: 26 * u, lh: 1.32 });
  drawLines(ctx, fit, tx, y + qOff, tw, { color: '#fff', hl: A });
  if (state.speaker) {
    const sy = y + qOff + fit.height + 30 * u;
    ctx.fillStyle = A;
    ctx.fillRect(tx, sy, 8 * u, 70 * u);
    drawOneLine(ctx, state.speaker, tx + 28 * u, sy + (state.subtitle ? 18 * u : 35 * u), { fontKey: c.font, weight: 700, size: 40 * u * k, color: '#fff', align: 'left', maxW: tw - 30 * u });
    if (state.subtitle) drawOneLine(ctx, state.subtitle, tx + 28 * u, sy + 54 * u, { fontKey: 'hind', weight: 500, size: 28 * u * k, color: 'rgba(255,255,255,0.7)', align: 'left', maxW: tw - 30 * u });
  }
  if (footerH) footerRow(ctx, c, H - m * 0.7 - footerH, footerH, 'rgba(255,255,255,0.7)', { m });
}

/* ---------- registry ---------- */

export const TEMPLATE_CATS = [
  { id: 'all', label: 'সব' },
  { id: 'breaking', label: 'ব্রেকিং' },
  { id: 'tv', label: 'টিভি' },
  { id: 'paper', label: 'পত্রিকা' },
  { id: 'portal', label: 'পোর্টাল' },
  { id: 'sports', label: 'খেলা' },
  { id: 'special', label: 'বিশেষ' },
];

export const TEMPLATES = [
  { id: 'breaking', cat: 'breaking', label: 'ব্রেকিং নিউজ', font: 'hind', usesPhoto: true, draw: drawBreaking },
  { id: 'centerBreak', cat: 'breaking', label: 'সেন্টার ব্রেকিং', font: 'hind', usesPhoto: true, draw: drawCenterBreak },
  { id: 'tv', cat: 'tv', label: 'টিভি স্টাইল', font: 'hind', usesPhoto: true, draw: drawTv },
  { id: 'tvTicker', cat: 'tv', label: 'টিভি টিকার', font: 'hind', usesPhoto: true, draw: drawTvTicker },
  { id: 'paper', cat: 'paper', label: 'পত্রিকা স্টাইল', font: 'tiro', usesPhoto: true, draw: drawPaper },
  { id: 'editorial', cat: 'paper', label: 'সম্পাদকীয় ক্রিম', font: 'notoserif', usesPhoto: true, draw: drawEditorial },
  { id: 'classic', cat: 'paper', label: 'ক্লাসিক বর্ডার', font: 'noto', usesPhoto: true, draw: drawClassic },
  { id: 'torn', cat: 'paper', label: 'ছেঁড়া পাতা', font: 'hind', usesPhoto: true, draw: drawTorn },
  { id: 'goldFrame', cat: 'paper', label: 'গোল্ড ফ্রেম', font: 'mina', usesPhoto: true, draw: drawGoldFrame },
  { id: 'minimal', cat: 'paper', label: 'মিনিমাল ব্লক', font: 'noto', usesPhoto: true, draw: drawMinimal },
  { id: 'notch', cat: 'paper', label: 'গোল নচ', font: 'hind', usesPhoto: true, draw: drawNotch },
  { id: 'seal', cat: 'paper', label: 'সোনালি সিল', font: 'hind', usesPhoto: true, draw: drawSeal },
  { id: 'portal', cat: 'portal', label: 'অনলাইন পোর্টাল', font: 'hind', usesPhoto: true, draw: drawPortal },
  { id: 'centerLogo', cat: 'portal', label: 'মাঝখানে লোগো', font: 'hind', usesPhoto: true, draw: drawCenterLogo },
  { id: 'redTint', cat: 'portal', label: 'লাল আভা', font: 'hind', usesPhoto: true, draw: drawRedTint },
  { id: 'night', cat: 'portal', label: 'গভীর নীল', font: 'hind', usesPhoto: true, draw: drawNight },
  { id: 'centerRoyal', cat: 'portal', label: 'বেগুনি আভা', font: 'hind', usesPhoto: true, draw: drawCenterRoyal },
  { id: 'centerGreen', cat: 'portal', label: 'সবুজ আভা', font: 'hind', usesPhoto: true, draw: drawCenterGreen },
  { id: 'float', cat: 'portal', label: 'ভাসা কার্ড', font: 'hind', usesPhoto: true, draw: drawFloat },
  { id: 'glow', cat: 'portal', label: 'নীল-বেগুনি আভা', font: 'anek', usesPhoto: true, draw: drawGlow },
  { id: 'cinema', cat: 'portal', label: 'সিনেমা স্টাইল', font: 'anek', usesPhoto: true, draw: drawCinema },
  { id: 'sports', cat: 'sports', label: 'খেলার খবর', font: 'anek', usesPhoto: true, draw: drawSports },
  { id: 'centerSport', cat: 'sports', label: 'সেন্টার খেলা', font: 'anek', usesPhoto: true, draw: drawCenterSport },
  { id: 'goal', cat: 'sports', label: 'গোল স্পটলাইট', font: 'anek', usesPhoto: true, draw: drawGoal },
  { id: 'motion', cat: 'sports', label: 'খেলা — গতি', font: 'baloo', usesPhoto: true, draw: drawSportsMotion },
  { id: 'quote', cat: 'special', label: 'উক্তি কার্ড', font: 'hind', usesPhoto: true, draw: drawQuote },
  { id: 'quoteRing', cat: 'special', label: 'উক্তি — সোনালি রিং', font: 'hind', usesPhoto: true, draw: drawQuoteRing },
  { id: 'mourning', cat: 'special', label: 'শোক সংবাদ', font: 'hind', usesPhoto: true, draw: drawMourning },
  { id: 'text', cat: 'special', label: 'ছবি ছাড়া কার্ড', font: 'hind', usesPhoto: false, draw: drawTextOnly },
];

export const TEMPLATE_MAP = Object.fromEntries(TEMPLATES.map((t) => [t.id, t]));

// luminance is re-exported so render.js can derive the dark-on-light highlight colour
export { luminance };
