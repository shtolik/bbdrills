import { getDay, markSetComplete, migrateLegacyIfNeeded } from '../lib/progress';

// UI state keys
const UI_KEY = 'bbdrills_ui_v1';
const STORAGE_KEY = 'bbdrills_progress_v3';

const langState = { lang: 'en' };
const filterState = { mode: 'all' };
const themeState = { mode: 'system' };
let currentData: any[] = [];
let lazyObserver: IntersectionObserver | null = null;
let modalVisibleItems: any[] = [];
let modalCurrentIndex = 0;

// Migrate legacy payload if present (progress module handles legacy key removal)
migrateLegacyIfNeeded();

// Global error handlers
window.addEventListener('error', e => {
  try {
    const content = document.getElementById('content');
    if (content) {
      const evt = e as ErrorEvent;
      const message = evt?.message || (evt?.error instanceof Error ? evt.error.message : String(e));
      const stack = evt?.error instanceof Error ? evt.error.stack : '';
      const pre = document.createElement('pre');
      pre.style.color = '#900';
      pre.style.whiteSpace = 'pre-wrap';
      pre.textContent = `Runtime error: ${message}\n${stack || ''}`;
      content.replaceChildren(pre);
    }
  } catch (_) {}
  console.error('Captured error', e);
});
window.addEventListener('unhandledrejection', ev => {
  try {
    const content = document.getElementById('content');
    if (content) {
      const reason = (ev as PromiseRejectionEvent).reason;
      const message = reason instanceof Error ? reason.message : String(reason);
      const stack = reason instanceof Error ? reason.stack : '';
      const pre = document.createElement('pre');
      pre.style.color = '#900';
      pre.style.whiteSpace = 'pre-wrap';
      pre.textContent = `Unhandled rejection: ${message}\n${stack || ''}`;
      content.replaceChildren(pre);
    }
  } catch (_) {}
  console.error('Unhandled rejection', ev);
});

function loadUI() {
  try {
    const raw = localStorage.getItem(UI_KEY);
    if (raw) {
      const s = JSON.parse(raw);
      if (s.lang === 'en' || s.lang === 'fi') langState.lang = s.lang;
      if (s.filter === 'all' || s.filter === 'incomplete') filterState.mode = s.filter;
      if (s.theme === 'system' || s.theme === 'dark' || s.theme === 'light')
        themeState.mode = s.theme;
    }
  } catch (e) {}
}
function saveUI() {
  try {
    localStorage.setItem(
      UI_KEY,
      JSON.stringify({ lang: langState.lang, filter: filterState.mode, theme: themeState.mode })
    );
  } catch (e) {}
}

// Wire buttons
const btnEn = document.getElementById('btn-en');
const btnFi = document.getElementById('btn-fi');
const filterBtn = document.getElementById('filter-btn');
const clearProgressBtn = document.getElementById('clear-progress');
const themeBtn = document.getElementById('theme-btn');

if (btnEn)
  btnEn.addEventListener('click', () => {
    langState.lang = 'en';
    saveUI();
    render(currentData);
  });
if (btnFi)
  btnFi.addEventListener('click', () => {
    langState.lang = 'fi';
    saveUI();
    render(currentData);
  });
if (filterBtn) filterBtn.addEventListener('click', toggleFilter);
if (clearProgressBtn) clearProgressBtn.addEventListener('click', clearProgress);
if (themeBtn) themeBtn.addEventListener('click', cycleTheme);

function applyTheme() {
  const btn = document.getElementById('theme-btn');
  const t = themeState.mode || 'system';
  if (t === 'system') {
    document.documentElement.removeAttribute('data-theme');
    if (btn) btn.textContent = 'Theme: system';
  } else {
    document.documentElement.setAttribute('data-theme', t);
    if (btn) btn.textContent = 'Theme: ' + t;
  }
}
function cycleTheme() {
  const order = ['system', 'dark', 'light'];
  const idx = order.indexOf(themeState.mode || 'system');
  themeState.mode = order[(idx + 1) % order.length];
  applyTheme();
  saveUI();
}

loadUI();
applyTheme();
if (filterBtn) updateFilterLabel();

async function load() {
  try {
    const res = await fetch('./default_drills_with_meta.json');
    const data = await res.json();
    currentData = data;
    render(data);
  } catch (e) {
    const content = document.getElementById('content');
    if (content) content.innerHTML = '<p style="color:#900">Failed to load data</p>';
    console.error(e);
  }
}

function toggleFilter() {
  filterState.mode = filterState.mode === 'all' ? 'incomplete' : 'all';
  if (filterBtn)
    filterBtn.textContent = filterState.mode === 'all' ? 'Show: All' : 'Show: Incomplete';
  saveUI();
  render(currentData);
}

function updateFilterLabel() {
  if (filterBtn)
    filterBtn.textContent = filterState.mode === 'all' ? 'Show: All' : 'Show: Incomplete';
}

function clearProgress() {
  if (!confirm('Clear local progress?')) return;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (e) {}
  render(currentData);
}

function groupBy(data: any[], key: string) {
  const map = new Map<string, any[]>();
  data.forEach(item => {
    const k = item[key] || 'Other';
    if (!map.has(k)) map.set(k, []);
    map.get(k)!.push(item);
  });
  return map;
}

function resolveAsset(path?: string | null) {
  if (!path) return null;
  if (path.startsWith('http') || path.startsWith('/')) return path;
  if (path.startsWith('site/')) return path.replace(/^site\//, '');
  if (path.startsWith('gifs25fps/') || path.startsWith('previews/') || path.startsWith('gifs61/'))
    return path;
  return path.replace(/^\/+/, '');
}
function youtubeIdFromUrl(url?: string) {
  if (!url) return null;
  try {
    const u = new URL(url);
    if (u.hostname.includes('youtu.be')) return u.pathname.slice(1);
    if (u.hostname.includes('youtube.com')) return u.searchParams.get('v');
  } catch (e) {
    const m = url.match(/(?:v=|youtu\.be\/|embed\/)([A-Za-z0-9_-]{6,})/);
    return m ? m[1] : null;
  }
  return null;
}
function youtubeThumbnail(url?: string) {
  const id = youtubeIdFromUrl(url || '');
  return id ? 'https://img.youtube.com/vi/' + id + '/hqdefault.jpg' : '';
}

function render(data: any[]) {
  if (!data) return;
  const groups = groupBy(data, 'group_en');
  const container = document.getElementById('content');
  if (!container) return;
  container.innerHTML = '';
  for (const [group, items] of groups) {
    const h = document.createElement('h2');
    h.className = 'group-title';
    h.textContent = langState.lang === 'fi' ? items[0].group_fi || group : group;
    container.appendChild(h);
    const grid = document.createElement('div');
    grid.className = 'grid';
    items.forEach((it: any) => {
      const day = getDay(it.id);
      const completed =
        day.targetSets && day.targetSets > 0
          ? day.setsCompleted >= day.targetSets
          : it.sets
          ? day.setsCompleted >= it.sets
          : false;
      if (filterState.mode === 'incomplete' && completed) return;
      const card = document.createElement('article');
      card.className = 'card' + (completed ? ' done' : '');
      card.dataset.id = it.id;
      const thumb = document.createElement('div');
      thumb.className = 'thumb';
      const previewWebp = it.preview_webp ? resolveAsset(it.preview_webp) : null;
      const previewGif = it.gif ? resolveAsset(it.gif) : null;
      const ytThumb = it.video_url ? youtubeThumbnail(it.video_url) : '';
      const poster = previewWebp || previewGif || ytThumb || '';

      if (completed) {
        if (poster) {
          const img = document.createElement('img');
          img.src = poster;
          img.alt = it.name_en + ' thumbnail';
          img.loading = 'lazy';
          img.className = 'lazy-img';
          img.addEventListener('load', () => {
            if (img.naturalWidth && img.naturalHeight) {
              thumb.classList.toggle('vertical', img.naturalHeight > img.naturalWidth);
              thumb.classList.toggle('horizontal', img.naturalWidth >= img.naturalHeight);
            }
          });
          thumb.appendChild(img);
        } else {
          const placeholder = document.createElement('div');
          placeholder.style.height = '140px';
          placeholder.style.background = 'rgba(0,0,0,0.06)';
          thumb.appendChild(placeholder);
        }
      } else {
        if (it.preview_mp4) thumb.dataset.mp4 = resolveAsset(it.preview_mp4) as any;
        if (it.preview_mp4 || thumb.dataset.mp4) {
          const video = document.createElement('video');
          video.dataset.src = resolveAsset(it.preview_mp4 || thumb.dataset.mp4) as any;
          video.autoplay = false;
          video.muted = true;
          video.loop = true;
          video.playsInline = true;
          video.preload = 'none';
          video.className = 'lazy-video';
          video.addEventListener('loadedmetadata', () => {
            const w = (video as any).videoWidth,
              h = (video as any).videoHeight;
            thumb.classList.toggle('vertical', h > w);
            thumb.classList.toggle('horizontal', w >= h);
          });
          thumb.appendChild(video);
        } else if (previewWebp) {
          const pic = document.createElement('picture');
          const src = document.createElement('source');
          src.type = 'image/webp';
          (src as any).dataset.srcset = previewWebp;
          src.className = 'lazy-source';
          pic.appendChild(src);
          const img = document.createElement('img');
          (img as any).dataset.src = previewGif || ytThumb || '';
          img.alt = it.name_en + ' thumbnail';
          img.loading = 'lazy';
          img.className = 'lazy-img';
          img.addEventListener('load', () => {
            if (img.naturalWidth && img.naturalHeight) {
              thumb.classList.toggle('vertical', img.naturalHeight > img.naturalWidth);
              thumb.classList.toggle('horizontal', img.naturalWidth >= img.naturalHeight);
            }
          });
          pic.appendChild(img);
          thumb.appendChild(pic);
        } else {
          const img = document.createElement('img');
          (img as any).dataset.src = previewGif || ytThumb || '';
          img.alt = it.name_en + ' thumbnail';
          img.loading = 'lazy';
          img.className = 'lazy-img';
          img.addEventListener('load', () => {
            if (img.naturalWidth && img.naturalHeight) {
              thumb.classList.toggle('vertical', img.naturalHeight > img.naturalWidth);
              thumb.classList.toggle('horizontal', img.naturalWidth >= img.naturalHeight);
            }
          });
          thumb.appendChild(img);
        }
      }
      if (!completed) thumb.addEventListener('click', () => openVideo(it, true));

      const meta = document.createElement('div');
      meta.className = 'meta';
      const title = document.createElement('div');
      title.className = 'title';
      title.textContent = langState.lang === 'fi' ? it.name_fi || it.name_en : it.name_en;
      const details = document.createElement('div');
      details.className = 'details';
      const detailsText = langState.lang === 'fi' ? it.details || '' : it.details || '';
      if (detailsText) {
        details.appendChild(document.createTextNode(detailsText));
        details.appendChild(document.createElement('br'));
      }

      const sReps = document.createElement('strong');
      sReps.textContent = 'Reps:';
      details.appendChild(sReps);
      details.appendChild(
        document.createTextNode(
          ' ' + (it.reps || '') + (it.reps && it.reps_unit ? ' ' + it.reps_unit : '')
        )
      );

      const infoRow = document.createElement('div');
      infoRow.className = 'info-row';
      infoRow.appendChild(details);
      const setsWrap = document.createElement('div');
      setsWrap.style.display = 'flex';
      setsWrap.style.alignItems = 'center';
      setsWrap.style.gap = '8px';
      const sSets = document.createElement('div');
      sSets.textContent = 'Sets:';
      sSets.style.fontWeight = '600';
      const target = day.targetSets && day.targetSets > 0 ? day.targetSets : it.sets || 0;
      const big = document.createElement('div');
      big.className = 'sets-display';
      big.textContent = (day.setsCompleted || 0) + '/' + (target || '-');
      setsWrap.appendChild(sSets);
      setsWrap.appendChild(big);
      const markBtn = document.createElement('button');
      markBtn.textContent = '+1 done';
      markBtn.className = 'btn-mark';
      markBtn.addEventListener('click', async () => {
        markSetComplete(it.id);
        updateCardById(it.id, it);
      });
      setsWrap.appendChild(markBtn);
      infoRow.appendChild(setsWrap);

      const link = document.createElement('div');
      link.style.marginTop = '6px';
      const viewBtn = document.createElement('button');
      viewBtn.textContent = 'Open video';
      viewBtn.addEventListener('click', () => openVideo(it, true));
      link.appendChild(viewBtn);
      if (it.video_url) {
        const ext = document.createElement('a');
        ext.href = it.video_url;
        ext.target = '_blank';
        ext.rel = 'noopener noreferrer';
        ext.setAttribute('referrerpolicy', 'no-referrer');
        ext.style.marginLeft = '8px';
        ext.textContent = 'Open on YouTube';
        link.appendChild(ext);
      }

      const actions = document.createElement('div');
      actions.className = 'card-actions';
      if (target > 0 && day.setsCompleted >= target) {
        const badge = document.createElement('span');
        badge.className = 'done-badge';
        badge.textContent = 'Done';
        setsWrap.appendChild(badge);
      }

      meta.appendChild(title);
      meta.appendChild(infoRow);
      meta.appendChild(link);
      meta.appendChild(actions);
      card.appendChild(thumb);
      card.appendChild(meta);
      grid.appendChild(card);
    });
    container.appendChild(grid);
  }
  observeThumbs();
}

function observeThumbs() {
  if (lazyObserver) lazyObserver.disconnect();
  const options = { root: null, rootMargin: '200px', threshold: 0.1 };
  lazyObserver = new IntersectionObserver((entries, obs) => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      const thumb = entry.target as HTMLElement;
      if ((thumb.dataset as any).loaded) {
        obs.unobserve(thumb);
        return;
      }
      const srcEl = thumb.querySelector('source.lazy-source') as HTMLSourceElement | null;
      if (srcEl && (srcEl as any).dataset.srcset) srcEl.srcset = (srcEl as any).dataset.srcset;
      const img = thumb.querySelector('img.lazy-img') as HTMLImageElement | null;
      if (img && (img as any).dataset.src) img.src = (img as any).dataset.src;
      const video = thumb.querySelector('video.lazy-video') as HTMLVideoElement | null;
      if (video && (video as any).dataset.src) {
        video.src = (video as any).dataset.src;
        try {
          video.load();
          video.play().catch(() => {});
        } catch (e) {}
      }
      (thumb.dataset as any).loaded = '1';
      obs.unobserve(thumb);
    });
  }, options);
  document.querySelectorAll('.thumb').forEach(t => {
    if (!(t as any).dataset.loaded) lazyObserver!.observe(t);
  });
}

// YouTube API loader
(window as any)._bbdrills_yt_api_ready = false;
(function loadYtApi() {
  if ((window as any).YT && (window as any).YT.Player) {
    (window as any)._bbdrills_yt_api_ready = true;
    return;
  }
  const s = document.createElement('script');
  s.src = 'https://www.youtube.com/iframe_api';
  s.async = true;
  document.head.appendChild(s);
  (window as any).onYouTubeIframeAPIReady = function () {
    (window as any)._bbdrills_yt_api_ready = true;
  };
})();

function showModalForIndex(idx: number) {
  if (!modalVisibleItems || idx < 0 || idx >= modalVisibleItems.length) return;
  const item = modalVisibleItems[idx];
  modalCurrentIndex = idx;
  const modal = document.getElementById('modal')!;
  const box = document.getElementById('modal-box')!;
  box.innerHTML = '';

  // Prefer YouTube embed when possible; keep fallback simple to avoid parser issues
  if (item.video_url) {
    const id = youtubeIdFromUrl(item.video_url);
    if (id && (window as any)._bbdrills_yt_api_ready) {
      const placeholder = document.createElement('div');
      placeholder.id = 'yt-player-' + idx;
      placeholder.style.width = '100%';
      placeholder.style.height = '100%';
      box.appendChild(placeholder);
      try {
        // Minimal player creation with onReady and onError handlers; on error show friendly message and fallback link
        new (window as any).YT.Player(placeholder.id, {
          height: '450',
          width: '800',
          videoId: id,
          playerVars: { autoplay: 1, origin: location.origin },
          events: {
            onReady: (e: any) => {
              try {
                e.target.playVideo();
              } catch (_) {}
            },
            onError: (e: any) => {
              try {
                // Replace modal content with a helpful fallback so users can still access the video
                box.innerHTML = '';
                const msg = document.createElement('div');
                msg.style.color = '#fff';
                msg.style.padding = '16px';
                msg.style.textAlign = 'center';
                msg.innerHTML =
                  '<p style="color:#fff;font-size:18px">This video cannot be embedded (age-restricted or blocked). You can open it on YouTube instead.</p>';
                const a = document.createElement('a');
                a.href = 'https://www.youtube.com/watch?v=' + id;
                a.target = '_blank';
                a.rel = 'noopener noreferrer';
                a.textContent = 'Open on YouTube';
                a.style.display = 'inline-block';
                a.style.marginTop = '8px';
                a.style.padding = '8px 12px';
                a.style.background = '#fff';
                a.style.color = '#000';
                a.style.borderRadius = '6px';
                msg.appendChild(a);
                box.appendChild(msg);
              } catch (err) {
                // final fallback: open new tab
                try {
                  window.open('https://www.youtube.com/watch?v=' + id, '_blank');
                } catch (_) {}
              }
            },
          },
        });
      } catch (_) {
        const iframe = document.createElement('iframe');
        iframe.src = 'https://www.youtube.com/embed/' + id + '?autoplay=1';
        iframe.width = '800';
        iframe.height = '450';
        iframe.title = 'YouTube video';
        iframe.allowFullscreen = true;
        iframe.setAttribute(
          'allow',
          'accelerometer; autoplay; encrypted-media; picture-in-picture; fullscreen'
        );
        iframe.setAttribute('referrerpolicy', 'no-referrer');
        box.appendChild(iframe);
      }
    } else if (id) {
      const iframe = document.createElement('iframe');
      iframe.src = 'https://www.youtube.com/embed/' + id + '?autoplay=1';
      iframe.width = '800';
      iframe.height = '450';
      iframe.title = 'YouTube video';
      iframe.allowFullscreen = true;
      iframe.setAttribute(
        'allow',
        'accelerometer; autoplay; encrypted-media; picture-in-picture; fullscreen'
      );
      iframe.setAttribute('referrerpolicy', 'no-referrer');
      box.appendChild(iframe);
    } else {
      const w = window.open(item.video_url, '_blank');
      if (w) {
        try {
          (w as any).opener = null;
        } catch (e) {}
      }
      return;
    }
  } else if (item.preview_mp4) {
    const video = document.createElement('video');
    video.controls = true;
    video.autoplay = true;
    video.muted = false;
    video.playsInline = true;
    video.loop = false;
    video.src = resolveAsset(item.preview_mp4) as any;
    video.style.maxWidth = '90vw';
    box.appendChild(video);
  } else if (item.local_video) {
    const w = window.open(item.local_video, '_blank');
    if (w) {
      try {
        (w as any).opener = null;
      } catch (e) {}
    }
    return;
  }

  modal.classList.add('open');
  modal.setAttribute('aria-hidden', 'false');
}

function openVideo(item: any, _embed = false) {
  const idMap = new Map<string, any>();
  currentData.forEach(it => idMap.set(it.id, it));
  modalVisibleItems = [];
  Array.from(document.querySelectorAll('.card')).forEach(c => {
    const id = (c as HTMLElement).dataset.id;
    if (id) {
      const it = idMap.get(id);
      if (it) modalVisibleItems.push(it);
    }
  });
  const idx = modalVisibleItems.findIndex(it => it.id === item.id);
  if (idx === -1) {
    modalVisibleItems = [item];
    modalCurrentIndex = 0;
    showModalForIndex(0);
    return;
  }
  showModalForIndex(idx);
}

// modal gestures (touch + mouse) kept as-is
(function setupModalGestures() {
  const modal = document.getElementById('modal')!;
  let startX = 0,
    startY = 0,
    isTouch = false;
  modal.addEventListener('touchstart', e => {
    isTouch = true;
    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
  });
  modal.addEventListener('touchmove', e => {
    if (!isTouch) return;
  });
  modal.addEventListener('touchend', e => {
    if (!isTouch) return;
    const dx = e.changedTouches[0].clientX - startX;
    const dy = e.changedTouches[0].clientY - startY;
    if (Math.abs(dy) > 100 && Math.abs(dy) > Math.abs(dx)) {
      document.getElementById('modal')!.classList.remove('open');
      document.getElementById('modal')!.setAttribute('aria-hidden', 'true');
      document.getElementById('modal-box')!.innerHTML = '';
    } else if (Math.abs(dx) > 80 && Math.abs(dx) > Math.abs(dy)) {
      if (dx < 0) {
        const next = Math.min(modalCurrentIndex + 1, modalVisibleItems.length - 1);
        if (next !== modalCurrentIndex) {
          showModalForIndex(next);
        }
      } else {
        const prev = Math.max(modalCurrentIndex - 1, 0);
        if (prev !== modalCurrentIndex) {
          showModalForIndex(prev);
        }
      }
    }
    isTouch = false;
  });
  let mouseDown = false;
  let mx = 0,
    my = 0;
  modal.addEventListener('mousedown', e => {
    mouseDown = true;
    mx = e.clientX;
    my = e.clientY;
  });
  modal.addEventListener('mouseup', e => {
    if (!mouseDown) return;
    const dx = e.clientX - mx;
    const dy = e.clientY - my;
    mouseDown = false;
    if (Math.abs(dy) > 120 && Math.abs(dy) > Math.abs(dx)) {
      document.getElementById('modal')!.classList.remove('open');
      document.getElementById('modal')!.setAttribute('aria-hidden', 'true');
      document.getElementById('modal-box')!.innerHTML = '';
    } else if (Math.abs(dx) > 100 && Math.abs(dx) > Math.abs(dy)) {
      if (dx < 0) {
        const next = Math.min(modalCurrentIndex + 1, modalVisibleItems.length - 1);
        if (next !== modalCurrentIndex) {
          showModalForIndex(next);
        }
      } else {
        const prev = Math.max(modalCurrentIndex - 1, 0);
        if (prev !== modalCurrentIndex) {
          showModalForIndex(prev);
        }
      }
    }
  });
})();

// update a single card after progress change
function updateCardById(drillId: string, item: any) {
  const card = document.querySelector('.card[data-id="' + drillId + '"]');
  if (!card) return;
  const day = getDay(drillId);
  const target = day.targetSets && day.targetSets > 0 ? day.targetSets : item.sets || 0;
  const setsEl = card.querySelector('.sets-display');
  if (setsEl) setsEl.textContent = (day.setsCompleted || 0) + '/' + (target || '-');
  if (target > 0 && day.setsCompleted >= target) {
    card.classList.add('done');
    if (!card.querySelector('.done-badge')) {
      const setsWrap = setsEl ? setsEl.parentElement : null;
      if (setsWrap) {
        const badge = document.createElement('span');
        badge.className = 'done-badge';
        badge.textContent = 'Done';
        setsWrap.appendChild(badge);
      }
    }
    const thumb = card.querySelector('.thumb');
    if (thumb) {
      thumb.innerHTML = '';
      const poster =
        resolveAsset(item.preview_webp) ||
        resolveAsset(item.gif) ||
        (item.video_url ? youtubeThumbnail(item.video_url) : '');
      if (poster) {
        const img = document.createElement('img');
        img.src = poster;
        img.alt = item.name_en + ' thumbnail';
        img.className = 'lazy-img';
        thumb.appendChild(img);
      }
      (thumb as HTMLElement).style.pointerEvents = 'none';
    }
  }
}

// close modal on backdrop click
const modal = document.getElementById('modal');
if (modal) {
  modal.addEventListener('click', e => {
    if ((e.target as HTMLElement).id === 'modal') {
      const box = document.getElementById('modal-box');
      const v = box ? box.querySelector('video') : null;
      if (v) (v as HTMLVideoElement).pause();
      if (box) box.innerHTML = '';
      modal.classList.remove('open');
      modal.setAttribute('aria-hidden', 'true');
    }
  });
}

load();
