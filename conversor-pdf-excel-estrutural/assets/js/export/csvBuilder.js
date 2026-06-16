export function matrixToCsv(matrix) {
  return matrix.map(row => row.map(escapeCsv).join(';')).join('\r\n');
}

function escapeCsv(value) {
  const text = String(value ?? '');
  if (/[";\r\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}
