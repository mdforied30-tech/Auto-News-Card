import { renderCard, ensureFonts, FORMATS } from './render.js';
import { TEMPLATES, TEMPLATE_CATS } from './templates.js';
import { FONTS } from './draw.js';

const $ = (s) => document.querySelector(s);
const FN = '/.netlify/functions/';
const MAX_PHOTOS = 4;
const MAX_PHOTO_PX = 2000;
const MAX_CUSTOM_FONTS = 6;
const DEFAULT_CTA = 'বিস্তারিত কমেন্টে';
const FONT_SAMPLE = 'আমার সংবাদ শোক ব্রেকিং খেলা অআকখগ ০১২৩৪৫৬৭৮৯';

const DEFAULT_BRAND = { name: '', website: '', primary: '#0f766e', accent: '#f59e0b', logoData: '' };
const bn = (v) => String(v).replace(/\d/g, (d) => '০১২৩৪৫৬৭৮৯'[d]);

/* ---------- storage (never trust it to exist) ---------- */

const store = {
  get(key, fallback) {
    try {
      const v = localStorage.getItem(key);
      return v ? JSON.parse(v) : fallback;
    } catch {
      return fallback;
    }
  },
  set(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch {
      return false;
    }
  },
};

/* ---------- state ---------- */

function bnDate() {
  try {
    return new Intl.DateTimeFormat('bn-BD', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date());
  } catch {
    return new Date().toLocaleDateString();
  }
}

const prefs = store.get('anc.prefs', {}) || {};
const state = {
  headline: '',
  subtitle: '',
  category: '',
  speaker: '',
  cta: typeof prefs.cta === 'string' ? prefs.cta : DEFAULT_CTA,
  date: bnDate(),
  template: TEMPLATES.some((t) => t.id === prefs.template) ? prefs.template : 'breaking',
  format: FORMATS[prefs.format] ? prefs.format : 'square',
  fontKey: typeof prefs.fontKey === 'string' ? prefs.fontKey : 'auto', // checked again after custom fonts load
  accent: '',
  textScale: typeof prefs.textScale === 'number' && prefs.textScale >= 0.7 && prefs.textScale <= 1.3 ? prefs.textScale : 1,
  focusX: 0.5,
  focusY: 0.5,
  zoom: 1,
};

const savedBrand = store.get('anc.brand', {});
let brand = { ...DEFAULT_BRAND, ...(savedBrand && typeof savedBrand === 'object' ? savedBrand : {}) };
let logoImg = null;

const photos = []; // { id, canvas, thumb }
let photoSel = -1;
let nextPhotoId = 1;
let newsMeta = { description: '', siteName: '' };

const canvas = $('#canvas');

/* ---------- tiny UI helpers ---------- */

let toastTimer;
function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2600);
}

function setStatus(el, msg, kind) {
  el.textContent = msg || '';
  el.className = 'status' + (kind ? ' ' + kind : '');
}

function savePrefs() {
  store.set('anc.prefs', { template: state.template, format: state.format, fontKey: state.fontKey, textScale: state.textScale, cta: state.cta });
}

/* ---------- page zoom (A− / A+) ---------- */

const UI_MIN = 70;
const UI_MAX = 124;
const UI_STEP = 6;
let uiPct = Number(store.get('anc.ui', 88));
if (!Number.isFinite(uiPct) || uiPct < UI_MIN || uiPct > UI_MAX) uiPct = 88;

function applyUi() {
  document.documentElement.style.fontSize = (16 * uiPct) / 100 + 'px';
  $('#zoomVal').textContent = bn(uiPct) + '%';
  $('#zoomOut').disabled = uiPct <= UI_MIN;
  $('#zoomIn').disabled = uiPct >= UI_MAX;
  measurePreview();
}
function stepUi(d) {
  uiPct = Math.max(UI_MIN, Math.min(UI_MAX, uiPct + d * UI_STEP));
  store.set('anc.ui', uiPct);
  applyUi();
}
$('#zoomOut').addEventListener('click', () => stepUi(-1));
$('#zoomIn').addEventListener('click', () => stepUi(1));

/** The tab bar sticks right under the (sticky) preview, so it needs to know the preview's height. */
function measurePreview() {
  const p = $('#preview');
  document.documentElement.style.setProperty('--prev-h', p.offsetHeight + 'px');
}
if (window.ResizeObserver) new ResizeObserver(measurePreview).observe($('#preview'));
window.addEventListener('resize', measurePreview);

/* ---------- images ---------- */

function toCanvas(source, maxPx) {
  const w = source.width || source.naturalWidth;
  const h = source.height || source.naturalHeight;
  const s = Math.min(1, maxPx / Math.max(w, h));
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w * s));
  c.height = Math.max(1, Math.round(h * s));
  const ctx = c.getContext('2d');
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(source, 0, 0, c.width, c.height);
  return c;
}

function makeThumb(c) {
  return toCanvas(c, 220).toDataURL('image/jpeg', 0.75);
}

async function decodeBlob(blob) {
  if (window.createImageBitmap) {
    try {
      return await createImageBitmap(blob);
    } catch {
      /* fall through to <img> */
    }
  }
  const url = URL.createObjectURL(blob);
  try {
    const img = new Image();
    img.decode ? ((img.src = url), await img.decode()) : await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = url; });
    return img;
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function addPhotoFromBlob(blob) {
  if (photos.length >= MAX_PHOTOS) return false;
  const bmp = await decodeBlob(blob);
  const c = toCanvas(bmp, MAX_PHOTO_PX);
  if (bmp.close) bmp.close();
  photos.push({ id: nextPhotoId++, canvas: c, thumb: makeThumb(c) });
  return true;
}

function selectPhoto(i) {
  photoSel = i;
  state.focusX = 0.5;
  state.focusY = 0.5;
  state.zoom = 1;
  syncAdjust();
  drawPhotoList();
  requestRender();
}

function removePhoto(i) {
  photos.splice(i, 1);
  if (photoSel >= photos.length) photoSel = photos.length - 1;
  if (!photos.length) photoSel = -1;
  syncAdjust();
  drawPhotoList();
  requestRender();
}

function drawPhotoList() {
  const box = $('#photoList');
  box.textContent = '';
  photos.forEach((p, i) => {
    const b = document.createElement('div');
    b.className = 'ph';
    b.tabIndex = 0;
    b.setAttribute('role', 'button');
    b.setAttribute('aria-pressed', String(i === photoSel));
    b.setAttribute('aria-label', 'ছবি ' + bn(i + 1));
    const img = document.createElement('img');
    img.src = p.thumb;
    img.alt = '';
    const x = document.createElement('button');
    x.type = 'button';
    x.className = 'x';
    x.textContent = '×';
    x.setAttribute('aria-label', 'ছবিটি সরান');
    x.addEventListener('click', (e) => {
      e.stopPropagation();
      removePhoto(i);
    });
    b.append(img, x);
    b.addEventListener('click', () => selectPhoto(i));
    b.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        selectPhoto(i);
      }
    });
    box.append(b);
  });
  if (photos.length < MAX_PHOTOS) {
    const add = document.createElement('button');
    add.type = 'button';
    add.className = 'ph-add';
    const plus = document.createElement('span');
    plus.textContent = '+';
    add.append(plus, 'ছবি দিন');
    add.addEventListener('click', () => $('#photoInput').click());
    box.append(add);
  }
}

function syncAdjust() {
  $('#adjust').hidden = photoSel < 0;
  $('#focusX').value = state.focusX;
  $('#focusY').value = state.focusY;
  $('#zoom').value = state.zoom;
}

const currentPhoto = () => (photoSel >= 0 && photos[photoSel] ? photos[photoSel].canvas : null);

$('#photoInput').addEventListener('change', async (e) => {
  const files = Array.from(e.target.files || []);
  e.target.value = '';
  let failed = 0;
  for (const f of files) {
    if (photos.length >= MAX_PHOTOS) {
      toast('সর্বোচ্চ ' + bn(MAX_PHOTOS) + 'টি ছবি দেওয়া যায়');
      break;
    }
    try {
      await addPhotoFromBlob(f);
      if (photoSel < 0) photoSel = photos.length - 1;
    } catch {
      failed++;
    }
  }
  if (failed) toast(bn(failed) + 'টি ছবি খোলা যায়নি (JPG বা PNG দিন)');
  syncAdjust();
  drawPhotoList();
  requestRender();
});

/** A nice-looking stand-in photo, used only in the small design previews while no photo is chosen. */
let placeholder = null;
function placeholderPhoto() {
  if (placeholder) return placeholder;
  const w = 1200;
  const h = 900;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const x = c.getContext('2d');
  const sky = x.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, '#2b5a8a');
  sky.addColorStop(0.55, '#e9a063');
  sky.addColorStop(1, '#2a3340');
  x.fillStyle = sky;
  x.fillRect(0, 0, w, h);
  x.fillStyle = 'rgba(255,232,170,.92)';
  x.beginPath();
  x.arc(w * 0.68, h * 0.46, h * 0.09, 0, Math.PI * 2);
  x.fill();
  let s = 11;
  const r = () => (s = (s * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < 26; i++) {
    const bw = w * (0.03 + r() * 0.05);
    const bh = h * (0.12 + r() * 0.3);
    x.fillStyle = `rgb(${20 + r() * 25},${28 + r() * 25},${44 + r() * 25})`;
    x.fillRect((i * w) / 24 - 10, h * 0.78 - bh, bw, bh + h);
  }
  x.fillStyle = '#16202b';
  x.fillRect(0, h * 0.8, w, h * 0.2);
  x.fillStyle = '#0b0f14';
  x.beginPath();
  x.arc(w * 0.32, h * 0.52, h * 0.07, 0, Math.PI * 2);
  x.fill();
  x.fillRect(w * 0.32 - h * 0.1, h * 0.58, h * 0.2, h * 0.3);
  placeholder = c;
  return c;
}

/* ---------- news link ---------- */

function looksLikeUrl(v) {
  try {
    const u = new URL(v);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

async function readError(res) {
  try {
    const j = await res.json();
    if (j && j.error) return j.error;
  } catch {
    /* not json */
  }
  if (res.status === 404) return 'ফাংশন পাওয়া যায়নি — সাইটটি Netlify-তে ডিপ্লয় করা আছে কি দেখুন';
  return 'কিছু একটা সমস্যা হয়েছে (কোড ' + bn(res.status) + ')';
}

let fetching = false;
async function fetchNews() {
  if (fetching) return;
  const status = $('#fetchStatus');
  const url = $('#newsUrl').value.trim();
  if (!looksLikeUrl(url)) {
    setStatus(status, 'সঠিক খবরের লিংক দিন (যেমন https://… দিয়ে শুরু)', 'err');
    return;
  }
  fetching = true;
  const btn = $('#fetchBtn');
  btn.disabled = true;
  btn.textContent = 'আনা হচ্ছে…';
  setStatus(status, 'খবর পড়া হচ্ছে…');
  try {
    let res;
    try {
      res = await fetch(FN + 'fetch-news?url=' + encodeURIComponent(url));
    } catch {
      throw new Error('ইন্টারনেট সংযোগ বা সার্ভারে সমস্যা, আবার চেষ্টা করুন');
    }
    if (!res.ok) throw new Error(await readError(res));
    const data = await res.json();

    if (data.title) {
      state.headline = data.title;
      $('#headline').value = data.title;
    }
    newsMeta = { description: data.description || '', siteName: data.siteName || '' };

    // Replace old photos with the ones from this article.
    photos.length = 0;
    photoSel = -1;
    let got = 0;
    const list = data.images || [];
    await Promise.all(
      list.map(async (src, order) => {
        try {
          const r = await fetch(FN + 'proxy-image?url=' + encodeURIComponent(src));
          if (!r.ok) return;
          const blob = await r.blob();
          const bmp = await decodeBlob(blob);
          const c = toCanvas(bmp, MAX_PHOTO_PX);
          if (bmp.close) bmp.close();
          if (c.width < 200 || c.height < 120) return;
          photos.push({ id: nextPhotoId++, canvas: c, thumb: makeThumb(c), order });
          got++;
        } catch {
          /* skip this image */
        }
      })
    );
    photos.sort((a, b) => a.order - b.order);
    if (photos.length) photoSel = 0;
    state.focusX = 0.5;
    state.focusY = 0.5;
    state.zoom = 1;
    syncAdjust();
    drawPhotoList();
    requestRender({ swap: true });

    if (!data.title) setStatus(status, 'ছবি এসেছে, তবে হেডলাইন পাওয়া যায়নি — নিজে লিখে নিন।', 'ok');
    else if (!got) setStatus(status, 'হেডলাইন এসেছে, কিন্তু ছবি পাওয়া যায়নি — নিজে ছবি দিন।', 'ok');
    else setStatus(status, '✓ হেডলাইন ও ' + bn(got) + 'টি ছবি এসেছে। চাইলে বদলে নিন।', 'ok');
  } catch (e) {
    setStatus(status, e.message || 'খবর আনা যায়নি', 'err');
  } finally {
    fetching = false;
    btn.disabled = false;
    btn.textContent = 'খবর আনুন';
  }
}

$('#fetchBtn').addEventListener('click', fetchNews);
$('#newsUrl').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    fetchNews();
  }
});
$('#pasteBtn').addEventListener('click', async () => {
  try {
    const t = (await navigator.clipboard.readText()).trim();
    if (!t) return toast('ক্লিপবোর্ড খালি');
    $('#newsUrl').value = t;
    if (looksLikeUrl(t)) fetchNews();
  } catch {
    toast('পেস্ট করার অনুমতি নেই — লিংক চেপে ধরে পেস্ট করুন');
  }
});

/* ---------- text fields ---------- */

function bind(id, key, after) {
  const el = $(id);
  el.value = state[key] || '';
  el.addEventListener('input', () => {
    state[key] = el.value;
    if (after) after();
    requestRender();
  });
}
bind('#headline', 'headline');
bind('#subtitle', 'subtitle');
bind('#category', 'category');
bind('#speaker', 'speaker');
bind('#cta', 'cta', savePrefs);
bind('#date', 'date');

$('#hlBtn').addEventListener('click', () => {
  const el = $('#headline');
  const plain = el.value.replace(/\*/g, '');
  if (!plain.trim()) return toast('আগে হেডলাইন লিখুন');
  if (/\*[^*]+\*/.test(el.value)) {
    el.value = plain; // second tap removes highlights
  } else {
    const words = plain.split(/(\s+)/);
    let idx = words.findIndex((w) => /[0-9০-৯]/.test(w));
    if (idx < 0) {
      let best = 0;
      words.forEach((w, i) => {
        if (/\S/.test(w) && w.length > (words[best] || '').length) best = i;
      });
      idx = best;
    }
    words[idx] = '*' + words[idx] + '*';
    el.value = words.join('');
  }
  state.headline = el.value;
  requestRender();
});

/* ---------- AI ---------- */

let aiBusy = false;
$('#aiBtn').addEventListener('click', async () => {
  if (aiBusy) return;
  const status = $('#aiStatus');
  const headline = $('#headline').value.replace(/\*/g, '').trim();
  if (headline.length < 4) return setStatus(status, 'আগে হেডলাইন লিখুন বা খবরের লিংক দিন', 'err');
  aiBusy = true;
  const btn = $('#aiBtn');
  btn.disabled = true;
  setStatus(status, 'AI ভাবছে…');
  try {
    let res;
    try {
      res = await fetch(FN + 'ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ headline, description: newsMeta.description, siteName: newsMeta.siteName || brand.name }),
      });
    } catch {
      throw new Error('ইন্টারনেট সংযোগ বা সার্ভারে সমস্যা, আবার চেষ্টা করুন');
    }
    if (!res.ok) throw new Error(await readError(res));
    const data = await res.json();

    const heads = $('#aiHeads');
    heads.textContent = '';
    (data.headlines || []).forEach((h, i) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'chip';
      b.style.setProperty('--i', i);
      b.textContent = h.replace(/\*/g, '');
      b.addEventListener('click', () => {
        $('#headline').value = h;
        state.headline = h;
        requestRender({ swap: true });
        toast('হেডলাইন বসানো হয়েছে');
      });
      heads.append(b);
    });
    const tags = (data.hashtags || []).join(' ');
    $('#aiCaption').value = [data.caption || '', tags].filter(Boolean).join('\n\n');
    $('#aiOut').hidden = false;
    setStatus(status, '✓ তৈরি হয়েছে', 'ok');
  } catch (e) {
    setStatus(status, e.message || 'AI কাজ করেনি', 'err');
  } finally {
    aiBusy = false;
    btn.disabled = false;
  }
});

$('#copyCaption').addEventListener('click', async () => {
  const el = $('#aiCaption');
  try {
    await navigator.clipboard.writeText(el.value);
    toast('ক্যাপশন কপি হয়েছে');
  } catch {
    el.select();
    toast('সিলেক্ট করা হয়েছে — কপি করে নিন');
  }
});

/* ---------- tabs ---------- */

const TABS = ['news', 'text', 'design', 'style'];

function showTab(name, scroll) {
  if (!TABS.includes(name)) return;
  TABS.forEach((t) => {
    const on = t === name;
    $('#tab-' + t).setAttribute('aria-selected', String(on));
    $('#tab-' + t).tabIndex = on ? 0 : -1;
    $('#p-' + t).hidden = !on;
  });
  if (scroll) {
    // Only scroll when the page has been scrolled past the top of the editor.
    const tabs = $('#tabs');
    const top = $('#editor').getBoundingClientRect().top;
    const limit = tabs.getBoundingClientRect().bottom;
    if (top < limit - 4) window.scrollBy({ top: top - limit - 8, behavior: 'smooth' });
  }
  if (name === 'design') queueVisibleThumbs();
}

document.querySelectorAll('.tab').forEach((b) => {
  b.addEventListener('click', () => showTab(b.dataset.tab, true));
  b.addEventListener('keydown', (e) => {
    const i = TABS.indexOf(b.dataset.tab);
    let n = -1;
    if (e.key === 'ArrowRight') n = (i + 1) % TABS.length;
    if (e.key === 'ArrowLeft') n = (i + TABS.length - 1) % TABS.length;
    if (n >= 0) {
      e.preventDefault();
      showTab(TABS[n], false);
      $('#tab-' + TABS[n]).focus();
    }
  });
});
document.querySelectorAll('[data-go]').forEach((b) => b.addEventListener('click', () => showTab(b.dataset.go, true)));

/* ---------- design: categories, templates, sizes ---------- */

const tplButtons = new Map(); // id -> { b, c, t }
const canvasToTpl = new Map(); // canvas -> template id
let curCat = 'all';

function buildCats() {
  const box = $('#catList');
  TEMPLATE_CATS.forEach((cat) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'cat';
    b.dataset.cat = cat.id;
    b.textContent = cat.label;
    b.addEventListener('click', () => {
      curCat = cat.id;
      applyCat();
    });
    box.append(b);
  });
}

function applyCat() {
  let n = 0;
  tplButtons.forEach(({ b, t }) => {
    const show = curCat === 'all' || t.cat === curCat;
    b.hidden = !show;
    if (show) b.style.setProperty('--i', n++);
  });
  $('#tplCount').textContent = '(' + bn(n) + 'টি)';
  document.querySelectorAll('.cat').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.cat === curCat)));
}

function buildTemplates() {
  const box = $('#tplList');
  TEMPLATES.forEach((t) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'tpl';
    b.setAttribute('role', 'option');
    b.setAttribute('aria-label', t.label);
    const c = document.createElement('canvas');
    c.setAttribute('aria-hidden', 'true');
    const s = document.createElement('span');
    s.textContent = t.label;
    b.append(c, s);
    b.addEventListener('click', () => selectTemplate(t.id));
    box.append(b);
    tplButtons.set(t.id, { b, c, t });
    canvasToTpl.set(c, t.id);
    thumbObserver && thumbObserver.observe(c);
  });
}

function selectTemplate(id) {
  state.template = id;
  savePrefs();
  refreshSelection();
  requestRender({ swap: true });
  if (id === 'quote' || id === 'quoteRing') toast('বক্তার নাম ও পরিচয় "লেখা" ট্যাবে দিন');
}

function buildFormats() {
  const box = $('#fmtList');
  Object.entries(FORMATS).forEach(([id, f]) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.dataset.id = id;
    const big = document.createElement('b');
    big.textContent = f.label;
    const small = document.createElement('small');
    small.textContent = f.note;
    b.append(big, small);
    b.addEventListener('click', () => {
      state.format = id;
      savePrefs();
      refreshSelection();
      requestRender({ swap: true });
    });
    box.append(b);
  });
}

function refreshSelection() {
  tplButtons.forEach(({ b }, id) => b.setAttribute('aria-selected', String(id === state.template)));
  document.querySelectorAll('#fmtList button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.id === state.format)));
  $('#tplList').dataset.fmt = state.format;
  $('#speakerField').hidden = !(state.template === 'quote' || state.template === 'quoteRing');
}

/* ---------- design thumbnails: drawn only when they scroll into view ---------- */

const visibleThumbs = new Set();
const thumbQueue = new Set();
let thumbRunning = false;

const thumbObserver =
  typeof IntersectionObserver === 'function'
    ? new IntersectionObserver(
        (entries) => {
          for (const e of entries) {
            if (e.isIntersecting) {
              visibleThumbs.add(e.target);
              thumbQueue.add(e.target);
            } else visibleThumbs.delete(e.target);
          }
          runThumbs();
        },
        { rootMargin: '160px' }
      )
    : null;

function queueVisibleThumbs() {
  visibleThumbs.forEach((c) => thumbQueue.add(c));
  runThumbs();
}

const fontReady = new Map();
function loadFontKey(key) {
  if (fontReady.has(key)) return fontReady.get(key);
  const f = FONTS[key] || FONTS.hind;
  const job =
    document.fonts && document.fonts.load
      ? Promise.race([document.fonts.load(`${f.weight} 40px "${f.family}"`, FONT_SAMPLE).catch(() => {}), new Promise((r) => setTimeout(r, 3500))])
      : Promise.resolve();
  fontReady.set(key, job);
  return job;
}

async function runThumbs() {
  if (thumbRunning) return;
  thumbRunning = true;
  try {
    while (thumbQueue.size) {
      const cv = thumbQueue.values().next().value;
      thumbQueue.delete(cv);
      if (!visibleThumbs.has(cv)) continue;
      const id = canvasToTpl.get(cv);
      const entry = tplButtons.get(id);
      if (!entry) continue;
      const key = state.fontKey && state.fontKey !== 'auto' && FONTS[state.fontKey] ? state.fontKey : entry.t.font;
      await loadFontKey(key);
      if (!visibleThumbs.has(cv)) continue;
      try {
        const f = FORMATS[state.format];
        renderCard(cv, { state: { ...state, template: id }, brand, photo: currentPhoto() || placeholderPhoto(), logo: logoImg }, 230 / f.w);
      } catch (e) {
        console.error(e);
      }
      await new Promise((r) => setTimeout(r, 0));
    }
  } finally {
    thumbRunning = false;
  }
}

/* ---------- fonts ---------- */

function sampleFamily(key) {
  const f = FONTS[key];
  return f ? `"${f.family}", "Hind Siliguri", sans-serif` : '';
}

function buildFonts() {
  const box = $('#fontList');
  box.textContent = '';
  const items = [['auto', { label: 'টেমপ্লেটের নিজস্ব ফন্ট', family: 'Hind Siliguri', weight: 700 }], ...Object.entries(FONTS)];
  items.forEach(([key, f], i) => {
    const custom = !!f.custom;
    const b = document.createElement(custom ? 'div' : 'button');
    if (!custom) b.type = 'button';
    else b.tabIndex = 0;
    b.className = 'fontbtn';
    b.dataset.key = key;
    b.setAttribute('role', 'option');
    b.style.setProperty('--i', i);
    const label = document.createElement('small');
    label.textContent = f.label;
    const sample = document.createElement('span');
    sample.className = 'sample';
    sample.textContent = 'আমার সংবাদ ১২৩';
    sample.style.fontFamily = key === 'auto' ? '"Hind Siliguri", sans-serif' : sampleFamily(key);
    sample.style.fontWeight = String(f.weight);
    b.append(label, sample);
    if (custom) {
      const del = document.createElement('button');
      del.type = 'button';
      del.className = 'fdel';
      del.textContent = '×';
      del.setAttribute('aria-label', 'ফন্টটি মুছুন');
      del.addEventListener('click', (e) => {
        e.stopPropagation();
        removeCustomFont(key);
      });
      b.append(del);
    }
    const choose = () => {
      state.fontKey = key;
      savePrefs();
      markFont();
      requestRender({ swap: true });
      queueVisibleThumbs();
    };
    b.addEventListener('click', choose);
    if (custom) b.addEventListener('keydown', (e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), choose()));
    box.append(b);
  });
  markFont();
}

function markFont() {
  document.querySelectorAll('.fontbtn').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.key === state.fontKey)));
}

/* ---------- your own fonts (saved in this browser with IndexedDB) ---------- */

function openDb() {
  return new Promise((res, rej) => {
    if (!window.indexedDB) return rej(new Error('no indexedDB'));
    const r = indexedDB.open('anc-fonts', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('fonts', { keyPath: 'id' });
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}
async function dbRun(mode, fn) {
  const db = await openDb();
  return new Promise((res, rej) => {
    const tx = db.transaction('fonts', mode);
    const req = fn(tx.objectStore('fonts'));
    tx.oncomplete = () => res(req && req.result);
    tx.onerror = () => rej(tx.error);
    tx.onabort = () => rej(tx.error);
  });
}

async function registerCustomFont(rec) {
  const face = new FontFace(rec.family, rec.data, { weight: '100 900' });
  await face.load();
  document.fonts.add(face);
  FONTS[rec.key] = { label: rec.name, family: rec.family, weight: 700, custom: true };
}

async function loadCustomFonts() {
  try {
    const all = (await dbRun('readonly', (s) => s.getAll())) || [];
    for (const rec of all.slice(0, MAX_CUSTOM_FONTS)) {
      try {
        await registerCustomFont(rec);
      } catch {
        /* broken font file: skip it */
      }
    }
  } catch {
    /* IndexedDB blocked: custom fonts just won't be remembered */
  }
}

async function removeCustomFont(key) {
  const f = FONTS[key];
  if (!f) return;
  const id = Number(String(key).replace('cf', ''));
  delete FONTS[key];
  fontReady.delete(key);
  try {
    await dbRun('readwrite', (s) => s.delete(id));
  } catch {
    /* ignore */
  }
  if (state.fontKey === key) {
    state.fontKey = 'auto';
    savePrefs();
  }
  buildFonts();
  requestRender();
  queueVisibleThumbs();
  toast('ফন্ট মুছে ফেলা হয়েছে');
}

$('#fontAdd').addEventListener('click', () => {
  if (Object.values(FONTS).filter((f) => f.custom).length >= MAX_CUSTOM_FONTS) return toast('সর্বোচ্চ ' + bn(MAX_CUSTOM_FONTS) + 'টি নিজের ফন্ট রাখা যায়');
  $('#fontFile').click();
});
$('#fontFile').addEventListener('change', async (e) => {
  const file = e.target.files && e.target.files[0];
  e.target.value = '';
  if (!file) return;
  if (!/\.(ttf|otf|woff2?)$/i.test(file.name)) return toast('শুধু .ttf, .otf বা .woff ফন্ট চলবে');
  if (file.size > 8 * 1024 * 1024) return toast('ফন্ট ফাইলটি অনেক বড় (৮ MB এর কম দিন)');
  try {
    const data = await file.arrayBuffer();
    const id = Date.now();
    const name = file.name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim().slice(0, 28) || 'আমার ফন্ট';
    const rec = { id, key: 'cf' + id, family: 'ANC Custom ' + id, name, data };
    await registerCustomFont(rec);
    let saved = true;
    try {
      await dbRun('readwrite', (s) => s.put(rec));
    } catch {
      saved = false;
    }
    state.fontKey = rec.key;
    savePrefs();
    buildFonts();
    requestRender({ swap: true });
    queueVisibleThumbs();
    toast(saved ? 'ফন্ট যোগ হয়েছে ✓' : 'ফন্ট যোগ হয়েছে (এই সেশনের জন্য)');
  } catch {
    toast('ফন্টটি খোলা যায়নি, অন্য ফাইল দিন');
  }
});

/* ---------- colours, size, photo position ---------- */

const SWATCHES = ['#f59e0b', '#fbbf24', '#ef4444', '#f97316', '#22c55e', '#06b6d4', '#3b82f6', '#a855f7', '#ec4899', '#ffffff'];
function buildSwatches() {
  const box = $('#swatches');
  SWATCHES.forEach((col) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'sw';
    b.style.background = col;
    b.setAttribute('aria-label', 'রং ' + col);
    b.addEventListener('click', () => {
      state.accent = col;
      $('#accent').value = col;
      requestRender();
    });
    box.append(b);
  });
}
$('#accent').addEventListener('input', (e) => {
  state.accent = e.target.value;
  requestRender();
});
$('#accentReset').addEventListener('click', () => {
  state.accent = '';
  $('#accent').value = brand.accent;
  requestRender();
});
$('#textScale').value = state.textScale;
$('#textScale').addEventListener('input', (e) => {
  state.textScale = Number(e.target.value);
  savePrefs();
  requestRender();
});
['focusX', 'focusY', 'zoom'].forEach((k) => {
  $('#' + k).addEventListener('input', (e) => {
    state[k] = Number(e.target.value);
    requestRender();
  });
});

/* ---------- drawing ---------- */

let renderQueued = false;
let swapNext = false;
let thumbTimer;

function requestRender(opts) {
  if (opts && opts.swap) swapNext = true;
  if (renderQueued) return;
  renderQueued = true;
  requestAnimationFrame(async () => {
    renderQueued = false;
    try {
      await ensureFonts(state, brand);
      drawMain();
    } catch (e) {
      console.error(e);
    }
    clearTimeout(thumbTimer);
    thumbTimer = setTimeout(queueVisibleThumbs, 260);
  });
}

function input() {
  return { state, brand, photo: currentPhoto(), logo: logoImg };
}

function drawMain() {
  renderCard(canvas, input(), 1);
  const f = FORMATS[state.format];
  canvas.setAttribute('aria-label', 'নিউজ কার্ড, ' + bn(f.w) + '×' + bn(f.h));
  if (swapNext) {
    swapNext = false;
    canvas.classList.remove('swap');
    void canvas.offsetWidth; // restart the pop animation
    canvas.classList.add('swap');
  }
  measurePreview();
}

/* ---------- download / share / big preview ---------- */

function fileName(ext) {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `auto-news-card-${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}.${ext}`;
}

async function renderBlob(type) {
  await ensureFonts(state, brand);
  const c = document.createElement('canvas');
  renderCard(c, input(), 1);
  const blob = await new Promise((res) => c.toBlob(res, type, 0.93));
  if (!blob) throw new Error('ছবি তৈরি করা যায়নি');
  return blob;
}

let popTimer;
function celebrate() {
  const pop = $('#donePop');
  const box = $('#confetti');
  box.textContent = '';
  const colors = ['#14b8a6', '#f59e0b', '#ec4899', '#6366f1', '#22c55e', '#ef4444'];
  for (let i = 0; i < 28; i++) {
    const e = document.createElement('i');
    const a = Math.random() * Math.PI * 2;
    const d = 70 + Math.random() * 130;
    e.style.setProperty('--dx', Math.cos(a) * d + 'px');
    e.style.setProperty('--dy', Math.sin(a) * d - 50 + 'px');
    e.style.setProperty('--rot', Math.round(Math.random() * 720 - 360) + 'deg');
    e.style.setProperty('--d', String(Math.round(Math.random() * 140)));
    e.style.background = colors[i % colors.length];
    box.append(e);
  }
  pop.hidden = false;
  clearTimeout(popTimer);
  popTimer = setTimeout(() => (pop.hidden = true), 1900);
}
$('#donePop').addEventListener('click', () => {
  $('#donePop').hidden = true;
});

async function download(type, ext) {
  try {
    const blob = await renderBlob(type);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName(ext);
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
    celebrate();
  } catch (e) {
    toast(e.message || 'ডাউনলোড করা যায়নি');
  }
}
$('#dlPng').addEventListener('click', () => download('image/png', 'png'));
$('#dlJpg').addEventListener('click', () => download('image/jpeg', 'jpg'));

(function setupShare() {
  try {
    const probe = new File([new Blob(['x'], { type: 'image/png' })], 'a.png', { type: 'image/png' });
    if (!(navigator.canShare && navigator.canShare({ files: [probe] }))) return;
  } catch {
    return;
  }
  const btn = $('#shareBtn');
  btn.hidden = false;
  btn.addEventListener('click', async () => {
    try {
      const blob = await renderBlob('image/png');
      await navigator.share({ files: [new File([blob], fileName('png'), { type: 'image/png' })] });
    } catch (e) {
      if (e && e.name !== 'AbortError') toast('শেয়ার করা যায়নি');
    }
  });
})();

const viewDlg = $('#viewDlg');
let viewUrl = '';
function closeView() {
  if (viewDlg.close) viewDlg.close();
  else viewDlg.removeAttribute('open');
}
$('#previewOpen').addEventListener('click', async () => {
  try {
    const blob = await renderBlob('image/png');
    if (viewUrl) URL.revokeObjectURL(viewUrl);
    viewUrl = URL.createObjectURL(blob);
    $('#viewImg').src = viewUrl;
    if (typeof viewDlg.showModal === 'function') viewDlg.showModal();
    else viewDlg.setAttribute('open', '');
  } catch (e) {
    toast(e.message || 'প্রিভিউ খোলা যায়নি');
  }
});
$('#viewClose').addEventListener('click', closeView);
$('#viewDl').addEventListener('click', () => {
  closeView();
  download('image/png', 'png');
});
viewDlg.addEventListener('click', (e) => {
  if (e.target === viewDlg) closeView();
});
viewDlg.addEventListener('close', () => {
  if (viewUrl) {
    URL.revokeObjectURL(viewUrl);
    viewUrl = '';
    $('#viewImg').removeAttribute('src');
  }
});

/* ---------- brand setup ---------- */

const dlg = $('#brandDlg');
let draft = null;

function loadLogo(dataUrl) {
  return new Promise((resolve) => {
    if (!dataUrl) return resolve(null);
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = dataUrl;
  });
}

function showLogoPreview() {
  const box = $('#logoPrev');
  box.textContent = '';
  if (draft.logoData) {
    const img = document.createElement('img');
    img.src = draft.logoData;
    img.alt = 'লোগো';
    box.append(img);
  } else {
    const s = document.createElement('span');
    s.textContent = 'লোগো নেই';
    box.append(s);
  }
  $('#logoClear').hidden = !draft.logoData;
}

function openBrand() {
  draft = { ...brand };
  $('#bName').value = draft.name;
  $('#bSite').value = draft.website;
  $('#bPrimary').value = draft.primary;
  $('#bAccent').value = draft.accent;
  showLogoPreview();
  if (typeof dlg.showModal === 'function') dlg.showModal();
  else dlg.setAttribute('open', '');
}

function closeBrand() {
  if (dlg.close) dlg.close();
  else dlg.removeAttribute('open');
}

$('#openBrand').addEventListener('click', openBrand);
document.querySelectorAll('[data-open-brand]').forEach((b) => b.addEventListener('click', openBrand));
$('#brandCancel').addEventListener('click', closeBrand);
dlg.addEventListener('click', (e) => {
  if (e.target === dlg) closeBrand();
});
$('#logoPick').addEventListener('click', () => $('#logoInput').click());
$('#logoClear').addEventListener('click', () => {
  draft.logoData = '';
  showLogoPreview();
});
$('#logoInput').addEventListener('change', async (e) => {
  const f = e.target.files && e.target.files[0];
  e.target.value = '';
  if (!f) return;
  try {
    const bmp = await decodeBlob(f);
    const c = toCanvas(bmp, 600);
    if (bmp.close) bmp.close();
    draft.logoData = c.toDataURL('image/png');
    showLogoPreview();
  } catch {
    toast('লোগো খোলা যায়নি (PNG বা JPG দিন)');
  }
});

$('#brandForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  brand = {
    name: $('#bName').value.trim(),
    website: $('#bSite').value.trim(),
    primary: $('#bPrimary').value || DEFAULT_BRAND.primary,
    accent: $('#bAccent').value || DEFAULT_BRAND.accent,
    logoData: draft.logoData || '',
  };
  logoImg = await loadLogo(brand.logoData);
  const saved = store.set('anc.brand', brand);
  $('#accent').value = state.accent || brand.accent;
  updateBanner();
  closeBrand();
  requestRender({ swap: true });
  toast(saved ? 'ব্র্যান্ড সেভ হয়েছে ✓' : 'এই সেশনের জন্য বসানো হয়েছে (ব্রাউজার সেভ করতে দিচ্ছে না)');
});

function updateBanner() {
  $('#brandBanner').hidden = !!(brand.name || brand.logoData || brand.website);
}

/* ---------- start ---------- */

async function init() {
  applyUi();
  buildCats();
  buildTemplates();
  buildFormats();
  buildSwatches();
  applyCat();
  refreshSelection();
  drawPhotoList();
  syncAdjust();
  showTab('news', false);
  $('#accent').value = state.accent || brand.accent;
  updateBanner();

  await loadCustomFonts();
  if (state.fontKey !== 'auto' && !FONTS[state.fontKey]) state.fontKey = 'auto';
  buildFonts();
  logoImg = await loadLogo(brand.logoData);

  const q = new URLSearchParams(location.search).get('url');
  if (q && looksLikeUrl(q)) $('#newsUrl').value = q;

  requestRender();
}
init();
