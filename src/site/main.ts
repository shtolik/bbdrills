import { getDay, markSetComplete, migrateLegacyIfNeeded } from '../lib/progress';

// UI state keys
const UI_KEY = 'bbdrills_ui_v1';
const STORAGE_KEY = 'bbdrills_progress_v3';

const langState = { lang: 'en' };
const filterState = { mode: 'all' };
const themeState = { mode: 'system' };

// Minimal Drill type used across this module to gain TS safety for core state
type Drill = {
  id: string;
  // localized shapes supported: name/details/group/reps may be objects {en,fi,sv}
  name?: any;
  details?: any;
  group?: any;
  reps?: any;
  reps_num?: string;
  reps_label?: any;
  reps_unit?: string;
  sets?: number;
  preview_webp?: string;
  gif?: string;
  preview_mp4?: string;
  video_url?: string;
  local_video?: string;
  // legacy flat fields
  name_en?: string;
  name_fi?: string;
  group_en?: string;
  group_fi?: string;
};

let currentData: Drill[] = [];
let lazyObserver: IntersectionObserver | null = null;
let modalVisibleItems: Drill[] = [];
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
      if (s.lang === 'en' || s.lang === 'fi' || s.lang === 'sv') langState.lang = s.lang;
      if (s.filter === 'all' || s.filter === 'incomplete') filterState.mode = s.filter;
      if (s.theme === 'system' || s.theme === 'dark' || s.theme === 'light')
        themeState.mode = s.theme;
    }
  } catch (e) {}
}

import { loadLocale, t, localizedField } from './i18n';

function localizedDrillField(item: Drill, field: keyof Drill) {
  return localizedField(item, String(field), langState.lang);
}
function saveUI() {
  try {
    localStorage.setItem(
      UI_KEY,
      JSON.stringify({ lang: langState.lang, filter: filterState.mode, theme: themeState.mode })
    );
  } catch (e) {}
}

// Wire controls
const langSelect = document.getElementById('lang-select') as HTMLSelectElement | null;
const filterBtn = document.getElementById('filter-btn');
const clearProgressBtn = document.getElementById('clear-progress');
const themeBtn = document.getElementById('theme-btn');

if (langSelect)
  langSelect.addEventListener('change', async () => {
    const nextLang =
      langSelect.value === 'fi' || langSelect.value === 'sv' ? langSelect.value : 'en';
    langState.lang = nextLang;
    const loc = await loadLocale(nextLang);

    saveUI();

    const brand = document.getElementById('brand');
    if (brand && (loc as any)?.brand) brand.textContent = (loc as any).brand;
    if (clearProgressBtn) clearProgressBtn.textContent = t('clear_progress', 'Clear progress');
    if (filterBtn)
      filterBtn.textContent =
        filterState.mode === 'all'
          ? t('show_all', 'Show: All')
          : t('show_incomplete', 'Show: Incomplete');

    applyTheme();
    render(currentData);
  });
if (filterBtn)
  filterBtn.addEventListener('click', () => {
    toggleFilter();
    updateFilterLabel();
  });
if (clearProgressBtn) clearProgressBtn.addEventListener('click', clearProgress);
if (themeBtn) themeBtn.addEventListener('click', cycleTheme);

function applyTheme() {
  const btn = document.getElementById('theme-btn');
  const tv = themeState.mode || 'system';
  if (tv === 'system') {
    document.documentElement.removeAttribute('data-theme');
    if (btn) btn.textContent = t('theme_system', 'Theme: system');
  } else {
    document.documentElement.setAttribute('data-theme', tv);
    if (btn) btn.textContent = t('theme', 'Theme') + ': ' + tv;
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
    // load localization for UI
    const loc = await loadLocale(langState.lang);
    const brand = document.getElementById('brand');
    if (brand && (loc as any)?.brand) brand.textContent = (loc as any).brand;
    if (clearProgressBtn) clearProgressBtn.textContent = t('clear_progress', 'Clear progress');
    if (filterBtn)
      filterBtn.textContent =
        filterState.mode === 'all'
          ? t('show_all', 'Show: All')
          : t('show_incomplete', 'Show: Incomplete');
    applyTheme();

    const res = await fetch('./default_drills_with_meta.json');
    const data = await res.json();
    currentData = data;
    render(data);

    // Deep-link handling: support ?id=<drill-id> deep links and set canonical/meta tags per drill
    try {
      const params = new URLSearchParams(location.search);
      const idParam = params.get('id');
      if (idParam) {
        const item = data.find((d: any) => d.id === idParam);
        if (item) {
          const canonicalUrl = `${location.protocol}//${location.host}/?id=${encodeURIComponent(
            item.id
          )}`;
          // ensure canonical link exists
          let link = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
          if (!link) {
            link = document.createElement('link');
            link.setAttribute('rel', 'canonical');
            document.head.appendChild(link);
          }
          link.href = canonicalUrl;

          // set title and description
          const titleText =
            (localizedDrillField(item, 'name') || (item as any).name_en || 'Drills') + ' — Drills';
          document.title = titleText;
          let md = document.querySelector('meta[name="description"]') as HTMLMetaElement | null;
          const desc = localizedDrillField(item, 'details') || item.details || '';
          if (!md) {
            md = document.createElement('meta');
            md.setAttribute('name', 'description');
            document.head.appendChild(md);
          }
          md.content = String(desc || titleText).slice(0, 160);

          // Open Graph tags
          function setMetaProp(prop: string, content: string) {
            let m = document.querySelector(`meta[property="${prop}"]`) as HTMLMetaElement | null;
            if (!m) {
              m = document.createElement('meta');
              m.setAttribute('property', prop);
              document.head.appendChild(m);
            }
            m.content = content;
          }
          setMetaProp('og:title', titleText);
          setMetaProp('og:description', desc || titleText);
          setMetaProp('og:url', canonicalUrl);
          const img =
            (item.preview_webp as string) ||
            (item.preview_mp4 as string) ||
            (item.video_url ? youtubeThumbnail(item.video_url) : '') ||
            '';
          if (img) setMetaProp('og:image', normalizeUrl(img));

          // scroll to the drill card so crawlers render focused content
          setTimeout(() => {
            const el = document.querySelector(`[data-id="${item.id}"]`) as HTMLElement | null;
            if (el) el.scrollIntoView({ behavior: 'auto', block: 'center' });
          }, 50);
        }
      } else {
        // default canonical for homepage
        let link = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
        if (!link) {
          link = document.createElement('link');
          link.setAttribute('rel', 'canonical');
          document.head.appendChild(link);
        }
        link.href = `${location.protocol}//${location.host}/`;
      }
    } catch (e) {}
  } catch (e) {
    const content = document.getElementById('content');
    if (content) {
      content.innerHTML = '';
      const p = document.createElement('p');
      p.style.color = '#900';
      p.style.whiteSpace = 'pre-wrap';
      p.textContent = t('failed_to_load_data', 'Failed to load data');
      content.appendChild(p);
    }
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
  if (!confirm(t('confirm_clear', 'Clear local progress?'))) return;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (e) {}
  render(currentData);
}

function groupBy(data: Drill[], key: keyof Drill) {
  const map = new Map<string, Drill[]>();
  data.forEach(item => {
    const v = item[key];
    const k = (v && String(v)) || 'Other';
    if (!map.has(k)) map.set(k, []);
    map.get(k)!.push(item);
  });
  return map;
}

// New helper to group by group key. Title rendering will use locale translation for the group label.
function groupByLocalized(data: Drill[]) {
  const map = new Map<string, Drill[]>();
  data.forEach(item => {
    const k =
      typeof (item as any).group === 'string'
        ? (item as any).group
        : localizedDrillField(item, 'group') || (item as any).group_en || 'other';
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

function normalizeUrl(url?: string) {
  if (!url) return '';
  let s = String(url).trim();
  if (!s) return '';
  if (/^https?:\/\//i.test(s)) return s;
  if (/^https?:\//i.test(s)) return s.replace(/^https?:\/*/i, 'https://');
  if (/^\/\//.test(s)) return 'https:' + s;
  if (s.startsWith('/')) s = s.replace(/^\/+/, '');
  return 'https://' + s;
}

function render(data: Drill[]) {
  if (!data) return;
  const groups = groupByLocalized(data);
  const container = document.getElementById('content');
  if (!container) return;
  container.innerHTML = '';
  for (const [group, items] of groups) {
    const h = document.createElement('h2');
    h.className = 'group-title';
    h.textContent = localizedDrillField(items[0], 'group') || group;
    container.appendChild(h);
    const grid = document.createElement('div');
    grid.className = 'grid';
    items.forEach((it: Drill) => {
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
          img.alt = (localizedDrillField(it, 'name') || it.name_en) + ' thumbnail';
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
          img.alt = (localizedDrillField(it, 'name') || it.name_en) + ' thumbnail';
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
      if (!completed) thumb.addEventListener('click', () => openVideo(it));

      const meta = document.createElement('div');
      meta.className = 'meta';
      const title = document.createElement('div');
      title.className = 'title';
      title.textContent = localizedDrillField(it, 'name') || it.name_en;
      const details = document.createElement('div');
      details.className = 'details';
      const detailsText = localizedDrillField(it, 'details') || it.details || '';
      if (detailsText) {
        details.appendChild(document.createTextNode(detailsText));
        details.appendChild(document.createElement('br'));
      }

      const sRepsLabel = document.createElement('span');
      sRepsLabel.textContent = t('reps_label', 'Reps:');
      sRepsLabel.className = 'reps-label';
      details.appendChild(sRepsLabel);
      const sRepsVal = document.createElement('span');
      sRepsVal.className = 'reps-display';
      sRepsVal.textContent =
        (it.reps_num || localizedDrillField(it, 'reps') || '') +
        (localizedDrillField(it, 'reps_label')
          ? ' ' + localizedDrillField(it, 'reps_label')
          : it.reps_unit
          ? ' ' + it.reps_unit
          : '');
      details.appendChild(sRepsVal);

      const infoRow = document.createElement('div');
      infoRow.className = 'info-row';
      infoRow.appendChild(details);
      const setsWrap = document.createElement('div');
      setsWrap.style.display = 'flex';
      setsWrap.style.alignItems = 'center';
      setsWrap.style.gap = '8px';
      const sSets = document.createElement('div');
      sSets.textContent = t('sets_label', 'Sets:');
      sSets.className = 'sets-label';
      const target = day.targetSets && day.targetSets > 0 ? day.targetSets : it.sets || 0;
      const big = document.createElement('div');
      big.className = 'sets-display';
      big.textContent = (day.setsCompleted || 0) + '/' + (target || '-');
      setsWrap.appendChild(sSets);
      setsWrap.appendChild(big);
      const markBtn = document.createElement('button');
      markBtn.textContent = t('mark_done', '+1 done');
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
      viewBtn.textContent = t('open_video', 'Open video');
      viewBtn.addEventListener('click', () => openVideo(it));
      link.appendChild(viewBtn);
      if (it.video_url) {
        const ext = document.createElement('a');
        ext.href = normalizeUrl(it.video_url);
        ext.target = '_blank';
        ext.rel = 'noopener noreferrer';
        ext.setAttribute('referrerpolicy', 'no-referrer');
        ext.style.marginLeft = '8px';
        ext.textContent = t('open_on_youtube', 'Open on YouTube');
        link.appendChild(ext);
      }

      const actions = document.createElement('div');
      actions.className = 'card-actions';
      if (target > 0 && day.setsCompleted >= target) {
        const badge = document.createElement('span');
        badge.className = 'done-badge';
        badge.textContent = t('done', 'Done');
        setsWrap.appendChild(badge);
      }

      // Share button: copies deep link to clipboard
      const shareBtn = document.createElement('button');
      shareBtn.textContent = t('share', 'Share');
      shareBtn.addEventListener('click', async ev => {
        ev.stopPropagation();
        const deep = `${location.protocol}//${location.host}/?id=${encodeURIComponent(it.id)}`;
        try {
          if (navigator.clipboard && navigator.clipboard.writeText) {
            await navigator.clipboard.writeText(deep);
          } else {
            const ta = document.createElement('textarea');
            ta.value = deep;
            ta.style.position = 'fixed';
            ta.style.left = '-9999px';
            document.body.appendChild(ta);
            ta.select();
            document.execCommand('copy');
            ta.remove();
          }
          const prev = shareBtn.textContent;
          shareBtn.textContent = t('copied', 'Copied!');
          setTimeout(() => (shareBtn.textContent = prev), 1400);
        } catch (e) {
          // fallback: show prompt so user can copy manually
          prompt(t('copy_prompt', 'Copy this link'), deep);
        }
      });
      actions.appendChild(shareBtn);

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
                const p = document.createElement('p');
                p.style.color = '#fff';
                p.style.fontSize = '18px';
                p.textContent = t(
                  'cannot_embed',
                  'This video cannot be embedded (age-restricted or blocked). You can open it on YouTube instead.'
                );
                msg.appendChild(p);
                const a = document.createElement('a');
                a.href = 'https://www.youtube.com/watch?v=' + id;
                a.target = '_blank';
                a.rel = 'noopener noreferrer';
                a.textContent = t('open_on_youtube', 'Open on YouTube');
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
      const w = window.open(normalizeUrl(item.video_url), '_blank', 'noopener,noreferrer');
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
    const url = resolveAsset(item.local_video) || item.local_video;
    const w = window.open(url, '_blank');
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

function openVideo(item: Drill) {
  const idMap = new Map<string, Drill>();
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
function updateCardById(drillId: string, item: Drill) {
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
        badge.textContent = t('done', 'Done');
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
        img.alt = (localizedDrillField(item, 'name') || item.name_en) + ' thumbnail';
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
