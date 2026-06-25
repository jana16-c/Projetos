const CPF_RE = /^\d{3}\.?\d{3}\.?\d{3}-?\d{2}$/;
const CNPJ_RE = /^\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}$/;
const COMPETENCIA_RE = /^(0[1-9]|1[0-2])\/\d{4}$/;
const PROCESSO_CNJ_RE = /^\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4}$/;
const CEP_RE = /^\d{5}-?\d{3}$/;
const PIS_RE = /^\d{3}\.?\d{5}\.?\d{2}-?\d$/;

const HEADER_KEYWORDS = [
  'cpf',
  'cnpj',
  'competencia',
  'matricula',
  'processo',
  'documento',
  'pis',
  'pasep',
  'nit',
  'cep',
  'cnj',
  'id',
  'codigo',
  'cod',
];

export function normalizeIdentifierLabel(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function headerSuggestsIdentifier(header) {
  const normalized = normalizeIdentifierLabel(header);
  return HEADER_KEYWORDS.some(keyword => normalized.includes(keyword));
}

export function looksLikeIdentifier(value) {
  const text = String(value || '').trim();
  if (!text) return false;
  if (CPF_RE.test(text) || CNPJ_RE.test(text) || COMPETENCIA_RE.test(text) || PROCESSO_CNJ_RE.test(text)) return true;
  if (CEP_RE.test(text) || PIS_RE.test(text)) return true;
  if (/^[0-9]{5,}$/.test(text) && /^0/.test(text)) return true;
  if (/^\d[\d./-]+\d$/.test(text) && /[./-]/.test(text)) return true;
  if (/^[A-Za-z0-9]+[./-][A-Za-z0-9./-]+$/.test(text)) return true;
  return false;
}

export function isCompetencia(value) {
  return COMPETENCIA_RE.test(String(value || '').trim());
}

export function isExplicitDate(value) {
  return /^(0?[1-9]|[12]\d|3[01])[/-](0?[1-9]|1[0-2])[/-]\d{4}$/.test(String(value || '').trim());
}

export function isMoneyLike(value) {
  const text = String(value || '').trim();
  return /^(R\$\s*)?[-(]?\d{1,3}(?:\.\d{3})*(?:,\d{2})\)?$/.test(text)
    || /^(R\$\s*)?[-(]?\d+(?:,\d{2})\)?$/.test(text);
}

export function isPercentageLike(value) {
  return /^[-+]?\d{1,3}(?:\.\d{3})*,\d+%$/.test(String(value || '').trim())
    || /^[-+]?\d+(?:,\d+)?%$/.test(String(value || '').trim());
}

export function listIdentifierPatterns() {
  return {
    CPF_RE,
    CNPJ_RE,
    COMPETENCIA_RE,
    PROCESSO_CNJ_RE,
  };
}
