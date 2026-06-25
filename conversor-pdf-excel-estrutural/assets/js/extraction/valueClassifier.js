import {
  headerSuggestsIdentifier,
  isCompetencia,
  isExplicitDate,
  isMoneyLike,
  isPercentageLike,
  looksLikeIdentifier,
} from '../utils/identifiers.js';

export function classifyCellValue(value, options = {}) {
  const text = String(value ?? '').trim();
  const header = String(options.header || '').trim();

  if (!text) {
    return {
      value: '',
      normalizedValue: '',
      type: 'empty',
      numberFormat: null,
      preserveAsText: false,
    };
  }

  if (isExplicitDate(text)) {
    const date = parseDate(text);
    if (date) {
      return {
        value: text,
        normalizedValue: date,
        type: 'date',
        numberFormat: 'dd/mm/yyyy',
        preserveAsText: false,
      };
    }
  }

  if (headerSuggestsIdentifier(header) || looksLikeIdentifier(text) || isCompetencia(text)) {
    return {
      value: text,
      normalizedValue: text,
      type: 'text',
      numberFormat: '@',
      preserveAsText: true,
    };
  }

  if (isPercentageLike(text)) {
    const normalized = parseLocaleNumber(text.replace('%', ''));
    if (Number.isFinite(normalized)) {
      return {
        value: text,
        normalizedValue: normalized / 100,
        type: 'percentage',
        numberFormat: '0.00%',
        preserveAsText: false,
      };
    }
  }

  if (isMoneyLike(text)) {
    const normalized = parseLocaleNumber(text);
    if (Number.isFinite(normalized)) {
      return {
        value: text,
        normalizedValue: normalized,
        type: 'number',
        numberFormat: '#,##0.00',
        preserveAsText: false,
      };
    }
  }

  return {
    value: text,
    normalizedValue: text,
    type: 'text',
    numberFormat: null,
    preserveAsText: false,
  };
}

export function attachCellClassification(matrix, cells, headerRowIndex = -1) {
  return matrix.map((row, rowIndex) => row.map((value, columnIndex) => {
    const rawCell = cells[rowIndex]?.[columnIndex] || {};
    const header = headerRowIndex >= 0 ? matrix[headerRowIndex]?.[columnIndex] : '';
    const classified = classifyCellValue(value, { header });

    return {
      ...rawCell,
      value: String(value ?? ''),
      normalizedValue: classified.normalizedValue,
      type: classified.type,
      numberFormat: classified.numberFormat,
      preserveAsText: classified.preserveAsText,
    };
  }));
}

function parseLocaleNumber(value) {
  const text = String(value || '').trim();
  const negative = text.startsWith('(') && text.endsWith(')');
  const cleaned = text
    .replace(/[R$\s()%]/g, '')
    .replace(/\./g, '')
    .replace(',', '.');
  const number = Number(cleaned);
  if (!Number.isFinite(number)) return Number.NaN;
  return negative ? -number : number;
}

function parseDate(value) {
  const match = String(value || '').trim().match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (!match) return null;
  const [, dd, mm, yyyy] = match;
  const date = new Date(Number(yyyy), Number(mm) - 1, Number(dd));
  return Number.isFinite(date.getTime()) ? date : null;
}
