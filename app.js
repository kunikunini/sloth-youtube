// New architecture: folder-based manifest -> header slider + character grid + per-character playlist modal + channel hero

let CURRENT_CHARACTER = null;
let CURRENT_VIDEO_ID = null;

// Assets that should not appear in the grid
function isHiddenFromGrid(item) {
  const p = String(item?.image || item?.src || '');
  const base = p.split('/').pop().toLowerCase();
  // Exclude the specific logo image from grid cards
  return base.includes('けんすうスピークロゴ');
}

async function loadManifest() {
  // Prefer folder-based manifest
  try {
    const res = await fetch('./SWC_youtube_project/manifest.json', { cache: 'no-cache' });
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data.characters)) return data.characters;
    }
  } catch (_) {}

  // Fallback to legacy data.js
  if (typeof CHARACTERS !== 'undefined') {
    const allVideos = Array.isArray(globalThis.VIDEOS) ? globalThis.VIDEOS : [];
    return CHARACTERS.map((c) => ({ image: c.src, alt: c.alt || '', videos: allVideos }));
  }
  return [];
}

function slugFromImage(p) {
  const s = String(p || '');
  const m = s.match(/([^\/]+)\.[^.]+$/);
  return (m ? m[1] : s).toLowerCase();
}

function buildSlider(characters) {
  const track = document.getElementById('slider-track');
  if (!track) return;
  track.innerHTML = '';

  const sequence = [...characters];
  const list = sequence.length ? [...sequence, ...sequence] : [];

  if (!list.length) {
    const ph = document.createElement('div');
    ph.style.padding = '8px 18px';
    ph.style.color = '#6f6a60';
    ph.textContent = 'キャラクター画像を SWC_youtube_project に配置してください';
    track.appendChild(ph);
    return;
  }

  list.forEach((c, i) => {
    const d = document.createElement('div');
    d.className = 'char-pill';
    d.style.backgroundImage = `url(${c.image || c.src})`;
    d.setAttribute('role', 'img');
    d.setAttribute('aria-label', c.alt || `character ${i + 1}`);
    const slug = slugFromImage(c.image || c.src);
    d.addEventListener('click', () => scrollToCard(slug));
    track.appendChild(d);
  });
}

function videoThumbUrl(id) {
  return `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
}

function buildChannelHero(heroCharacter) {
  const wrap = document.getElementById('channel-hero');
  if (!wrap) return;
  wrap.innerHTML = '';
  if (!heroCharacter) return;
  const a = document.createElement('a');
  a.className = 'channel-hero';
  a.href = 'https://www.youtube.com/@kensuu';
  a.target = '_blank';
  a.rel = 'noopener';
  a.setAttribute('aria-label', 'YouTubeチャンネル「@kensuu」を開く');

  const thumb = document.createElement('div');
  thumb.className = 'hero-thumb';
  // ヒーロー画像を「けんすうスピークロゴ.png」に差し替え（存在しない場合は従来画像にフォールバック）
  const preferredHero = './SWC_youtube_project/けんすうスピークロゴ.png';
  try {
    const probe = new Image();
    probe.onload = () => { thumb.style.backgroundImage = `url('${preferredHero}')`; };
    probe.onerror = () => { thumb.style.backgroundImage = `url('${heroCharacter.image || heroCharacter.src}')`; };
    probe.src = preferredHero;
  } catch (_) {
    thumb.style.backgroundImage = `url('${heroCharacter.image || heroCharacter.src}')`;
  }

  const overlay = document.createElement('div');
  overlay.className = 'hero-overlay';
  const label = document.createElement('div');
  label.className = 'hero-label';
  label.textContent = 'YouTubeチャンネル @kensuu';
  overlay.appendChild(label);

  a.appendChild(thumb);
  a.appendChild(overlay);
  wrap.appendChild(a);
}

function openModal(videoId) {
  const modal = document.getElementById('player-modal');
  const frame = document.getElementById('player-frame');
  if (!modal || !frame) return;
  frame.src = `https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0&modestbranding=1`;
  modal.setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';
}

function closeModal() {
  const modal = document.getElementById('player-modal');
  const frame = document.getElementById('player-frame');
  if (!modal || !frame) return;
  modal.setAttribute('aria-hidden', 'true');
  frame.src = '';
  document.body.style.overflow = '';
}

function buildCharacterGrid(characters) {
  const root = document.getElementById('gallery');
  if (!root) return;
  root.innerHTML = '';

  if (!characters || !characters.length) {
    const empty = document.createElement('div');
    empty.className = 'loading';
    empty.textContent = 'フォルダ内の画像が見つかりません (SWC_youtube_project)';
    root.appendChild(empty);
    return;
  }

  characters.forEach((c) => {
    const card = document.createElement('article');
    card.className = 'char-card';
    const slug = slugFromImage(c.image);
    card.id = `card-${slug}`;
    card.tabIndex = 0;
    card.setAttribute('role', 'button');
    card.setAttribute('aria-label', `${c.alt || 'character'} の動画を開く`);

    const thumb = document.createElement('div');
    thumb.className = 'char-thumb';
    thumb.style.backgroundImage = `url('${c.image}')`;

    const overlay = document.createElement('div');
    overlay.className = 'overlay';
    const play = document.createElement('div');
    play.className = 'play';
    overlay.appendChild(play);

    const meta = document.createElement('div');
    meta.className = 'meta';
    meta.innerHTML = `<div class="title">${c.alt || ''}</div>`;

    const badge = document.createElement('div');
    badge.className = 'badge';
    const count = Array.isArray(c.videos) ? c.videos.length : 0;
    badge.textContent = count ? `${count}本` : '未登録';

    card.appendChild(thumb);
    card.appendChild(overlay);
    card.appendChild(meta);
    card.appendChild(badge);

    const click = () => openCharacter(c);
    card.addEventListener('click', click);
    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); click(); }
    });

    root.appendChild(card);

    // Tint the thumbnail with the dominant color of the image
    applyDominantColor(thumb, c.image);
  });
}

function openCharacter(character) {
  CURRENT_CHARACTER = character;
  const first = character.videos && character.videos[0];
  if (first) {
    CURRENT_VIDEO_ID = first.id;
    openModal(first.id);
  } else {
    const modal = document.getElementById('player-modal');
    const frame = document.getElementById('player-frame');
    frame.src = '';
    modal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
  }
  renderPlaylist(character);
}

function renderPlaylist(character) {
  const list = document.getElementById('playlist');
  if (!list) return;
  list.innerHTML = '';
  const vids = Array.isArray(character.videos) ? character.videos : [];
  if (!vids.length) {
    const empty = document.createElement('div');
    empty.className = 'loading';
    empty.textContent = `${character.alt || 'このキャラクター'} の動画はまだ登録されていません`;
    list.appendChild(empty);
    return;
  }
  vids.forEach((v) => {
    const item = document.createElement('div');
    item.className = 'item';
    item.setAttribute('role', 'button');
    item.tabIndex = 0;
    item.innerHTML = `
      <div class="thumb" style="background-image:url('${videoThumbUrl(v.id)}')"></div>
      <div>
        <div class="title">${v.title || ''}</div>
        <div class="sub">${v.id}</div>
      </div>
      <div class="${CURRENT_VIDEO_ID === v.id ? 'playing' : ''}">${CURRENT_VIDEO_ID === v.id ? '再生中' : ''}</div>
    `;
    const select = () => {
      CURRENT_VIDEO_ID = v.id;
      openModal(v.id);
      renderPlaylist(character);
    };
    item.addEventListener('click', select);
    item.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); select(); }
    });
    list.appendChild(item);
  });
}

function wireModal() {
  const modal = document.getElementById('player-modal');
  const closeBtn = document.getElementById('modal-close');
  const backdrop = modal?.querySelector('[data-close]');
  closeBtn?.addEventListener('click', closeModal);
  backdrop?.addEventListener('click', closeModal);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeModal();
  });
}

document.addEventListener('DOMContentLoaded', async () => {
  try {
    const characters = await loadManifest();
    // detect special hero item: filename contains "kensuu" (ext不問)
    const hero = characters.find((c) => {
      const p = String(c.image || c.src || '').toLowerCase();
      return p.includes('kensuu');
    });
    buildChannelHero(hero);
    // Exclude hero from grid and explicitly hide certain assets (e.g., logo)
    const forGridBase = hero ? characters.filter((c) => (c.image || c.src) !== (hero.image || hero.src)) : characters;
    const forGrid = forGridBase.filter((c) => !isHiddenFromGrid(c));
    buildSlider(characters);
    buildCharacterGrid(forGrid);
    wireModal();

    // Generate compressed favicon from kuni_2.png
    setFaviconFromImage('./SWC_youtube_project/kuni_2.png');

    // Back-to-top button setup
    setupBackToTop();

    // Set header height CSS var for layout spacing
    updateHeaderHeight();
    window.addEventListener('resize', throttle(updateHeaderHeight, 150));

    // Hamburger menu interactions
    setupHamburger();

    // Header brand logo -> open mini player
    setupMiniPlayerTrigger();
  } catch (e) {
    console.error(e);
  }
});

// (Reverted) No JS slider interactions; CSS handles marquee animation for stability.

function setFaviconFromImage(src) {
  const link = document.getElementById('site-favicon') || (() => {
    const l = document.createElement('link');
    l.id = 'site-favicon';
    l.rel = 'icon';
    l.type = 'image/png';
    document.head.appendChild(l);
    return l;
  })();
  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.onload = () => {
    const size = 64; // 64x64 favicon
    const canvas = document.createElement('canvas');
    canvas.width = size; canvas.height = size;
    const ctx = canvas.getContext('2d');
    // cover-crop to square
    const { width: iw, height: ih } = img;
    const s = Math.max(size / iw, size / ih);
    const dw = iw * s, dh = ih * s;
    const dx = (size - dw) / 2, dy = (size - dh) / 2;
    ctx.drawImage(img, dx, dy, dw, dh);
    link.href = canvas.toDataURL('image/png');
  };
  img.onerror = () => {
    // fallback to source image
    link.href = src;
  };
  img.src = src;
}

function scrollToCard(slug) {
  const header = document.querySelector('.site-header');
  const headerH = header ? header.offsetHeight : 0;
  let target = null;
  if (slug.includes('kensuu')) {
    target = document.getElementById('channel-hero');
  } else {
    target = document.getElementById(`card-${slug}`);
  }
  if (!target) return;
  const rect = target.getBoundingClientRect();
  const y = window.scrollY + rect.top - Math.max(18, headerH + 12);
  window.scrollTo({ top: y, behavior: 'smooth' });
}

function setupBackToTop() {
  const btn = document.getElementById('back-to-top');
  if (!btn) return;
  const onScroll = () => {
    if (window.scrollY > 400) btn.classList.add('show');
    else btn.classList.remove('show');
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();
  btn.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
}

function updateHeaderHeight() {
  const header = document.querySelector('.site-header');
  if (!header) return;
  const h = header.offsetHeight;
  document.documentElement.style.setProperty('--header-h', `${h}px`);
}

function throttle(fn, ms) {
  let t = 0;
  return function(...args) {
    const now = Date.now();
    if (now - t > ms) { t = now; fn.apply(this, args); }
  };
}

function setupHamburger() {
  const btn = document.getElementById('hamburger');
  const panel = document.getElementById('menu-panel');
  const backdrop = document.getElementById('menu-backdrop');
  if (!btn || !panel) return;
  const open = () => {
    panel.classList.add('show');
    btn.classList.add('open');
    btn.setAttribute('aria-expanded', 'true');
    panel.setAttribute('aria-hidden', 'false');
    if (backdrop) { backdrop.hidden = false; }
  };
  const close = () => {
    panel.classList.remove('show');
    btn.classList.remove('open');
    btn.setAttribute('aria-expanded', 'false');
    panel.setAttribute('aria-hidden', 'true');
    if (backdrop) { backdrop.hidden = true; }
  };
  let shown = false;
  const toggle = () => { shown ? close() : open(); shown = !shown; };
  btn.addEventListener('click', toggle);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') { shown = true; close(); } });
  document.addEventListener('click', (e) => {
    if (!shown) return;
    if (e.target === btn || btn.contains(e.target)) return;
    if (panel.contains(e.target)) return;
    shown = true; close();
  }, { capture: true });
  backdrop?.addEventListener('click', () => { shown = true; close(); });
  // Smooth scroll for menu and footer links
  document.querySelectorAll('[data-scroll]')?.forEach((a) => {
    a.addEventListener('click', (ev) => {
      const href = a.getAttribute('href') || '';
      if (href.startsWith('#')) {
        ev.preventDefault();
        const id = href.slice(1);
        scrollToId(id);
        shown = true; close();
      }
    });
  });
}

function scrollToId(id) {
  const el = document.getElementById(id);
  const header = document.querySelector('.site-header');
  const headerH = header ? header.offsetHeight : 0;
  if (!el) return;
  const rect = el.getBoundingClientRect();
  const y = window.scrollY + rect.top - Math.max(18, headerH + 12);
  window.scrollTo({ top: y, behavior: 'smooth' });
}

function applyDominantColor(element, imageUrl) {
  try {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const w = 16, h = 16;
      const canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      // draw contain to keep overall palette
      const ratio = Math.min(w / img.width, h / img.height);
      const dw = img.width * ratio, dh = img.height * ratio;
      const dx = (w - dw) / 2, dy = (h - dh) / 2;
      ctx.drawImage(img, dx, dy, dw, dh);
      const data = ctx.getImageData(0, 0, w, h).data;
      let r = 0, g = 0, b = 0, n = 0;
      for (let i = 0; i < data.length; i += 4) {
        const a = data[i + 3];
        if (a < 32) continue; // skip near-transparent
        r += data[i]; g += data[i + 1]; b += data[i + 2]; n++;
      }
      if (!n) return;
      r = Math.round(r / n); g = Math.round(g / n); b = Math.round(b / n);
      element.style.backgroundColor = `rgba(${r}, ${g}, ${b}, 0.22)`;
    };
    img.src = imageUrl;
  } catch {}
}

// --- Mini Player ---
function parseYouTubeId(input) {
  if (!input) return '';
  const str = String(input).trim();
  if (/^[A-Za-z0-9_-]{11}$/.test(str)) return str;
  try {
    const u = new URL(str);
    if (u.hostname === 'youtu.be') return u.pathname.replace(/^\//, '').slice(0, 11);
    if (u.hostname.includes('youtube.com')) {
      if (u.pathname.startsWith('/watch')) return u.searchParams.get('v') || '';
      if (u.pathname.startsWith('/shorts/')) return u.pathname.split('/')[2] || '';
      const parts = u.pathname.split('/');
      const idx = parts.indexOf('embed');
      if (idx !== -1 && parts[idx + 1]) return parts[idx + 1];
    }
  } catch {}
  return '';
}

function openMiniPlayer(video) {
  const wrap = document.getElementById('mini-player');
  const frame = document.getElementById('mini-frame');
  if (!wrap || !frame) return;
  const id = parseYouTubeId(video);
  if (!id) return;
  frame.src = `https://www.youtube.com/embed/${id}?autoplay=1&rel=0&modestbranding=1`;
  wrap.setAttribute('aria-hidden', 'false');
}

function closeMiniPlayer() {
  const wrap = document.getElementById('mini-player');
  const frame = document.getElementById('mini-frame');
  if (!wrap || !frame) return;
  wrap.setAttribute('aria-hidden', 'true');
  frame.src = '';
}

function setupMiniPlayerTrigger() {
  const logo = document.getElementById('brand-logo');
  if (!logo) return;
  logo.style.cursor = 'pointer';
  const configured = logo.getAttribute('data-video') || '';
  const onClick = (e) => {
    e.preventDefault();
    if (configured) {
      openMiniPlayer(configured);
    } else if (CURRENT_VIDEO_ID) {
      // fallback: 現在の選択動画または最初の動画があれば再生
      openMiniPlayer(CURRENT_VIDEO_ID);
    } else {
      console.warn('brand-logo に data-video が設定されていません。');
    }
  };
  logo.addEventListener('click', onClick);
  document.getElementById('mini-close')?.addEventListener('click', closeMiniPlayer);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeMiniPlayer(); });
}
