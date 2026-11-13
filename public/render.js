/* Turns the editor state into pixels. */

import { FONTS, fontStack, luminance, shade } from './draw.js';
import { TEMPLATE_MAP } from './templates.js';

export const FORMATS = {
  square: { w: 1080, h: 1080, label: '১:১', note: 'ফেসবুক পোস্ট' },
  portrait: { w: 1080, h: 1350, label: '৪:৫', note: 'পোর্ট্রেট' },
  landscape: { w: 1280, h: 720, label: '১৬:৯', note: 'ওয়াইড' },
  story: { w: 1080, h: 1920, label: '৯:১৬', note: 'স্টোরি / রিল' },
};

export const SAMPLE_HEADLINE = 'এখানে আপনার *হেডলাইন* এভাবে দেখা যাবে';

export function cleanSite(url) {
  return String(url || '')
    .trim()
    .replace(/^https?:\/\//i, '')
    .replace(/^www\./i, '')
    .replace(/\/+$/, '');
}

/**
 * Draw one card.
 * input = { state, brand, photo, logo }  (photo/logo: canvas or image, or null)
 * scale < 1 is used for the small template thumbnails.
 */
export function renderCard(canvas, input, scale = 1) {
  const { state, brand } = input;
  const fmt = FORMATS[state.format] || FORMATS.square;
  const tpl = TEMPLATE_MAP[state.template] || TEMPLATE_MAP.breaking;
  const W = fmt.w;
  const H = fmt.h;

  canvas.width = Math.max(1, Math.round(W * scale));
  canvas.height = Math.max(1, Math.round(H * scale));
  const ctx = canvas.getContext('2d');
  ctx.save();
  ctx.scale(scale, scale);
  ctx.textBaseline = 'alphabetic';

  const u = Math.min(W, H) / 1080;
  const k = W / H > 1.5 ? 1.25 : 1;
  const A = state.accent || brand.accent;
  const textScale = state.textScale || 1;
  const c = {
    W, H, u, k, state, brand,
    photo: tpl.usesPhoto ? input.photo || null : null,
    logo: input.logo || null,
    P: brand.primary,
    A,
    // highlight colour that stays readable on light backgrounds
    hlLight: luminance(A) > 0.5 ? shade(A, -0.45) : A,
    font: state.fontKey && state.fontKey !== 'auto' && FONTS[state.fontKey] ? state.fontKey : tpl.font,
    site: cleanSite(brand.website),
    headline: (state.headline || '').trim() || SAMPLE_HEADLINE,
    size: (base) => base * u * k * textScale,
  };

  tpl.draw(ctx, c);
  ctx.restore();
}

/** Make sure the web fonts needed for these texts are loaded before drawing on a canvas. */
export async function ensureFonts(state, brand) {
  if (!document.fonts || !document.fonts.load) return;
  const tpl = TEMPLATE_MAP[state.template] || TEMPLATE_MAP.breaking;
  const key = state.fontKey && state.fontKey !== 'auto' && FONTS[state.fontKey] ? state.fontKey : tpl.font;
  const sample = [state.headline, state.subtitle, state.category, state.speaker, state.date, brand.name, brand.website, 'শোক সংবাদ ব্রেকিং নিউজ সর্বশেষ খেলার খবর অআকখ০১২৩৪৫৬৭৮৯']
    .filter(Boolean)
    .join(' ')
    .replace(/\*/g, '');
  const wanted = new Set([key, 'hind', 'tiro']);
  const jobs = [];
  for (const k of wanted) {
    const f = FONTS[k];
    jobs.push(document.fonts.load(`${f.weight} 40px "${f.family}"`, sample));
    if (k === 'hind') jobs.push(document.fonts.load(`500 40px "${f.family}"`, sample), document.fonts.load(`600 40px "${f.family}"`, sample));
  }
  // Never wait long: if the font host is slow or blocked, the fallback font is used.
  await Promise.race([Promise.allSettled(jobs), new Promise((r) => setTimeout(r, 3500))]);
}

export { fontStack };
