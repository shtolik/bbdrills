import { h } from 'preact';
import { useEffect, useState, useRef } from 'preact/hooks';
import { getDay, markSetComplete, migrateLegacyIfNeeded } from '../lib/progress';

type Drill = {
  id: string;
  name_en: string;
  name_fi?: string;
  group_en?: string;
  group_fi?: string;
  preview_webp?: string;
  gif?: string;
  preview_mp4?: string;
  video_url?: string;
  local_video?: string;
  reps?: number | string;
  reps_unit?: string;
  sets?: number;
  details?: string;
};

const resolveAsset = (path?: string | null) => {
  if (!path) return null;
  if (path.startsWith('http') || path.startsWith('/')) return path;
  if (path.startsWith('site/')) return path.replace(/^site\//, '');
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

function groupBy(data: Drill[], key: string) {
  const map = new Map<string, Drill[]>();
  data.forEach(item => {
    const k = (item as any)[key] || 'Other';
    if (!map.has(k)) map.set(k, []);
    map.get(k)!.push(item);
  });
  return map;
}

export default function App() {
  const [data, setData] = useState<Drill[]>([]);
  const lazyObserver = useRef<IntersectionObserver | null>(null);

  useEffect(() => {
    migrateLegacyIfNeeded();
    (async () => {
      try {
        const res = await fetch('./default_drills_with_meta.json');
        const json = await res.json();
        setData(json);
      } catch (e) {
        const content = document.getElementById('content');
        if (content) content.innerHTML = '<p style="color:#900">Failed to load data</p>';
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

    return () => {
      if (lazyObserver.current) lazyObserver.current.disconnect();
    };
  }, []);

  useEffect(() => {
    // observe new thumbs
    requestAnimationFrame(() => {
      document.querySelectorAll('.thumb').forEach(t => {
        if (!(t as any).dataset.loaded) lazyObserver.current && lazyObserver.current.observe(t);
      });
    });
  }, [data]);

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
      } else if ((window as any).YT || youtubeIdFromUrl(item.video_url)) {
        const id = youtubeIdFromUrl(item.video_url);
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
  };

  const showModalForItem = (item: Drill) => showModalForIndex([item], 0);

  const mark = (id: string) => {
    markSetComplete(id);
    // trigger visible card update
    const setsEl = document.querySelector('.card[data-id="' + id + '"] .sets-display');
    if (setsEl) {
      const day = getDay(id);
      const target =
        day.targetSets && day.targetSets > 0
          ? day.targetSets
          : data.find(d => d.id === id)?.sets || 0;
      setsEl.textContent = (day.setsCompleted || 0) + '/' + (target || '-');
    }
    const card = document.querySelector('.card[data-id="' + id + '"]');
    if (card) {
      card.classList.add('done');
    }
  };

  const renderCard = (it: Drill) => {
    const day = getDay(it.id);
    const completed =
      day.targetSets && day.targetSets > 0
        ? day.setsCompleted >= day.targetSets
        : it.sets
        ? day.setsCompleted >= it.sets
        : false;
    const previewWebp = it.preview_webp ? resolveAsset(it.preview_webp) : null;
    const previewGif = it.gif ? resolveAsset(it.gif) : null;
    const ytThumb = it.video_url ? youtubeThumbnail(it.video_url) : '';

    const poster = completed ? previewWebp || previewGif || ytThumb || '' : '';

    // produce DOM nodes similar to original markup but using JSX
    return (
      <article className={'card' + (completed ? ' done' : '')} data-id={it.id}>
        <div className={'thumb'}>
          {completed ? (
            poster ? (
              <img src={poster} alt={it.name_en + ' thumbnail'} className={'lazy-img'} />
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
                />
              ) : previewWebp ? (
                <picture>
                  <source type={'image/webp'} className={'lazy-source'} data-srcset={previewWebp} />
                  <img
                    className={'lazy-img'}
                    data-src={previewGif || ytThumb || ''}
                    alt={it.name_en + ' thumbnail'}
                    loading={'lazy'}
                  />
                </picture>
              ) : (
                <img
                  className={'lazy-img'}
                  data-src={previewGif || ytThumb || ''}
                  alt={it.name_en + ' thumbnail'}
                  loading={'lazy'}
                />
              )}
            </>
          )}
        </div>
        <div className={'meta'}>
          <div className={'title'}>{it.name_en}</div>
          <div className={'details'}>
            {it.details}
            <br />
            <strong>Reps:</strong>{' '}
            {' ' + (it.reps || '') + (it.reps && it.reps_unit ? ' ' + it.reps_unit : '')}
          </div>
          <div className={'info-row'}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ fontWeight: 600 }}>Sets:</div>
              <div className={'sets-display'}>
                {(day.setsCompleted || 0) +
                  '/' +
                  (day.targetSets && day.targetSets > 0 ? day.targetSets : it.sets || '-')}
              </div>
              <button className={'btn-mark'} onClick={() => mark(it.id)}>
                +1 done
              </button>
            </div>
          </div>
          <div style={{ marginTop: '6px' }}>
            <button onClick={() => openVideo(it)}>Open video</button>
            {it.video_url && (
              <a
                href={it.video_url}
                target={'_blank'}
                rel={'noopener noreferrer'}
                style={{ marginLeft: '8px' }}
              >
                Open on YouTube
              </a>
            )}
          </div>
        </div>
      </article>
    );
  };

  const groups = groupBy(data || [], 'group_en');

  return (
    <div>
      {Array.from(groups).map(([group, items]) => (
        <div>
          <h2 className={'group-title'}>{group}</h2>
          <div className={'grid'}>{items.map(it => renderCard(it))}</div>
        </div>
      ))}
    </div>
  );
}
