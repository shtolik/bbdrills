import { h, Fragment } from 'preact';
import { useEffect, useState, useRef } from 'preact/hooks';
import { getDay, markSetComplete, migrateLegacyIfNeeded } from '../lib/progress';
import { loadLocale, localizedField, t } from './i18n';
import { buildDeepLink } from './url';

type Drill = {
  id: string;
  // name/details/groups/reps may be nested localized objects: { en: string, fi: string, sv: string }
  name?: any;
  details?: any;
  group?: any;
  reps?: any; // legacy
  reps_num?: string; // numeric or range (non-localized)
  reps_label?: any; // localized object {en,fi,sv}
  reps_unit?: string;
  sets?: number;
  preview_webp?: string;
  gif?: string;
  preview_mp4?: string;
  video_url?: string;
  local_video?: string;
  // legacy flat fields kept for backward-compat
  name_en?: string;
  name_fi?: string;
  group_en?: string;
  group_fi?: string;
};

const resolveAsset = (path?: string | null) => {
  if (!path) return null;
  if (path.startsWith('http') || path.startsWith('/')) return path;
  if (path.startsWith('site/')) return path.replace(/^site\//, '');
  if (path.startsWith('videos/')) return '../' + path;
  if (path.startsWith('gifs25fps/') || path.startsWith('previews/') || path.startsWith('gifs61/'))
    return path;
  return path.replace(/^\/+/, '');
};

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
  // already absolute
  if (/^https?:\/\//i.test(s)) return s;
  // miss-typed single-slash like "https:/youtu.be/..."
  if (/^https?:\//i.test(s)) return s.replace(/^https?:\/*/i, 'https://');
  // protocol-relative: force https
  if (/^\/\//.test(s)) return 'https:' + s;
  // leading slash: treat as missing scheme/host (e.g. "/youtu.be/...")
  if (s.startsWith('/')) s = s.replace(/^\/+/, '');
  return 'https://' + s;
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

export default function App() {
  const [data, setData] = useState<Drill[]>([]);
  const lazyObserver = useRef<IntersectionObserver | null>(null);
  const didSyncUI = useRef(false);
  // UI state (persisted)
  const UI_KEY = 'bbdrills_ui_v1';
  const STORAGE_KEY = 'bbdrills_progress_v3';
  const [lang, setLang] = useState<string>('en');
  const [filter, setFilter] = useState<'all' | 'incomplete'>('all');
  const [theme, setTheme] = useState<'system' | 'dark' | 'light'>('system');

  useEffect(() => {
    migrateLegacyIfNeeded();
    // load UI from localStorage
    let initialLang = 'en';
    let initialFilter: 'all' | 'incomplete' = 'all';
    let initialTheme: 'system' | 'dark' | 'light' = 'system';
    try {
      const raw = localStorage.getItem(UI_KEY);
      if (raw) {
        const s = JSON.parse(raw);
        if (typeof s.lang === 'string' && ['en', 'fi', 'sv'].includes(s.lang)) initialLang = s.lang;
        if (s.filter === 'all' || s.filter === 'incomplete') initialFilter = s.filter;
        if (s.theme === 'system' || s.theme === 'dark' || s.theme === 'light')
          initialTheme = s.theme;
      }
    } catch (e) {}

    setLang(initialLang);
    setFilter(initialFilter);
    setTheme(initialTheme);
    applyTheme(initialTheme);
    updateFilterLabel(initialFilter);

    // set language dropdown if present
    const langSelectElem = document.getElementById('lang-select') as HTMLSelectElement | null;
    if (langSelectElem) langSelectElem.value = initialLang;

    (async () => {
      try {
        const [res, locObj] = await Promise.all([
          fetch('./default_drills_with_meta.json'),
          loadLocale(initialLang),
        ]);
        const json = await res.json();
        const brandEl = document.getElementById('brand');
        if (brandEl && (locObj as any)?.brand) brandEl.textContent = (locObj as any).brand;
        // now that locale is available, update header labels that call t()
        applyTheme(initialTheme);
        updateFilterLabel(initialFilter);
        const clearBtn = document.getElementById('clear-progress');
        if (clearBtn) clearBtn.textContent = t('clear_progress', 'Clear progress');
        // remove any initial loading <p> placeholder if still present (avoid leaving static text at bottom)
        const contentEl = document.getElementById('content');
        if (
          contentEl?.children.length === 1 &&
          contentEl.firstElementChild?.tagName?.toLowerCase() === 'p'
        ) {
          contentEl.firstElementChild.remove();
        }
        setData(json);
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
    })();

    // setup lazy observer
    const options = { root: null, rootMargin: '200px', threshold: 0.1 };
    lazyObserver.current = new IntersectionObserver((entries, obs) => {
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
        if (img) {
          if ((img as any).dataset.src) img.src = (img as any).dataset.src;
          const apply = () => {
            if (img.naturalWidth && img.naturalHeight) {
              thumb.classList.toggle('vertical', img.naturalHeight > img.naturalWidth);
              thumb.classList.toggle('horizontal', img.naturalWidth >= img.naturalHeight);
            }
          };
          if (img.complete) apply();
          else img.addEventListener('load', apply, { once: true });
        }

        const video = thumb.querySelector('video.lazy-video') as HTMLVideoElement | null;
        if (video) {
          if ((video as any).dataset.src) video.src = (video as any).dataset.src;
          const apply = () => {
            const w = video.videoWidth;
            const h = video.videoHeight;
            if (w && h) {
              thumb.classList.toggle('vertical', h > w);
              thumb.classList.toggle('horizontal', w >= h);
            }
          };
          if (video.readyState >= 1) apply();
          else video.addEventListener('loadedmetadata', apply, { once: true });
          if ((video as any).dataset.src) {
            try {
              video.load();
              video.play().catch(() => {});
            } catch (e) {}
          }
        }
        (thumb.dataset as any).loaded = '1';
        obs.unobserve(thumb);
      });
    }, options);

    // wire header controls
    const langSelect = document.getElementById('lang-select') as HTMLSelectElement | null;
    const filterBtn = document.getElementById('filter-btn');
    const clearProgressBtn = document.getElementById('clear-progress');
    const themeBtn = document.getElementById('theme-btn');

    // helper: merge and update persisted UI immediately without relying on captured state
    function mergeAndPersist(
      newVals: Partial<{
        lang: string;
        filter: 'all' | 'incomplete';
        theme: 'system' | 'dark' | 'light';
      }>
    ) {
      try {
        const raw = localStorage.getItem(UI_KEY);
        const cur = raw ? JSON.parse(raw) : {};
        const merged = Object.assign({}, cur, newVals);
        localStorage.setItem(UI_KEY, JSON.stringify(merged));
      } catch (e) {}
    }

    const onLangChange = async (next: string) => {
      setLang(next);
      mergeAndPersist({ lang: next });
      const loc = await loadLocale(next);
      const brandEl = document.getElementById('brand');
      if (brandEl && loc && loc.brand) brandEl.textContent = loc.brand;
      // update header labels
      try {
        const raw = localStorage.getItem(UI_KEY);
        const cur = raw ? JSON.parse(raw) : {};
        updateFilterLabel(cur.filter === 'incomplete' ? 'incomplete' : 'all');
        applyTheme(cur.theme === 'dark' || cur.theme === 'light' ? cur.theme : 'system');
      } catch (e) {
        updateFilterLabel(filter);
        applyTheme(theme);
      }
      const clearBtn = document.getElementById('clear-progress');
      if (clearBtn) clearBtn.textContent = t('clear_progress', 'Clear progress');
      // re-render cards so t() calls pick up new locale
      setData(prev => prev.slice());
    };
    const onFilter = () => {
      setFilter(prev => {
        const next = prev === 'all' ? 'incomplete' : 'all';
        mergeAndPersist({ filter: next });
        return next;
      });
    };
    const onClear = () => {
      if (!confirm(t('confirm_clear', 'Clear local progress?'))) return;
      try {
        localStorage.removeItem(STORAGE_KEY);
      } catch (e) {}
      // trigger re-render
      setData(prev => prev.slice());
    };
    const onTheme = () => {
      setTheme(prev => {
        const order: ('system' | 'dark' | 'light')[] = ['system', 'dark', 'light'];
        const idx = order.indexOf(prev || 'system');
        const next = order[(idx + 1) % order.length];
        applyTheme(next);
        mergeAndPersist({ theme: next });
        return next;
      });
    };

    const langChangeHandler = (e: Event) =>
      onLangChange((e.target as HTMLSelectElement).value || 'en');
    if (langSelect) langSelect.addEventListener('change', langChangeHandler);
    if (filterBtn) filterBtn.addEventListener('click', onFilter);
    if (clearProgressBtn) clearProgressBtn.addEventListener('click', onClear);
    if (themeBtn) themeBtn.addEventListener('click', onTheme);

    // modal backdrop click to close
    const modal = document.getElementById('modal');
    const onModalClick = (e: MouseEvent) => {
      if ((e.target as HTMLElement).id === 'modal') {
        const box = document.getElementById('modal-box');
        const v = box ? box.querySelector('video') : null;
        if (v) (v as HTMLVideoElement).pause();
        if (box) box.innerHTML = '';
        modal!.classList.remove('open');
        modal!.setAttribute('aria-hidden', 'true');
      }
    };
    if (modal) modal.addEventListener('click', onModalClick);

    // initial theme/filter UI is applied when reading persisted UI above

    return () => {
      if (lazyObserver.current) lazyObserver.current.disconnect();
      if (langSelect) langSelect.removeEventListener('change', langChangeHandler);
      if (filterBtn) filterBtn.removeEventListener('click', onFilter);
      if (clearProgressBtn) clearProgressBtn.removeEventListener('click', onClear);
      if (themeBtn) themeBtn.removeEventListener('click', onTheme);
      if (modal) modal.removeEventListener('click', onModalClick);
    };
  }, []);

  useEffect(() => {
    // observe new thumbs
    requestAnimationFrame(() => {
      document.querySelectorAll('.thumb').forEach(t => {
        if (!(t as any).dataset.loaded) lazyObserver.current && lazyObserver.current.observe(t);
      });
    });
  }, [data, filter]);

  useEffect(() => {
    applyTheme(theme);
    updateFilterLabel(filter);
    if (!didSyncUI.current) {
      didSyncUI.current = true;
      return;
    }
    saveUI();
  }, [lang, filter, theme]);

  function saveUI() {
    try {
      localStorage.setItem(UI_KEY, JSON.stringify({ lang, filter, theme }));
    } catch (e) {}
  }

  // helper to read localized UI strings loaded into window._bbdrills_loc (see src/site/i18n.ts)

  function localizedDrillField(item: any, field: string) {
    return localizedField(item, field, lang);
  }

  function applyTheme(themeVal: 'system' | 'dark' | 'light') {
    const btn = document.getElementById('theme-btn');
    if (themeVal === 'system') {
      document.documentElement.removeAttribute('data-theme');
      if (btn) btn.textContent = t('theme_system', 'Theme: system');
    } else {
      document.documentElement.setAttribute('data-theme', themeVal);
      if (btn) btn.textContent = t('theme', 'Theme') + ': ' + themeVal;
    }
  }

  function updateFilterLabel(f: 'all' | 'incomplete') {
    const filterBtn = document.getElementById('filter-btn');
    if (filterBtn)
      filterBtn.textContent =
        f === 'all' ? t('show_all', 'Show: All') : t('show_incomplete', 'Show: Incomplete');
  }

  const openVideo = (item: Drill) => {
    // collect visible items from DOM order
    const idMap = new Map<string, Drill>();
    data.forEach(it => idMap.set(it.id, it));
    const modalVisible: Drill[] = [];
    Array.from(document.querySelectorAll('.card')).forEach(c => {
      const id = (c as HTMLElement).dataset.id;
      if (id) {
        const it = idMap.get(id);
        if (it) modalVisible.push(it);
      }
    });

    let idx = modalVisible.findIndex(it => it.id === item.id);
    if (idx === -1) {
      // fallback: show only this item
      showModalForItem(item);
      return;
    }
    showModalForIndex(modalVisible, idx);
  };

  const showModalForIndex = (visible: Drill[], idx: number) => {
    const item = visible[idx];
    const modal = document.getElementById('modal')!;
    const box = document.getElementById('modal-box')!;
    box.innerHTML = '';

    if (item.video_url) {
      const id = youtubeIdFromUrl(item.video_url);
      if (id && (window as any)._bbdrills_yt_api_ready) {
        const placeholder = document.createElement('div');
        placeholder.id = 'yt-player-0';
        placeholder.style.width = '100%';
        placeholder.style.height = '100%';
        box.appendChild(placeholder);
        try {
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
        window.open(normalizeUrl(item.video_url), '_blank', 'noopener,noreferrer');
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
      window.open(
        resolveAsset(item.local_video) || item.local_video,
        '_blank',
        'noopener,noreferrer'
      );
      return;
    }

    modal.classList.add('open');
    modal.setAttribute('aria-hidden', 'false');
  };

  const showModalForItem = (item: Drill) => showModalForIndex([item], 0);

  const mark = (id: string) => {
    markSetComplete(id);
    // Trigger a Preact re-render so filter mode and completed UI update immediately.
    setData(prev => prev.slice());
  };

  const renderCard = (it: Drill) => {
    const day = getDay(it.id);
    const completed =
      day.targetSets && day.targetSets > 0
        ? day.setsCompleted >= day.targetSets
        : it.sets
        ? day.setsCompleted >= it.sets
        : false;

    if (filter === 'incomplete' && completed) return null;
    const previewWebp = it.preview_webp ? resolveAsset(it.preview_webp) : null;
    const previewGif = it.gif ? resolveAsset(it.gif) : null;
    const ytThumb = it.video_url ? youtubeThumbnail(it.video_url) : '';
    const poster = completed ? previewWebp || previewGif || ytThumb || '' : '';
    // produce DOM nodes similar to original markup but using JSX
    return (
      <article key={it.id} className={'card' + (completed ? ' done' : '')} data-id={it.id}>
        <div className={'thumb'}>
          {completed ? (
            poster ? (
              <img
                src={poster}
                alt={(localizedDrillField(it, 'name') || it.name_en) + ' thumbnail'}
                className={'lazy-img'}
                onLoad={e => {
                  const img = e.currentTarget as HTMLImageElement;
                  const thumb = img.closest('.thumb');
                  if (!thumb || !img.naturalWidth || !img.naturalHeight) return;
                  thumb.classList.toggle('vertical', img.naturalHeight > img.naturalWidth);
                  thumb.classList.toggle('horizontal', img.naturalWidth >= img.naturalHeight);
                }}
              />
            ) : (
              <div style={{ height: '140px', background: 'rgba(0,0,0,0.06)' }} />
            )
          ) : (
            <>
              {it.preview_mp4 ? (
                <video
                  className={'lazy-video'}
                  data-src={resolveAsset(it.preview_mp4) || ''}
                  muted
                  playsInline
                  loop
                  preload={'none'}
                  onLoadedMetadata={e => {
                    const video = e.currentTarget as HTMLVideoElement;
                    const thumb = video.closest('.thumb');
                    if (!thumb) return;
                    const w = video.videoWidth;
                    const h = video.videoHeight;
                    thumb.classList.toggle('vertical', h > w);
                    thumb.classList.toggle('horizontal', w >= h);
                  }}
                />
              ) : previewWebp ? (
                <picture>
                  <source type={'image/webp'} className={'lazy-source'} data-srcset={previewWebp} />
                  <img
                    className={'lazy-img'}
                    data-src={previewGif || ytThumb || ''}
                    alt={(localizedDrillField(it, 'name') || it.name_en) + ' thumbnail'}
                    loading={'lazy'}
                    onLoad={e => {
                      const img = e.currentTarget as HTMLImageElement;
                      const thumb = img.closest('.thumb');
                      if (!thumb || !img.naturalWidth || !img.naturalHeight) return;
                      thumb.classList.toggle('vertical', img.naturalHeight > img.naturalWidth);
                      thumb.classList.toggle('horizontal', img.naturalWidth >= img.naturalHeight);
                    }}
                  />
                </picture>
              ) : (
                <img
                  className={'lazy-img'}
                  data-src={previewGif || ytThumb || ''}
                  alt={(localizedDrillField(it, 'name') || it.name_en) + ' thumbnail'}
                  loading={'lazy'}
                  onLoad={e => {
                    const img = e.currentTarget as HTMLImageElement;
                    const thumb = img.closest('.thumb');
                    if (!thumb || !img.naturalWidth || !img.naturalHeight) return;
                    thumb.classList.toggle('vertical', img.naturalHeight > img.naturalWidth);
                    thumb.classList.toggle('horizontal', img.naturalWidth >= img.naturalHeight);
                  }}
                />
              )}
            </>
          )}
        </div>
        <div className={'meta'}>
          <div className={'title'}>
            {localizedDrillField(it, 'name') || localizedDrillField(it, 'name_en')}
          </div>
          <div className={'details'}>
            {localizedDrillField(it, 'details') ? (
              <>
                {localizedDrillField(it, 'details')}
                <br />
              </>
            ) : null}
            <span className={'reps-label'}>{t('reps_label', 'Reps:')}</span>
            <span className={'reps-display'}>
              {(it.reps_num || localizedDrillField(it, 'reps') || '') +
                (localizedDrillField(it, 'reps_label')
                  ? ' ' + localizedDrillField(it, 'reps_label')
                  : it.reps_unit
                  ? ' ' + it.reps_unit
                  : '')}
            </span>
          </div>
          <div className={'info-row'}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div className={'sets-label'}>{t('sets_label', 'Sets:')}</div>
              <div className={'sets-display'}>
                {(day.setsCompleted || 0) +
                  '/' +
                  (day.targetSets && day.targetSets > 0 ? day.targetSets : it.sets || '-')}
              </div>
              <button className={'btn-mark'} onClick={() => mark(it.id)}>
                {t('mark_done', '+1 done')}
              </button>
              {completed && <span className={'done-badge'}>{t('done', 'Done')}</span>}
            </div>
          </div>
          <div style={{ marginTop: '6px' }}>
            <button onClick={() => openVideo(it)}>{t('open_video', 'Open video')}</button>
            {it.video_url && (
              <a
                href={normalizeUrl(it.video_url)}
                target={'_blank'}
                rel={'noopener noreferrer'}
                referrerPolicy={'no-referrer'}
                style={{ marginLeft: '8px' }}
              >
                {t('open_on_youtube', 'Open on YouTube')}
              </a>
            )}
            <button
              style={{ marginLeft: '8px' }}
              onClick={() => {
                const deep = buildDeepLink(it.id);
                if (navigator.clipboard && navigator.clipboard.writeText) {
                  navigator.clipboard
                    .writeText(deep)
                    .then(() => alert(t('copied', 'Copied!')))
                    .catch(() => prompt(t('copy_prompt', 'Copy this link'), deep));
                } else {
                  try {
                    const ta = document.createElement('textarea');
                    ta.value = deep;
                    document.body.appendChild(ta);
                    ta.select();
                    document.execCommand('copy');
                    ta.remove();
                    alert(t('copied', 'Copied!'));
                  } catch (e) {
                    prompt(t('copy_prompt', 'Copy this link'), deep);
                  }
                }
              }}
            >
              {t('share', 'Share')}
            </button>
          </div>
        </div>
      </article>
    );
  };

  // group by localized group label (fallback to legacy group_en)
  const groupsMap = new Map<string, Drill[]>();
  (data || []).forEach(item => {
    // group key should be a stable identifier (string). If manifest still has localized group object, fall back to localizedField.
    const key =
      typeof (item as any).group === 'string'
        ? (item as any).group
        : (localizedField(item, 'group', lang) as string) || (item as any).group_en || 'other';
    if (!groupsMap.has(key)) groupsMap.set(key, []);
    groupsMap.get(key)!.push(item);
  });
  const groups = Array.from(groupsMap);

  return (
    <div>
      {Array.from(groups).map(([group, items]) => {
        const title = t(
          'group.' + group,
          (items[0] && (((items[0] as any)[`group_${lang}`] as string) || items[0].group_en)) ||
            group
        );
        const rendered = items.map(it => renderCard(it));
        if (!rendered.some(x => x != null)) return null;
        return (
          <div key={group}>
            <h2 className={'group-title'}>{title}</h2>
            <div className={'grid'}>{rendered}</div>
          </div>
        );
      })}
    </div>
  );
}
