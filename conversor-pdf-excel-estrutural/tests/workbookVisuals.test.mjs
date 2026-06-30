import assert from 'node:assert/strict';
import {
  buildAuditRows,
  buildSingleSheetLayout,
  buildUnassignedRows,
  buildWorkbookSheetPlan,
  normalizeWorkbookTablesForExport,
} from '../assets/js/export/workbookBuilder.js';

const documentResult = {
  selectedPages: [2, 1],
  pages: [
    {
      pageNumber: 1,
      textItems: 10,
      assignedItems: 9,
      unassignedItems: 1,
      lastSourceBottom: 820,
      lastAssignedBottom: 810,
      bottomZoneSourceCount: 2,
      bottomZoneAssignedCount: 1,
      ocrApplied: false,
      visualGenerated: true,
      status: 'REVISAR',
      warnings: ['rodape final sem associacao'],
    },
    {
      pageNumber: 2,
      textItems: 4,
      assignedItems: 4,
      unassignedItems: 0,
      lastSourceBottom: 760,
      lastAssignedBottom: 760,
      bottomZoneSourceCount: 0,
      bottomZoneAssignedCount: 0,
      ocrApplied: true,
      visualGenerated: true,
      status: 'OK',
      warnings: [],
    },
  ],
  unassignedTextItems: [
    {
      id: '1:0',
      pageNumber: 1,
      text: 'FINAL',
      x: 10,
      y: 790,
      width: 40,
      height: 10,
      insideDetectedTable: true,
      tableIds: ['P1_T1'],
      inBottomZone: true,
      filteredOut: false,
    },
  ],
};

Object.defineProperty(documentResult, '_pages', {
  value: [
    {
      pageNumber: 1,
      renderedPage: { dataUrl: 'data:image/png;base64,AAA=', displayWidthPx: 794, displayHeightPx: 1123 },
      rotation: 0,
    },
    {
      pageNumber: 2,
      renderedPage: { dataUrl: 'data:image/png;base64,BBB=', displayWidthPx: 794, displayHeightPx: 1123 },
      rotation: 90,
    },
  ],
  enumerable: false,
});

const sheetPlanDocument = { ...documentResult, tables: [{ pageNumber: 1 }, { pageNumber: 2 }] };
Object.defineProperty(sheetPlanDocument, '_pages', {
  value: documentResult._pages,
  enumerable: false,
});
const sheetPlan = buildWorkbookSheetPlan(sheetPlanDocument);
assert.deepEqual(sheetPlan.map(item => item.sheetName), ['Dados_T001', 'Dados_T002']);

const cleanSheetPlan = buildWorkbookSheetPlan({
  tables: [{ pageNumber: 1 }],
  settings: { outputMode: 'clean-table' },
  pages: [],
  selectedPages: [1],
});
assert.deepEqual(cleanSheetPlan.map(item => item.sheetName), ['Dados_T001']);

const singleSheetPlan = buildWorkbookSheetPlan({
  tables: [{ pageNumber: 1 }, { pageNumber: 2 }],
  settings: { sheetMode: 'single' },
});
assert.deepEqual(singleSheetPlan.map(item => item.sheetName), ['Dados']);

const singleSheetLayout = buildSingleSheetLayout([
  {
    table: { pageNumber: 1, tableIndex: 1 },
    renderable: {
      headerRowIndex: 1,
      matrix: [
        ['Resumo', '', ''],
        ['A', 'B', 'C'],
        ['1', '2', '3'],
      ],
      cells: [
        [{ value: 'Resumo' }, { value: '' }, { value: '' }],
        [{ value: 'A' }, { value: 'B' }, { value: 'C' }],
        [{ value: '1' }, { value: '2' }, { value: '3' }],
      ],
      rowMeta: [
        { isTitle: true, cellMeta: [] },
        { isHeader: true, cellMeta: [] },
        { cellMeta: [] },
      ],
    },
  },
  {
    table: { pageNumber: 2, tableIndex: 1 },
    renderable: {
      headerRowIndex: 1,
      matrix: [
        ['Cabecalho maior', '', ''],
        ['X', 'Y', 'Z'],
        ['10', '20', '30'],
      ],
      cells: [
        [{ value: 'Cabecalho maior' }, { value: '' }, { value: '' }],
        [{ value: 'X' }, { value: 'Y' }, { value: 'Z' }],
        [{ value: '10' }, { value: '20' }, { value: '30' }],
      ],
      rowMeta: [
        { isTitle: true, cellMeta: [] },
        { isHeader: true, cellMeta: [] },
        { cellMeta: [] },
      ],
    },
  },
]);
assert.equal(singleSheetLayout.blocks.length, 2);
assert.equal(singleSheetLayout.blocks[1].startRow, 5);
assert.equal(singleSheetLayout.totalRows, 7);
assert.equal(singleSheetLayout.columnWidths[0] >= singleSheetLayout.blocks[0].columnWidths[0], true);
assert.equal(singleSheetLayout.columnWidths[0] >= singleSheetLayout.blocks[1].columnWidths[0], true);
assert.deepEqual(singleSheetLayout.blocks[1].absoluteMerges[0], {
  startRow: 4,
  endRow: 4,
  startColumn: 0,
  endColumn: 2,
});

const frontMatterTables = normalizeWorkbookTablesForExport([
  {
    pageNumber: 1,
    sourcePages: [1],
    headerRowIndex: -1,
    matrix: [
      ['Processo:', '001'],
      ['Cálculo:', '10'],
      ['PLANILHA DE CÁLCULO', ''],
      ['Reclamante:', 'FULANO'],
      ['Reclamado:', 'EMPRESA'],
    ],
    cells: [
      [{ value: 'Processo:' }, { value: '001' }],
      [{ value: 'Cálculo:' }, { value: '10' }],
      [{ value: 'PLANILHA DE CÁLCULO' }, { value: '' }],
      [{ value: 'Reclamante:' }, { value: 'FULANO' }],
      [{ value: 'Reclamado:' }, { value: 'EMPRESA' }],
    ],
    rowMeta: Array.from({ length: 5 }, () => ({ isTitle: true, cellMeta: [] })),
  },
  {
    pageNumber: 1,
    sourcePages: [1],
    headerRowIndex: 2,
    matrix: [
      ['Período do Cálculo:', '01/2020 a 12/2020'],
      ['Resumo do Cálculo', ''],
      ['Descrição', 'Total'],
      ['Verbas', '100,00'],
    ],
    cells: [
      [{ value: 'Período do Cálculo:' }, { value: '01/2020 a 12/2020' }],
      [{ value: 'Resumo do Cálculo' }, { value: '' }],
      [{ value: 'Descrição' }, { value: 'Total' }],
      [{ value: 'Verbas' }, { value: '100,00' }],
    ],
    rowMeta: [
      { isTitle: true, cellMeta: [] },
      { isTitle: true, cellMeta: [] },
      { isHeader: true, cellMeta: [] },
      { cellMeta: [] },
    ],
  },
  {
    pageNumber: 2,
    sourcePages: [2],
    headerRowIndex: -1,
    matrix: [
      ['Dados do Cálculo', ''],
      ['Estado:', 'MG'],
      ['Município:', 'CORONEL FABRICIANO'],
      ['Admissão:', '06/07/2012'],
    ],
    cells: [
      [{ value: 'Dados do Cálculo' }, { value: '' }],
      [{ value: 'Estado:' }, { value: 'MG' }],
      [{ value: 'Município:' }, { value: 'CORONEL FABRICIANO' }],
      [{ value: 'Admissão:' }, { value: '06/07/2012' }],
    ],
    rowMeta: Array.from({ length: 4 }, () => ({ isTitle: true, cellMeta: [] })),
  },
  {
    pageNumber: 3,
    sourcePages: [3],
    headerRowIndex: 1,
    matrix: [
      ['Histórico Salarial', ''],
      ['MÊS/ANO', 'VALOR'],
      ['07/2012', '0,00'],
    ],
    cells: [
      [{ value: 'Histórico Salarial' }, { value: '' }],
      [{ value: 'MÊS/ANO' }, { value: 'VALOR' }],
      [{ value: '07/2012' }, { value: '0,00' }],
    ],
    rowMeta: [
      { isTitle: true, cellMeta: [] },
      { isHeader: true, cellMeta: [] },
      { cellMeta: [] },
    ],
  },
]);
assert.equal(frontMatterTables.length, 2);
assert.equal(frontMatterTables[0].table.sourcePages.join(','), '1,2');
assert.equal(frontMatterTables[0].renderable.headerRowIndex, -1);
assert.equal(frontMatterTables[1].renderable.matrix[0][0], 'Histórico Salarial');

const normalizedTables = normalizeWorkbookTablesForExport([
  {
    pageNumber: 7,
    sourcePages: [7],
    headerRowIndex: 1,
    matrix: [
      ['Nome:', 'VERBA X', '', ''],
      ['', 'Periodo Mensal', 'Base', 'Devido'],
      ['', '03/2018', '478,22', '513,66'],
    ],
    cells: [
      [{ value: 'Nome:' }, { value: 'VERBA X' }, { value: '' }, { value: '' }],
      [{ value: '' }, { value: 'Periodo Mensal' }, { value: 'Base' }, { value: 'Devido' }],
      [{ value: '' }, { value: '03/2018' }, { value: '478,22' }, { value: '513,66' }],
    ],
    rowMeta: [
      { isTitle: true, cellMeta: [] },
      { isHeader: true, cellMeta: [] },
      { cellMeta: [] },
    ],
  },
  {
    pageNumber: 8,
    sourcePages: [8],
    headerRowIndex: 0,
    matrix: [
      ['Periodo Mensal', 'Base', 'Devido'],
      ['04/2018', '325,88', '350,03'],
    ],
    cells: [
      [{ value: 'Periodo Mensal' }, { value: 'Base' }, { value: 'Devido' }],
      [{ value: '04/2018' }, { value: '325,88' }, { value: '350,03' }],
    ],
    rowMeta: [
      { isHeader: true, cellMeta: [] },
      { cellMeta: [] },
    ],
  },
  {
    pageNumber: 11,
    sourcePages: [11],
    headerRowIndex: -1,
    matrix: [
      ['Demonstrativo de FGTS', ''],
      ['Nome:', 'FGTS 8%'],
      ['Periodo:', '07/2012 a 06/2026'],
    ],
    cells: [
      [{ value: 'Demonstrativo de FGTS' }, { value: '' }],
      [{ value: 'Nome:' }, { value: 'FGTS 8%' }],
      [{ value: 'Periodo:' }, { value: '07/2012 a 06/2026' }],
    ],
    rowMeta: [
      { isTitle: true, cellMeta: [] },
      { isTitle: true, cellMeta: [] },
      { isTitle: true, cellMeta: [] },
    ],
  },
  {
    pageNumber: 12,
    sourcePages: [12],
    headerRowIndex: 0,
    matrix: [
      ['Ocorrencia', 'Base', 'Aliquota'],
      ['07/2012', '0,00', '8%'],
    ],
    cells: [
      [{ value: 'Ocorrencia' }, { value: 'Base' }, { value: 'Aliquota' }],
      [{ value: '07/2012' }, { value: '0,00' }, { value: '8%' }],
    ],
    rowMeta: [
      { isHeader: true, cellMeta: [] },
      { cellMeta: [] },
    ],
  },
]);
assert.equal(normalizedTables.length, 2);
assert.equal(normalizedTables[0].renderable.matrix.length, 4);
assert.deepEqual(normalizedTables[0].renderable.matrix[1], ['Periodo Mensal', 'Base', 'Devido']);
assert.equal(normalizedTables[1].renderable.headerRowIndex, 3);
assert.deepEqual(normalizedTables[1].renderable.matrix[0], ['Demonstrativo de FGTS', '']);
assert.deepEqual(normalizedTables[1].renderable.matrix[3], ['Ocorrencia', 'Base', 'Aliquota']);

const crossSheetContinuationTables = normalizeWorkbookTablesForExport([
  {
    pageNumber: 6,
    sourcePages: [6, 7],
    headerRowIndex: 5,
    matrix: [
      ['Demonstrativo de Verbas', '', '', ''],
      ['Nome:', 'VERBA X', '', ''],
      ['Periodo:', '01/2014 a 12/2018', '', ''],
      ['Comentario:', '-', '', ''],
      ['Formula', '', '', ''],
      ['', 'Periodo Mensal', 'Base', 'Devido'],
      ['', '01/2014', '10,00', '10,00'],
      ['', '02/2014', '12,00', '12,00'],
    ],
    cells: [
      [{ value: 'Demonstrativo de Verbas' }, { value: '' }, { value: '' }, { value: '' }],
      [{ value: 'Nome:' }, { value: 'VERBA X' }, { value: '' }, { value: '' }],
      [{ value: 'Periodo:' }, { value: '01/2014 a 12/2018' }, { value: '' }, { value: '' }],
      [{ value: 'Comentario:' }, { value: '-' }, { value: '' }, { value: '' }],
      [{ value: 'Formula' }, { value: '' }, { value: '' }, { value: '' }],
      [{ value: '' }, { value: 'Periodo Mensal' }, { value: 'Base' }, { value: 'Devido' }],
      [{ value: '' }, { value: '01/2014' }, { value: '10,00' }, { value: '10,00' }],
      [{ value: '' }, { value: '02/2014' }, { value: '12,00' }, { value: '12,00' }],
    ],
    rowMeta: [
      { isTitle: true, cellMeta: [] },
      { isTitle: true, cellMeta: [] },
      { isTitle: true, cellMeta: [] },
      { isTitle: true, cellMeta: [] },
      { isTitle: true, cellMeta: [] },
      { isHeader: true, cellMeta: [] },
      { cellMeta: [] },
      { cellMeta: [] },
    ],
  },
  {
    pageNumber: 7,
    sourcePages: [7, 8],
    headerRowIndex: 0,
    matrix: [
      ['Periodo Mensal', 'Base', 'Devido'],
      ['03/2014', '14,00', '14,00'],
      ['04/2014', '16,00', '16,00'],
    ],
    cells: [
      [{ value: 'Periodo Mensal' }, { value: 'Base' }, { value: 'Devido' }],
      [{ value: '03/2014' }, { value: '14,00' }, { value: '14,00' }],
      [{ value: '04/2014' }, { value: '16,00' }, { value: '16,00' }],
    ],
    rowMeta: [
      { isHeader: true, cellMeta: [] },
      { cellMeta: [] },
      { cellMeta: [] },
    ],
  },
]);
assert.equal(crossSheetContinuationTables.length, 1);
assert.equal(crossSheetContinuationTables[0].renderable.headerRowIndex, 5);
assert.deepEqual(crossSheetContinuationTables[0].renderable.matrix[5], ['Periodo Mensal', 'Base', 'Devido']);
assert.deepEqual(crossSheetContinuationTables[0].renderable.matrix[9], ['04/2014', '16,00', '16,00']);

const postludeTables = normalizeWorkbookTablesForExport([
  {
    pageNumber: 16,
    sourcePages: [16],
    headerRowIndex: 0,
    matrix: [
      ['Ocorrencia', 'Base'],
      ['01/2014', '10,00'],
      ['Total', '10,00'],
    ],
    cells: [
      [{ value: 'Ocorrencia' }, { value: 'Base' }],
      [{ value: '01/2014' }, { value: '10,00' }],
      [{ value: 'Total' }, { value: '10,00' }],
    ],
    rowMeta: [
      { isHeader: true, cellMeta: [] },
      { cellMeta: [] },
      { cellMeta: [] },
    ],
  },
  {
    pageNumber: 17,
    sourcePages: [17],
    headerRowIndex: -1,
    matrix: [
      ['A partir de Marco/2020, na coluna Aliquota, consta a aliquota efetiva de apuracao da contribuicao social.'],
    ],
    cells: [
      [{ value: 'A partir de Marco/2020, na coluna Aliquota, consta a aliquota efetiva de apuracao da contribuicao social.' }],
    ],
    rowMeta: [
      { isTitle: true, cellMeta: [] },
    ],
  },
]);
assert.equal(postludeTables.length, 1);
assert.equal(postludeTables[0].renderable.matrix.at(-1)[0].startsWith('A partir de Marco/2020'), true);

const splitSectionTables = normalizeWorkbookTablesForExport([
  {
    pageNumber: 17,
    sourcePages: [17],
    headerRowIndex: 0,
    matrix: [
      ['Periodo de Referencia', 'Base', 'FGTS'],
      ['07/2012', '0,00', '0,00'],
      ['08/2012', '0,00', '0,00'],
      ['Demonstrativo de Honorarios', ''],
      ['Nome: HONORARIOS DEVIDOS PELO RECLAMADO', ''],
      ['Valores Calculados', 'C=(A x B)'],
      ['Composicao de Base:', '(Bruto) x 15,00%'],
      ['Ocorrencia', 'Descricao', 'Valor (C)'],
      ['30/06/2026', 'HONORARIOS ADVOCATICIOS', '3.848,40'],
    ],
    cells: [
      [{ value: 'Periodo de Referencia' }, { value: 'Base' }, { value: 'FGTS' }],
      [{ value: '07/2012' }, { value: '0,00' }, { value: '0,00' }],
      [{ value: '08/2012' }, { value: '0,00' }, { value: '0,00' }],
      [{ value: 'Demonstrativo de Honorarios' }, { value: '' }],
      [{ value: 'Nome: HONORARIOS DEVIDOS PELO RECLAMADO' }, { value: '' }],
      [{ value: 'Valores Calculados' }, { value: 'C=(A x B)' }],
      [{ value: 'Composicao de Base:' }, { value: '(Bruto) x 15,00%' }],
      [{ value: 'Ocorrencia' }, { value: 'Descricao' }, { value: 'Valor (C)' }],
      [{ value: '30/06/2026' }, { value: 'HONORARIOS ADVOCATICIOS' }, { value: '3.848,40' }],
    ],
    rowMeta: [
      { isHeader: true, cellMeta: [] },
      { cellMeta: [] },
      { cellMeta: [] },
      { isTitle: true, cellMeta: [] },
      { isTitle: true, cellMeta: [] },
      { isTitle: true, cellMeta: [] },
      { isTitle: true, cellMeta: [] },
      { isHeader: true, cellMeta: [] },
      { cellMeta: [] },
    ],
  },
]);
assert.equal(splitSectionTables.length, 2);
assert.deepEqual(splitSectionTables[0].renderable.matrix[0], ['Periodo de Referencia', 'Base', 'FGTS']);
assert.deepEqual(splitSectionTables[1].renderable.matrix[0].slice(0, 2), ['Demonstrativo de Honorarios', '']);

const offsetContinuationTables = normalizeWorkbookTablesForExport([
  {
    pageNumber: 16,
    sourcePages: [16, 17],
    headerRowIndex: 2,
    matrix: [
      ['Nome: CONTRIBUICAO SOCIAL SEGURADO', '', '', '', '', ''],
      ['Base(s) para Salario Pago:', '', '', '', '', ''],
      ['', '', 'Salario Pago', '', 'Teto Segurado', ''],
      ['', 'Ocorrencia', '', '', 'Aliquota (B)', ''],
      ['', '', '(A)', '', '(C)', ''],
      ['', '09/2014', '0,00', '', '8,00 %', '482,93'],
      ['', '10/2014', '0,00', '', '8,00 %', '482,93'],
      ['Ocorrencia', '', '', 'Aliquota (B)', '', ''],
      ['', '', '(A)', '', '(C)', ''],
      ['08/2016', '', '0,00', '', '8,00 %', '570,88'],
    ],
    cells: [
      [{ value: 'Nome: CONTRIBUICAO SOCIAL SEGURADO' }, { value: '' }, { value: '' }, { value: '' }, { value: '' }, { value: '' }],
      [{ value: 'Base(s) para Salario Pago:' }, { value: '' }, { value: '' }, { value: '' }, { value: '' }, { value: '' }],
      [{ value: '' }, { value: '' }, { value: 'Salario Pago' }, { value: '' }, { value: 'Teto Segurado' }, { value: '' }],
      [{ value: '' }, { value: 'Ocorrencia' }, { value: '' }, { value: '' }, { value: 'Aliquota (B)' }, { value: '' }],
      [{ value: '' }, { value: '' }, { value: '(A)' }, { value: '' }, { value: '(C)' }, { value: '' }],
      [{ value: '' }, { value: '09/2014' }, { value: '0,00' }, { value: '' }, { value: '8,00 %' }, { value: '482,93' }],
      [{ value: '' }, { value: '10/2014' }, { value: '0,00' }, { value: '' }, { value: '8,00 %' }, { value: '482,93' }],
      [{ value: 'Ocorrencia' }, { value: '' }, { value: '' }, { value: 'Aliquota (B)' }, { value: '' }, { value: '' }],
      [{ value: '' }, { value: '' }, { value: '(A)' }, { value: '' }, { value: '(C)' }, { value: '' }],
      [{ value: '08/2016' }, { value: '' }, { value: '0,00' }, { value: '' }, { value: '8,00 %' }, { value: '570,88' }],
    ],
    rowMeta: [
      { isTitle: true, cellMeta: [] },
      { isTitle: true, cellMeta: [] },
      { isHeader: true, cellMeta: [] },
      { isHeader: true, cellMeta: [] },
      { isHeader: true, cellMeta: [] },
      { cellMeta: [] },
      { cellMeta: [] },
      { isHeader: true, cellMeta: [] },
      { isHeader: true, cellMeta: [] },
      { cellMeta: [] },
    ],
  },
]);
assert.equal(offsetContinuationTables.length, 1);
assert.equal(offsetContinuationTables[0].renderable.headerRowIndex, 2);
assert.deepEqual(offsetContinuationTables[0].renderable.matrix[2].slice(0, 2), ['Salario Pago', 'Teto Segurado']);
assert.deepEqual(offsetContinuationTables[0].renderable.matrix[5], ['09/2014', '0,00', '8,00 %', '482,93']);
assert.deepEqual(offsetContinuationTables[0].renderable.matrix[7], ['08/2016', '0,00', '8,00 %', '570,88']);
assert.equal(offsetContinuationTables[0].renderable.matrix.filter(row => row.includes('Ocorrencia')).length, 1);

const continuationTitleOnlyTables = normalizeWorkbookTablesForExport([
  {
    pageNumber: 3,
    sourcePages: [3, 4, 5],
    headerRowIndex: 2,
    matrix: [
      ['Historico Salarial', ''],
      ['OCORRENCIAS DO HISTORICO SALARIAL', ''],
      ['MES/ANO', 'VALOR'],
      ['07/2012', '0,00'],
      ['08/2012', '0,00'],
      ['OCORRENCIAS DO HISTORICO SALARIAL', ''],
      ['09/2012', '56,35'],
      ['10/2012', '283,91'],
    ],
    cells: [
      [{ value: 'Historico Salarial' }, { value: '' }],
      [{ value: 'OCORRENCIAS DO HISTORICO SALARIAL' }, { value: '' }],
      [{ value: 'MES/ANO' }, { value: 'VALOR' }],
      [{ value: '07/2012' }, { value: '0,00' }],
      [{ value: '08/2012' }, { value: '0,00' }],
      [{ value: 'OCORRENCIAS DO HISTORICO SALARIAL' }, { value: '' }],
      [{ value: '09/2012' }, { value: '56,35' }],
      [{ value: '10/2012' }, { value: '283,91' }],
    ],
    rowMeta: [
      { isTitle: true, cellMeta: [] },
      { isTitle: true, cellMeta: [] },
      { isHeader: true, cellMeta: [] },
      { cellMeta: [] },
      { cellMeta: [] },
      { isTitle: true, cellMeta: [] },
      { cellMeta: [] },
      { cellMeta: [] },
    ],
  },
]);
assert.equal(continuationTitleOnlyTables.length, 1);
assert.deepEqual(continuationTitleOnlyTables[0].renderable.matrix[0], ['Historico Salarial', '']);
assert.equal(continuationTitleOnlyTables[0].renderable.matrix.filter(row => row.includes('09/2012')).length, 1);
assert.equal(continuationTitleOnlyTables[0].renderable.matrix.filter(row => row.includes('10/2012')).length, 1);

const sparseCellsTables = normalizeWorkbookTablesForExport([
  {
    pageNumber: 21,
    sourcePages: [21],
    headerRowIndex: 1,
    matrix: [
      ['', '', 'Base de Cálculo - 13º Salário - Contribuição', '', '', ''],
      ['Período de Referência', '', 'Base de Cálculo - Contribuição', '', 'Base de Cálculo - FGTS', ''],
      ['', '', 'Previdenciária', '', '', ''],
      ['11/2013', '0,00', '0,00', '0,00', '', ''],
    ],
    cells: [
      [{ value: '' }, { value: '' }, { value: 'Base de Cálculo - 13º Salário - Contribuição' }, { value: '' }, { value: '' }, { value: '' }],
      [{ value: 'Período de Referência' }, { value: '' }, { value: 'Base de Cálculo - Contribuição' }, { value: '' }, { value: 'Base de Cálculo - FGTS' }, { value: '' }],
      [{ value: '' }, { value: '' }, { value: 'Previdenciária' }, { value: '' }, { value: '' }, { value: '' }],
      [{ value: '11/2013' }, { value: '0,00' }, {}, {}, {}, {}],
    ],
    rowMeta: [
      { isTitle: true, cellMeta: [] },
      { isHeader: true, cellMeta: [] },
      { isTitle: true, cellMeta: [] },
      { cellMeta: [] },
    ],
  },
]);
assert.equal(sparseCellsTables.length, 1);
assert.equal(sparseCellsTables[0].renderable.cells[3][2].value, '0,00');
assert.equal(sparseCellsTables[0].renderable.cells[3][3].value, '0,00');

const auditRows = buildAuditRows(documentResult);
assert.equal(auditRows[0][0], 1);
assert.equal(auditRows[0][10], 'REVISAR');

const unassignedRows = buildUnassignedRows(documentResult);
assert.equal(unassignedRows[0][7], 'sim');
assert.equal(unassignedRows[0][8], 'P1_T1');

console.log('workbookVisuals.test.mjs OK');
