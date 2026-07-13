export type Drill = any;

export type Helpers = {
  t: (k: string, def?: string) => string;
  localizedDrillField: (item: Drill, field: string) => any;
  getDay: (id: string) => any;
  resolveAsset: (p?: string | null) => string | null;
  youtubeThumbnail: (u?: string) => string;
  buildDeepLink: (id: string) => string;
  openVideo: (item: Drill) => void;
  markSetComplete: (id: string) => void;
  updateCardById: (id: string, item: Drill) => void;
  // normalize urls to absolute https forms when needed
  normalizeUrl: (u?: string) => string;
};

export function createCard(item: Drill, helpers: Helpers) {
  const {
    t,
    localizedDrillField,
    getDay,
    resolveAsset,
    youtubeThumbnail,
    buildDeepLink,
    openVideo,
    markSetComplete,
    updateCardById,
    normalizeUrl,
  } = helpers;

  const day = getDay(item.id);
  const completed =
    day.targetSets && day.targetSets > 0
      ? day.setsCompleted >= day.targetSets
      : item.sets
      ? day.setsCompleted >= item.sets
      : false;

  const card = document.createElement('article');
  card.className = 'card' + (completed ? ' done' : '');
  card.dataset.id = item.id;

  const thumb = document.createElement('div');
  thumb.className = 'thumb';
  const previewWebp = item.preview_webp ? resolveAsset(item.preview_webp) : null;
  const previewGif = item.gif ? resolveAsset(item.gif) : null;
  const ytThumb = item.video_url ? youtubeThumbnail(item.video_url) : '';
  const poster = previewWebp || previewGif || ytThumb || '';

  if (completed) {
    if (poster) {
      const img = document.createElement('img');
      img.src = poster;
      img.alt = (localizedDrillField(item, 'name') || item.name_en) + ' thumbnail';
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
    if (item.preview_mp4) thumb.dataset.mp4 = resolveAsset(item.preview_mp4) as any;
    if (item.preview_mp4 || thumb.dataset.mp4) {
      const video = document.createElement('video');
      video.dataset.src = resolveAsset(item.preview_mp4 || thumb.dataset.mp4) as any;
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
      img.alt = (localizedDrillField(item, 'name') || item.name_en) + ' thumbnail';
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
      img.alt = item.name_en + ' thumbnail';
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
  if (!completed) thumb.addEventListener('click', () => openVideo(item));

  const meta = document.createElement('div');
  meta.className = 'meta';

  // Title row: title + share icon
  const titleRow = document.createElement('div');
  titleRow.className = 'title-row';
  titleRow.style.display = 'flex';
  titleRow.style.alignItems = 'center';
  titleRow.style.justifyContent = 'space-between';

  const title = document.createElement('div');
  title.className = 'title';
  title.textContent = localizedDrillField(item, 'name') || item.name_en;

  const shareIconBtn = document.createElement('button');
  shareIconBtn.className = 'share-btn';
  shareIconBtn.setAttribute('aria-label', String(t('share', 'Share')));
  shareIconBtn.title = String(t('share', 'Share'));
  shareIconBtn.innerHTML = ` <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="currentColor" d="M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7a3.5 3.5 0 000-1.39l7.05-4.11A2.99 2.99 0 0018 7.92 3 3 0 109 4a3 3 0 103 3.92l7.05 4.11c.52-.47 1.2-.77 1.96-.77A3 3 0 1021 16.08z"/></svg>`;
  shareIconBtn.addEventListener('click', async ev => {
    ev.stopPropagation();
    const deep = buildDeepLink(item.id);
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
      const prevTitle = shareIconBtn.title;
      shareIconBtn.title = String(t('copied', 'Copied!'));
      setTimeout(() => (shareIconBtn.title = prevTitle), 1400);
    } catch (e) {
      prompt(String(t('copy_prompt', 'Copy this link')), deep);
    }
  });

  titleRow.appendChild(title);
  titleRow.appendChild(shareIconBtn);
  meta.appendChild(titleRow);

  const details = document.createElement('div');
  details.className = 'details';
  const detailsText = localizedDrillField(item, 'details') || item.details || '';
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
    (item.reps_num || localizedDrillField(item, 'reps') || '') +
    (localizedDrillField(item, 'reps_label')
      ? ' ' + localizedDrillField(item, 'reps_label')
      : item.reps_unit
      ? ' ' + item.reps_unit
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
  const target = day.targetSets && day.targetSets > 0 ? day.targetSets : item.sets || 0;
  const big = document.createElement('div');
  big.className = 'sets-display';
  big.textContent = (day.setsCompleted || 0) + '/' + (target || '-');
  setsWrap.appendChild(sSets);
  setsWrap.appendChild(big);
  const markBtn = document.createElement('button');
  markBtn.textContent = t('mark_done', '+1 done');
  markBtn.className = 'btn-mark';
  markBtn.addEventListener('click', async ev => {
    ev.stopPropagation();
    markSetComplete(item.id);
    updateCardById(item.id, item);
  });
  setsWrap.appendChild(markBtn);
  infoRow.appendChild(setsWrap);

  const link = document.createElement('div');
  link.style.marginTop = '6px';
  const viewBtn = document.createElement('button');
  viewBtn.textContent = t('open_video', 'Open video');
  viewBtn.addEventListener('click', e => {
    e.stopPropagation();
    openVideo(item);
  });
  link.appendChild(viewBtn);
  if (item.video_url) {
    const ext = document.createElement('a');
    ext.href = normalizeUrl(item.video_url);
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

  meta.appendChild(infoRow);
  meta.appendChild(link);
  meta.appendChild(actions);
  card.appendChild(thumb);
  card.appendChild(meta);

  return card;
}
