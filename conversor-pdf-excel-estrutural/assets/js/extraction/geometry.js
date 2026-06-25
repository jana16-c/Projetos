export function median(values, fallback = 0) {
  const arr = values.filter(Number.isFinite).sort((left, right) => left - right);
  if (!arr.length) return fallback;
  const mid = Math.floor(arr.length / 2);
  return arr.length % 2 ? arr[mid] : (arr[mid - 1] + arr[mid]) / 2;
}

export function percentile(values, p, fallback = 0) {
  const arr = values.filter(Number.isFinite).sort((left, right) => left - right);
  if (!arr.length) return fallback;
  const index = Math.max(0, Math.min(arr.length - 1, Math.round((arr.length - 1) * p)));
  return arr[index];
}

export function weightedAverage(items, valueKey, weightKey = 'width') {
  let total = 0;
  let weight = 0;
  for (const item of items) {
    const itemWeight = Math.max(1, Number(item[weightKey]) || 1);
    total += (Number(item[valueKey]) || 0) * itemWeight;
    weight += itemWeight;
  }
  return weight ? total / weight : 0;
}

export function isBoldFont(fontName = '') {
  return /bold|black|heavy|demi|semibold|extrabold/i.test(fontName);
}

export function isItalicFont(fontName = '') {
  return /italic|oblique/i.test(fontName);
}

export function cellLooksNumeric(value) {
  const text = String(value || '').trim();
  return /^[-+]?\(?\d{1,3}(?:\.\d{3})*(?:,\d+)?\)?$/.test(text)
    || /^[-+]?\d+(?:[,.]\d+)?$/.test(text)
    || /^R\$\s*[-+]?\d/.test(text);
}

export function cellLooksDate(value) {
  return /^\d{1,2}\/\d{1,2}\/\d{2,4}$/.test(String(value || '').trim())
    || /^\d{1,2}-\d{1,2}-\d{2,4}$/.test(String(value || '').trim());
}

export function normalizeNumberLike(value) {
  const text = String(value || '').trim();
  if (!cellLooksNumeric(text)) return value;
  const negative = /^\(.*\)$/.test(text);
  const cleaned = text
    .replace(/[R$\s()]/g, '')
    .replace(/\./g, '')
    .replace(',', '.');
  const number = Number(cleaned);
  return Number.isFinite(number) ? (negative ? -number : number) : value;
}

export function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export function average(values, fallback = 0) {
  const numbers = values.filter(Number.isFinite);
  if (!numbers.length) return fallback;
  return numbers.reduce((acc, value) => acc + value, 0) / numbers.length;
}

export function normalizeAscii(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function jaccardSimilarity(left, right) {
  const a = new Set(left.filter(Boolean));
  const b = new Set(right.filter(Boolean));
  if (!a.size && !b.size) return 1;
  const intersection = [...a].filter(item => b.has(item)).length;
  const union = new Set([...a, ...b]).size;
  return union ? intersection / union : 0;
}
