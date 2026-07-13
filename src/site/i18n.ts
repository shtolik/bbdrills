export async function loadLocale(lang: string) {
  try {
    const res = await fetch('./locales/' + lang + '.json').catch(() => fetch('./locales/en.json'));
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
    if (nested[lang]) return nested[lang];
    if (nested['en']) return nested['en'];
  }
  // nested object e.g. name: { en: '', fi: '' }
  if (nested && typeof nested === 'object') {
    if (nested[lang]) return nested[lang];
    if (nested['en']) return nested['en'];
  }
  // flat fields: name_en / name_fi
  const flat = item[field + '_' + lang];
  if (flat) return flat;
  const flatEn = item[field + '_en'];
  if (flatEn) return flatEn;
  return item[field] || '';
}
