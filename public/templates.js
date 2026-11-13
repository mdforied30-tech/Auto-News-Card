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

/* ---------- registry ---------- */

export const TEMPLATES = [
  { id: 'breaking', label: 'ব্রেকিং নিউজ', font: 'hind', usesPhoto: true, draw: drawBreaking },
  { id: 'tv', label: 'টিভি স্টাইল', font: 'hind', usesPhoto: true, draw: drawTv },
  { id: 'paper', label: 'পত্রিকা স্টাইল', font: 'tiro', usesPhoto: true, draw: drawPaper },
  { id: 'portal', label: 'অনলাইন পোর্টাল', font: 'hind', usesPhoto: true, draw: drawPortal },
  { id: 'sports', label: 'খেলার খবর', font: 'anek', usesPhoto: true, draw: drawSports },
  { id: 'quote', label: 'উক্তি কার্ড', font: 'hind', usesPhoto: true, draw: drawQuote },
  { id: 'mourning', label: 'শোক সংবাদ', font: 'hind', usesPhoto: true, draw: drawMourning },
  { id: 'text', label: 'ছবি ছাড়া কার্ড', font: 'hind', usesPhoto: false, draw: drawTextOnly },
];

export const TEMPLATE_MAP = Object.fromEntries(TEMPLATES.map((t) => [t.id, t]));

// luminance is re-exported so render.js can derive the dark-on-light highlight colour
export { luminance };
