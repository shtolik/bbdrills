export async function loadLocale(lang: string) {
  try {
    let res: Response;
    try {
      res = await fetch('./locales/' + lang + '.json');
      if (!res.ok) res = await fetch('./locales/en.json');
    } catch (_) {
      res = await fetch('./locales/en.json');
    }
    const loc = await res.json();
    (window as any)._bbdrills_loc = loc;
    return loc;
  } catch (e) {
    (window as any)._bbdrills_loc = {};
    return {};
  }
}

export function t(key: string, fallback?: string) {
  try {
    const loc = (window as any)._bbdrills_loc || {};
    return (loc[key] as string) || fallback || key;
  } catch (e) {
    return fallback || key;
  }
}

export function localizedField(item: any, field: string, lang: string) {
  if (!item) return '';
  const nested = item[field];
  // if group is stored as a key string, return translated label
  if (field === 'group' && typeof nested === 'string') {
    return t('group.' + nested, nested);
  }
  // handle reps_label specially: it's a nested localized label
  if (field === 'reps_label' && nested && typeof nested === 'object') {
    // prefer lang if it's a primitive, otherwise fall back to en, then any primitive value
    const tryKeys = [lang, 'en'];
    for (const k of tryKeys) {
      const cand = nested[k];
      if (typeof cand === 'string') return cand;
      if (typeof cand === 'number') return String(cand);
    }
    // fallback: pick first primitive value found in the object
    for (const k of Object.keys(nested)) {
      const cand = nested[k];
      if (typeof cand === 'string') return cand;
      if (typeof cand === 'number') return String(cand);
    }
    return '';
  }
  // nested object e.g. name: { en: '', fi: '' }
  if (nested && typeof nested === 'object') {
    // prefer lang then en, but only accept primitive values; otherwise pick any primitive
    const tryKeys = [lang, 'en'];
    for (const k of tryKeys) {
      const cand = (nested as any)[k];
      if (typeof cand === 'string') return cand;
      if (typeof cand === 'number') return String(cand);
    }
    for (const k of Object.keys(nested)) {
      const cand = (nested as any)[k];
      if (typeof cand === 'string') return cand;
      if (typeof cand === 'number') return String(cand);
    }
    return '';
  }
  // flat fields: name_en / name_fi
  const flat = item[field + '_' + lang];
  if (typeof flat === 'string') return flat;
  if (typeof flat === 'number') return String(flat);
  const flatEn = item[field + '_en'];
  if (typeof flatEn === 'string') return flatEn;
  if (typeof flatEn === 'number') return String(flatEn);
  // final fallback: ensure we don't return an object
  const final = item[field];
  if (typeof final === 'string') return final;
  if (typeof final === 'number') return String(final);
  return '';
}
