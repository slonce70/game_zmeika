// Lightweight geo helper: detects country and caches in localStorage
// Strategy:
// 1) Try ipapi.co (no key, CORS OK)
// 2) Fallback to ipwho.is
// 3) Fallback to navigator.language region part

const GEO_CACHE_KEY = 'snake_geo_v1';
const GEO_TTL_MS = 24 * 60 * 60 * 1000; // 24h

export function countryCodeToFlagEmoji(code) {
  if (!code || code.length !== 2) return '';
  try {
    return code.toUpperCase().replace(/./g, ch => String.fromCodePoint(ch.charCodeAt(0) + 127397));
  } catch {
    return '';
  }
}

export async function detectCountry() {
  try {
    const cached = localStorage.getItem(GEO_CACHE_KEY);
    if (cached) {
      const { ts, data } = JSON.parse(cached);
      if (data && ts && (Date.now() - ts) < GEO_TTL_MS) {
        return data;
      }
    }
  } catch {}

  // Try ipapi.co
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 2500);
    const res = await fetch('https://ipapi.co/json/', { signal: ctrl.signal });
    clearTimeout(timer);
    if (res.ok) {
      const json = await res.json();
      const code = (json.country || '').toUpperCase();
      const name = json.country_name || '';
      if (code) {
        const data = { countryCode: code, countryName: name, flag: countryCodeToFlagEmoji(code) };
        try { localStorage.setItem(GEO_CACHE_KEY, JSON.stringify({ ts: Date.now(), data })); } catch {}
        return data;
      }
    }
  } catch {}

  // Fallback to ipwho.is
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 2500);
    const res = await fetch('https://ipwho.is/');
    clearTimeout(timer);
    if (res.ok) {
      const json = await res.json();
      const code = (json.country_code || '').toUpperCase();
      const name = json.country || '';
      if (code) {
        const data = { countryCode: code, countryName: name, flag: countryCodeToFlagEmoji(code) };
        try { localStorage.setItem(GEO_CACHE_KEY, JSON.stringify({ ts: Date.now(), data })); } catch {}
        return data;
      }
    }
  } catch {}

  // Last resort: navigator.language (e.g., en-US -> US)
  try {
    const lang = navigator.language || '';
    const m = lang.match(/-([A-Za-z]{2})$/);
    const code = m ? m[1].toUpperCase() : '';
    const data = { countryCode: code, countryName: '', flag: countryCodeToFlagEmoji(code) };
    try { localStorage.setItem(GEO_CACHE_KEY, JSON.stringify({ ts: Date.now(), data })); } catch {}
    return data;
  } catch {}

  return { countryCode: '', countryName: '', flag: '' };
}

