import { parsePageSpec } from './pages.js';
import { buildDefaultPageSpec, shouldApplyDefaultPageSpec, selectionSummary } from './pageSelection.js';

export function runPageSelectionSelfTest() {
  const selected = parsePageSpec('2, 4-5', 10);
  assertEqual(selected.join(','), '2,4,5', 'intervalo 2, 4-5 deve selecionar apenas 2,4,5');

  const defaultSpec = buildDefaultPageSpec(10);
  assertEqual(defaultSpec, '1-10', 'padrão de 10 páginas deve ser 1-10');

  const shouldKeepUserValue = shouldApplyDefaultPageSpec({
    currentValue: '2, 4-5',
    lastAutoValue: '1-10',
    userEdited: true,
  });
  assertEqual(String(shouldKeepUserValue), 'false', 'seleção manual não pode ser sobrescrita pelo padrão');

  const shouldApplyToEmpty = shouldApplyDefaultPageSpec({
    currentValue: '',
    lastAutoValue: '1-10',
    userEdited: false,
  });
  assertEqual(String(shouldApplyToEmpty), 'true', 'campo vazio pode receber padrão');

  const summary = selectionSummary(selected, 10);
  assertEqual(summary, '3 de 10 página(s) serão processadas: 2, 4, 5.', 'resumo deve mostrar só páginas escolhidas');

  return {
    selected,
    defaultSpec,
    summary,
  };
}

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(`${message}. Esperado: ${expected}. Obtido: ${actual}.`);
  }
}
