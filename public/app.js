import { renderCard, ensureFonts, FORMATS } from './render.js';
import { TEMPLATES } from './templates.js';
import { FONTS } from './draw.js';

const $ = (s) => document.querySelector(s);
const FN = '/.netlify/functions/';
const MAX_PHOTOS = 4;
const MAX_PHOTO_PX = 2000;

const DEFAULT_BRAND = { name: '', website: '', primary: '#0f766e', accent: '#f59e0b', logoData: '' };

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

const prefs = store.get('anc.prefs', {});
const state = {
  headline: '',
  subtitle: '',
  category: '',
  speaker: '',
  date: bnDate(),
  template: TEMPLATES.some((t) => t.id === prefs.template) ? prefs.template : 'breaking',
  format: FORMATS[prefs.format] ? prefs.format : 'square',
  fontKey: prefs.fontKey === 'auto' || FONTS[prefs.fontKey] ? prefs.fontKey : 'auto',
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
  store.set('anc.prefs', { template: state.template, format: state.format, fontKey: state.fontKey, textScale: state.textScale });
}

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
  const t = toCanvas(c, 220);
  return t.toDataURL('image/jpeg', 0.75);
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
    img.decode ? (img.src = url, await img.decode()) : await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = url; });
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
    b.setAttribute('aria-label', 'ছবি ' + (i + 1));
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
      toast('সর্বোচ্চ ' + MAX_PHOTOS + 'টি ছবি দেওয়া যায়');
      break;
    }
    try {
      await addPhotoFromBlob(f);
      if (photoSel < 0) photoSel = photos.length - 1;
    } catch {
      failed++;
    }
  }
  if (failed) toast(failed + 'টি ছবি খোলা যায়নি (JPG বা PNG দিন)');
  syncAdjust();
  drawPhotoList();
  requestRender();
});

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
  return 'কিছু একটা সমস্যা হয়েছে (কোড ' + res.status + ')';
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
    await Promise.all(
      (data.images || []).map(async (src) => {
        try {
          const r = await fetch(FN + 'proxy-image?url=' + encodeURIComponent(src));
          if (!r.ok) return;
          const blob = await r.blob();
          const bmp = await decodeBlob(blob);
          const c = toCanvas(bmp, MAX_PHOTO_PX);
          if (bmp.close) bmp.close();
          if (c.width < 200 || c.height < 120) return;
          photos.push({ id: nextPhotoId++, canvas: c, thumb: makeThumb(c), order: (data.images || []).indexOf(src) });
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
    requestRender();

    if (!data.title) setStatus(status, 'ছবি এসেছে, তবে হেডলাইন পাওয়া যায়নি — নিজে লিখে নিন।', 'ok');
    else if (!got) setStatus(status, 'হেডলাইন এসেছে, কিন্তু ছবি পাওয়া যায়নি — নিজে ছবি দিন।', 'ok');
    else setStatus(status, '✓ হেডলাইন ও ' + got + 'টি ছবি এসেছে। চাইলে নিচে বদলে নিন।', 'ok');
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

function bind(id, key) {
  const el = $(id);
  el.value = state[key] || '';
  el.addEventListener('input', () => {
    state[key] = el.value;
    requestRender();
  });
}
bind('#headline', 'headline');
bind('#subtitle', 'subtitle');
bind('#category', 'category');
bind('#speaker', 'speaker');
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
    (data.headlines || []).forEach((h) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'chip';
      b.textContent = h.replace(/\*/g, '');
      b.addEventListener('click', () => {
        $('#headline').value = h;
        state.headline = h;
        requestRender();
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

/* ---------- templates, formats, design ---------- */

const tplButtons = new Map();
function buildTemplates() {
  const box = $('#tplList');
  TEMPLATES.forEach((t) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'tpl';
    b.setAttribute('role', 'option');
    const c = document.createElement('canvas');
    c.setAttribute('aria-hidden', 'true');
    const s = document.createElement('span');
    s.textContent = t.label;
    b.append(c, s);
    b.addEventListener('click', () => {
      state.template = t.id;
      savePrefs();
      refreshSelection();
      requestRender();
      if (t.id === 'quote') $('#more').open = true;
    });
    box.append(b);
    tplButtons.set(t.id, { b, c });
  });
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
      requestRender();
    });
    box.append(b);
  });
}

function refreshSelection() {
  tplButtons.forEach(({ b }, id) => b.setAttribute('aria-selected', String(id === state.template)));
  document.querySelectorAll('#fmtList button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.id === state.format)));
  $('#speakerField').hidden = state.template !== 'quote';
}

function buildFonts() {
  const sel = $('#fontSel');
  const auto = document.createElement('option');
  auto.value = 'auto';
  auto.textContent = 'টেমপ্লেটের নিজস্ব ফন্ট';
  sel.append(auto);
  Object.entries(FONTS).forEach(([k, f]) => {
    const o = document.createElement('option');
    o.value = k;
    o.textContent = f.label;
    sel.append(o);
  });
  sel.value = state.fontKey;
  sel.addEventListener('change', () => {
    state.fontKey = sel.value;
    savePrefs();
    requestRender();
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
let thumbTimer;

function requestRender() {
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
    thumbTimer = setTimeout(drawThumbs, 280);
  });
}

function input() {
  return { state, brand, photo: currentPhoto(), logo: logoImg };
}

function drawMain() {
  renderCard(canvas, input(), 1);
  const f = FORMATS[state.format];
  canvas.setAttribute('aria-label', 'নিউজ কার্ড, ' + f.w + '×' + f.h);
}

function drawThumbs() {
  const f = FORMATS[state.format];
  const scale = 260 / f.w;
  const base = input();
  tplButtons.forEach(({ c }, id) => {
    try {
      renderCard(c, { ...base, state: { ...state, template: id } }, scale);
    } catch (e) {
      console.error(e);
    }
  });
}

/* ---------- download / share ---------- */

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
    toast('ডাউনলোড শুরু হয়েছে');
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
  requestRender();
  toast(saved ? 'ব্র্যান্ড সেভ হয়েছে' : 'এই সেশনের জন্য বসানো হয়েছে (ব্রাউজার সেভ করতে দিচ্ছে না)');
});

function updateBanner() {
  $('#brandBanner').hidden = !!(brand.name || brand.logoData || brand.website);
}

/* ---------- start ---------- */

async function init() {
  buildTemplates();
  buildFormats();
  buildFonts();
  refreshSelection();
  drawPhotoList();
  syncAdjust();
  $('#accent').value = state.accent || brand.accent;
  updateBanner();
  logoImg = await loadLogo(brand.logoData);

  const q = new URLSearchParams(location.search).get('url');
  if (q && looksLikeUrl(q)) $('#newsUrl').value = q;

  requestRender();
}
init();
