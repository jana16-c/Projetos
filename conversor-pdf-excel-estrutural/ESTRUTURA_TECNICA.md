# Estrutura tecnica

## Fluxo principal

1. `assets/js/main.js` inicializa `AppController`.
2. `assets/js/ui/appController.js` le o PDF, envia o job ao backend quando disponivel e usa fallback local apenas se necessario.
3. `backend/src/routes/jobs.js` recebe o upload, cria o job e expoe:
   - `GET /api/jobs/:jobId`
   - `GET /api/jobs/:jobId/document-result`
   - `GET /api/jobs/:jobId/table-ir`
4. `backend/src/jobs/jobWorker.js` abre o PDF, decide entre texto PDF e OCR, reconcilia itens e grava:
   - `document-result.json`
   - `table-ir.json`
5. `backend/src/ocr/*` coordena a chamada do sidecar Python.
6. `ocr/engine/*` renderiza a pagina, executa Tesseract, detecta linhas, grades e estilos.
7. `assets/js/extraction/tableExtractor.js` prioriza `visualTableExtractor.js` quando `outputMode = visual-replica`.
8. `assets/js/model/resultModel.js` monta o `DocumentExtractionResult` e o `Table IR 3.0`.
9. `assets/js/export/workbookBuilder.js` e `assets/js/export/xlsmTemplateBuilder.js` consomem mesclagens, larguras, alturas, cores e bordas quando presentes.

## Document result

O `documentResult` serializado passou a carregar:

- `version: "3.0"`
- `pages`
- `sourceItems`
- `ocr`
- `tableIr`
- `tables[*].visualModel`

Cada `visualModel` pode incluir:

- `columnWidthsPt`
- `rowHeightsPt`
- `merges`
- `gridConfidence`

## OCR hibrido

O worker usa `backend/src/ocr/ocrDecision.js` para decidir entre:

- `text`
- `auto`
- `hybrid`
- `ocr`

Quando o OCR roda:

- a pagina e renderizada localmente;
- o Tesseract devolve palavras OCR;
- a grade visual gera celulas, bordas e preenchimentos;
- `reconcileItems.js` consolida texto PDF e OCR antes da extracao.

## Exportacao

### XLSX

- uma aba por tabela;
- mesclagens vindas do `visualModel`;
- larguras e alturas derivadas da geometria detectada;
- aplicacao de bordas, preenchimentos, alinhamento e quebra de linha;
- abas `_ocr_auditoria` e `_origem`.

### XLSM

- preserva VBA do modelo;
- injeta abas `EXTRACAO_*`;
- usa mesclagens e dimensoes quando disponiveis;
- inclui auditoria OCR e origem textual nas abas tecnicas do pacote.

## Testes

- `tests/*.test.mjs`: parser, continuidade, reconciliacao, grid visual, jobs backend e Table IR.
- `ocr/tests/*.py`: detector de grade, detector de estilo e analise de pagina OCR.
