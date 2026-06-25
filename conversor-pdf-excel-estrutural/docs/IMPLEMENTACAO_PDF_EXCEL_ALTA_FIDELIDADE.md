# Implementação — PDF para Excel de Máxima Fidelidade com JavaScript e Node.js

> Repositório: `jana16-c/Projetos`  
> Projeto: `conversor-pdf-excel-estrutural`  
> Uso: documento de execução para Codex

## 1. Objetivo

Evoluir o conversor atual para reconstruir tabelas de páginas específicas de PDFs textuais em XLSX ou XLSM, preservando ao máximo:

- textos e valores literalmente;
- linhas, colunas e células vazias;
- células mescladas;
- larguras, alturas e posições relativas;
- bordas, preenchimentos e alinhamentos;
- fontes e tamanhos aproximados;
- cabeçalhos e títulos;
- continuação da tabela entre páginas.

A solução deve ser local, gratuita, auditável e implementada em JavaScript/Node.js.

## 2. Escopo fechado

### Implementar

- PDFs textuais/nativos;
- seleção de páginas, como `1-3, 5, 8-10`;
- extração de texto, coordenadas, fontes e rotação;
- leitura das operações gráficas do PDF;
- identificação de linhas, retângulos, bordas e preenchimentos;
- tabelas com ou sem bordas;
- reconstrução geométrica de células;
- preservação de células vazias;
- detecção de mesclagens;
- continuação entre páginas;
- prévia sobre o PDF;
- editor manual;
- XLSX e XLSM;
- testes de conservação do conteúdo.

### Não implementar

- IA;
- OCR;
- Python;
- Apryse;
- API paga ou externa;
- interpretação ou recálculo de valores;
- alteração silenciosa do texto.

PDFs sem camada textual devem ser rejeitados com mensagem clara.

## 3. Meta de fidelidade

PDF e Excel usam modelos de layout diferentes. A meta não é igualdade binária, mas:

1. **Conteúdo exato:** nenhum texto ou número alterado.
2. **Estrutura equivalente:** mesmas divisões, células vazias e mesclagens.
3. **Geometria proporcional:** larguras, alturas e posições relativas próximas.
4. **Estilo semelhante:** bordas, preenchimentos, fontes e alinhamentos quando disponíveis.
5. **Nenhum erro silencioso:** toda dúvida deve aparecer no diagnóstico ou na revisão.

A prioridade obrigatória é:

```text
conteúdo correto
→ estrutura correta
→ geometria proporcional
→ estilo semelhante
```

## 4. Modos de saída

### 4.1 Réplica geométrica — padrão

Busca máxima semelhança visual.

- Cada fronteira horizontal relevante do PDF vira limite de coluna.
- Cada fronteira vertical relevante vira limite de linha.
- Textos que ocupam áreas maiores usam células mescladas.
- Larguras e alturas seguem as proporções do PDF.
- Bordas e preenchimentos são reproduzidos.

Pode gerar mais colunas e mesclagens, mas preserva melhor cabeçalhos complexos.

### 4.2 Tabela limpa

Busca facilidade de edição, filtro e cálculo.

- Consolida colunas auxiliares.
- Reduz mesclagens não essenciais.
- Mantém cabeçalhos, dados e valores.
- Produz uma matriz mais regular.

Os dois modos usam a mesma extração e o mesmo modelo intermediário.

## 5. Arquitetura

```text
Frontend HTML/CSS/JavaScript
        │
        ▼
Backend local Node.js
        │
        ├── upload, páginas, jobs e cancelamento
        ├── worker_threads
        ├── pdfjs-dist
        └── exportação
                │
                ▼
Núcleo estrutural JavaScript
        │
        ├── texto e coordenadas
        ├── operações gráficas
        ├── grade geométrica
        ├── células e mesclagens
        └── TableIR
                │
                ▼
ExcelJS → XLSX
Modelo existente → XLSM
```

O backend deve escutar somente em `127.0.0.1` e apagar temporários após sucesso, erro ou cancelamento.

## 6. Estrutura de pastas

```text
conversor-pdf-excel-estrutural/
├── index.html
├── ABRIR_APP_WINDOWS.bat
├── README.md
├── assets/
│   ├── css/
│   └── js/
│       ├── api/
│       │   └── jobsApi.js
│       ├── ui/
│       │   ├── appController.js
│       │   ├── preview.js
│       │   ├── overlay.js
│       │   └── tableEditor.js
│       └── vendor/
├── backend/
│   ├── package.json
│   ├── package-lock.json
│   └── src/
│       ├── server.js
│       ├── routes/
│       ├── jobs/
│       │   ├── jobManager.js
│       │   ├── jobCleanup.js
│       │   └── jobWorker.js
│       ├── pdf/
│       │   ├── loadPdf.js
│       │   ├── inspectPdf.js
│       │   ├── selectPages.js
│       │   ├── extractText.js
│       │   ├── extractGraphics.js
│       │   ├── renderPage.js
│       │   └── coordinateSystem.js
│       └── export/
│           ├── excelRenderer.js
│           ├── xlsmRenderer.js
│           └── workbookValidator.js
├── core/
│   ├── model/
│   │   └── tableIr.js
│   ├── geometry/
│   │   ├── boxes.js
│   │   ├── intervals.js
│   │   ├── clustering.js
│   │   ├── intersections.js
│   │   └── transforms.js
│   ├── extraction/
│   │   ├── rows.js
│   │   ├── textSegments.js
│   │   ├── vectorPrimitives.js
│   │   ├── tableRegions.js
│   │   ├── gridDetector.js
│   │   ├── borderlessDetector.js
│   │   ├── cellBuilder.js
│   │   ├── textBinder.js
│   │   ├── mergeDetector.js
│   │   ├── continuation.js
│   │   └── styleExtractor.js
│   ├── layout/
│   │   ├── replicaLayout.js
│   │   ├── cleanTableLayout.js
│   │   ├── columnWidths.js
│   │   └── rowHeights.js
│   └── validation/
│       ├── contentConservation.js
│       ├── topologyValidation.js
│       ├── geometryValidation.js
│       └── confidence.js
├── tests/
│   ├── unit/
│   ├── integration/
│   ├── regression/
│   ├── golden/
│   └── fixtures/
├── temp/
│   └── .gitkeep
└── docs/
    └── IMPLEMENTACAO_PDF_EXCEL_ALTA_FIDELIDADE.md
```

A migração deve ser incremental. Não mover o frontend inteiro na primeira etapa.

## 7. Dependências sugeridas

Backend:

- `fastify`;
- `@fastify/multipart`;
- `pdfjs-dist`;
- `pdf-lib`;
- `exceljs`;
- `zod`;
- `pino`;
- `ulid`;
- `vitest`.

Opcional, somente para detectar linhas em imagem renderizada, sem OCR:

- `sharp`.

Regras:

- fixar versões no `package-lock.json`;
- não depender de CDN no modo local final;
- evitar bibliotecas duplicadas;
- usar ESM;
- manter o núcleo geométrico em funções puras.

## 8. TableIR 2.0

Toda reconstrução deve passar por um formato intermediário antes do Excel.

```json
{
  "version": "2.0",
  "source": {
    "fileName": "processo.pdf",
    "pageCount": 180,
    "selectedPages": [61, 62]
  },
  "settings": {
    "outputMode": "geometric-replica",
    "sheetMode": "continuous"
  },
  "pages": [
    {
      "pageNumber": 61,
      "widthPt": 595.28,
      "heightPt": 841.89,
      "rotation": 0,
      "textLayerDetected": true
    }
  ],
  "tables": [
    {
      "id": "table-0001",
      "sourcePages": [61, 62],
      "layoutMode": "vector-grid",
      "rows": 12,
      "columns": 8,
      "xBoundaries": [32.5, 91.2, 151.0],
      "yBoundaries": [145.2, 167.0, 189.5],
      "headerRows": [0, 1],
      "cells": [
        {
          "id": "cell-0001",
          "row": 0,
          "column": 0,
          "rowSpan": 2,
          "columnSpan": 1,
          "rawText": "Período",
          "displayText": "Período",
          "value": "Período",
          "valueType": "text",
          "sourceItemIds": ["61:34"],
          "bounds": {
            "pageNumber": 61,
            "x": 32.5,
            "y": 145.2,
            "width": 58.7,
            "height": 44.3
          },
          "style": {
            "fontFamily": "Arial",
            "fontSizePt": 7.5,
            "bold": true,
            "horizontalAlignment": "center",
            "verticalAlignment": "center",
            "fillArgb": "FFD9D9D9"
          },
          "confidence": {
            "content": 1,
            "geometry": 0.99,
            "style": 0.85,
            "overall": 0.96
          },
          "warnings": []
        }
      ],
      "pageBreaks": [],
      "warnings": []
    }
  ],
  "unassignedTextItems": [],
  "warnings": []
}
```

## 9. Conservação obrigatória do conteúdo

Todo texto do Excel deve vir do PDF.

Permitido:

- concatenar itens da mesma célula;
- preservar quebras de linha;
- remover caracteres de controle inválidos;
- criar célula vazia quando a geometria mostrar que ela existe;
- converter para número somente quando for reversível e seguro.

Proibido:

- inventar ou completar texto;
- corrigir ortografia;
- recalcular valor;
- trocar separador decimal;
- remover zeros à esquerda;
- alterar datas, sinais ou códigos.

Cada `sourceItemId` deve aparecer exatamente uma vez em uma célula ou na lista `unassignedTextItems`.

```javascript
export function validateContentConservation(sourceItems, tableIr) {
  const usages = new Map();

  for (const table of tableIr.tables) {
    for (const cell of table.cells) {
      for (const id of cell.sourceItemIds) {
        usages.set(id, (usages.get(id) || 0) + 1);
      }
    }
  }

  const duplicated = [...usages.entries()]
    .filter(([, count]) => count > 1)
    .map(([id]) => id);

  const missing = sourceItems
    .filter(item => !usages.has(item.id))
    .map(item => item.id);

  return {
    valid: duplicated.length === 0 && missing.length === 0,
    duplicated,
    missing
  };
}
```

## 10. Sistema de coordenadas

Usar um único sistema:

- origem no canto superior esquerdo;
- `x` cresce para a direita;
- `y` cresce para baixo;
- unidades em pontos do PDF;
- rotação normalizada;
- transformações centralizadas.

Criar:

```javascript
pdfPointToViewport()
viewportPointToPdf()
normalizeRotation()
transformBox()
intersectBoxes()
boxCenter()
overlapRatio()
```

Nenhum módulo pode misturar coordenadas sem transformação explícita.

## 11. Extração de texto

Para cada item, preservar:

- `str` original;
- texto limpo separado;
- transformação;
- caixa completa;
- fonte;
- tamanho;
- negrito e itálico;
- direção;
- `hasEOL`;
- página;
- ID único.

Não decidir a coluna apenas pelo `x` inicial. Usar a caixa inteira.

## 12. Extração de elementos gráficos

A principal evolução sobre o código atual será processar a lista de operações gráficas do PDF.js.

Manter estado de:

- matriz de transformação;
- largura da linha;
- cor do traço;
- cor de preenchimento;
- caminhos;
- salvar/restaurar estado;
- `stroke`, `fill` e `fillStroke`.

Converter caminhos em primitivas:

```javascript
{
  type: "line",
  x1: 32.5,
  y1: 145.2,
  x2: 558.5,
  y2: 145.2,
  orientation: "horizontal",
  widthPt: 0.5,
  strokeArgb: "FF000000"
}
```

```javascript
{
  type: "rectangle",
  x: 32.5,
  y: 145.2,
  width: 526,
  height: 22,
  stroke: true,
  fill: true,
  strokeArgb: "FF000000",
  fillArgb: "FFD9D9D9"
}
```

Unir linhas colineares próximas e remover duplicatas de pintura.

## 13. Detecção de regiões tabulares

Combinar:

- linhas horizontais e verticais;
- retângulos repetidos;
- alinhamento de textos;
- densidade numérica;
- espaçamento regular;
- cabeçalhos em negrito;
- repetição entre páginas.

Cada região deve receber evidências e confiança. Regiões fracas devem ser destacadas na prévia.

## 14. Grade com bordas

Quando houver vetores:

1. coletar linhas horizontais e verticais;
2. agrupar coordenadas próximas;
3. criar `xBoundaries` e `yBoundaries`;
4. formar retângulos candidatos;
5. validar bordas;
6. identificar divisórias ausentes;
7. inferir mesclagens;
8. criar células vazias;
9. associar textos por interseção.

A célula deve nascer da grade, não do texto. Isso é obrigatório para preservar vazios.

## 15. Tabelas sem bordas

Quando não houver grade suficiente:

1. agrupar textos por sobreposição vertical;
2. separar segmentos por lacunas;
3. coletar início, centro e fim dos segmentos;
4. detectar alinhamentos recorrentes;
5. modelar cabeçalho e corpo separadamente;
6. inferir intervalos de coluna;
7. validar estabilidade em várias linhas;
8. criar vazios esperados;
9. tratar linhas de continuação.

Modelo de coluna:

```javascript
{
  index: 0,
  left: 32.5,
  right: 91.2,
  alignment: "left",
  support: 18,
  confidence: 0.94
}
```

Ordem de associação:

1. maior área de interseção;
2. centro dentro do intervalo;
3. alinhamento compatível;
4. menor distância, somente como último recurso.

## 16. Células e mesclagens

Fluxo:

```text
fronteiras X/Y
→ retângulos básicos
→ presença das divisórias
→ mesclagens
→ células finais
→ associação dos textos
```

Mesclar horizontalmente quando a divisória vertical estiver ausente na faixa e as bordas externas forem contínuas.

Mesclar verticalmente quando a divisória horizontal estiver ausente e as laterais forem contínuas.

Mesclagens sem suporte vetorial devem ter confiança menor e aparecer na revisão.

## 17. Associação de texto

Para cada item:

1. encontrar células da mesma página;
2. calcular interseção;
3. escolher a maior;
4. desempatar pelo centro;
5. impedir duplicação;
6. preservar a ordem original.

Dentro da célula:

```text
linha visual
→ coordenada x
→ índice original
```

Inserir quebra de linha somente quando houver evidência visual ou `hasEOL`.

## 18. Cabeçalhos, títulos e totais

Cabeçalho pode ser indicado por:

- posição inicial;
- negrito;
- preenchimento;
- centralização;
- repetição na próxima página;
- células mescladas.

Título pode ser indicado por:

- célula ocupando toda a largura;
- fonte maior;
- negrito;
- posição anterior ao cabeçalho.

Total pode ser indicado por:

- `TOTAL`, `SUBTOTAL` ou `TOTAL GERAL`;
- borda superior;
- negrito;
- posição final.

A classificação nunca altera o conteúdo.

## 19. Continuação entre páginas

Unir tabelas quando:

- a anterior termina perto do rodapé;
- a seguinte começa perto do topo;
- as proporções das colunas são equivalentes;
- o cabeçalho se repete;
- os tipos de dados são compatíveis;
- não há novo título independente.

Ao unir:

- remover cabeçalho repetido;
- manter página de origem por linha;
- registrar `pageBreaks`;
- guardar o cabeçalho removido;
- permitir desfazer no editor.

## 20. Estilo

Extrair quando possível:

- família e tamanho de fonte;
- negrito e itálico;
- cor do texto;
- preenchimento;
- bordas e espessuras;
- alinhamento;
- rotação;
- quebra de linha.

Normalizar nomes internos de fonte, mas guardar o nome original no diagnóstico.

O alinhamento deve ser inferido pela posição real do texto dentro da célula, não pelo tipo do valor.

## 21. Réplica geométrica no Excel

- altura de linha baseada em pontos;
- largura de coluna calculada por função central calibrada;
- mesclar o intervalo correspondente à caixa do PDF;
- aplicar `wrapText`;
- preservar alinhamento vertical;
- evitar `shrinkToFit` quando distorcer a aparência.

Configuração central:

```javascript
{
  referenceFont: "Arial",
  referenceFontSizePt: 8,
  pixelsPerExcelWidthUnit: 7,
  horizontalPaddingPx: 5
}
```

Não espalhar fórmulas de conversão pelo código.

## 22. Prévia e editor

Painel esquerdo:

- página renderizada;
- região da tabela;
- linhas e colunas;
- caixas dos textos;
- células e mesclagens;
- itens não associados.

Painel direito:

- grade reconstruída;
- estilo aproximado;
- confiança;
- página de origem.

Permitir:

- editar e restaurar texto;
- mover item para outra célula;
- unir/separar células;
- adicionar/remover linha ou coluna;
- marcar cabeçalho/título;
- desfazer;
- restaurar extração;
- desfazer união entre páginas.

## 23. Confiança determinística

```javascript
overall =
  geometryConfidence * 0.40 +
  contentBindingConfidence * 0.35 +
  topologyConfidence * 0.15 +
  styleConfidence * 0.10;
```

Penalizar:

- item não associado;
- texto atravessando células;
- linha incompleta;
- fronteira inferida apenas por espaço;
- mesclagem sem suporte;
- coluna instável;
- duplicação;
- cabeçalho incompatível.

Limites iniciais:

```text
>= 0,95  aprovado
0,85–0,949  aviso
0,70–0,849  revisão recomendada
< 0,70  revisão obrigatória
```

## 24. API local

```text
POST   /api/jobs
GET    /api/jobs/:jobId
GET    /api/jobs/:jobId/table-ir
PUT    /api/jobs/:jobId/table-ir
GET    /api/jobs/:jobId/preview/:pageNumber
POST   /api/jobs/:jobId/export
GET    /api/jobs/:jobId/result
DELETE /api/jobs/:jobId
```

Criação:

```text
pdf
pages
outputMode=geometric-replica|clean-table
sheetMode=table|page|continuous
output=xlsx|xlsm
includeDiagnostics=true|false
template=arquivo.xlsm opcional
```

Estados:

```text
queued
validating
loading-pdf
extracting-text
extracting-graphics
detecting-regions
detecting-grid
building-cells
binding-text
detecting-merges
merging-pages
validating-content
building-preview
awaiting-review
generating-excel
completed
failed
cancelled
```

## 25. worker_threads

O processamento pesado deve ocorrer em `worker_threads`.

Entrada:

```javascript
{
  jobId,
  inputPdfPath,
  selectedPages,
  settings,
  tempDir
}
```

Progresso:

```javascript
parentPort.postMessage({
  type: "progress",
  stage: "binding-text",
  progress: 62,
  message: "Associando textos às células."
});
```

Usar `AbortController`, checagem entre páginas e limpeza em `finally`.

## 26. Exportação XLSX

O renderer deve:

1. criar abas;
2. mapear fronteiras para linhas/colunas;
3. aplicar larguras e alturas;
4. aplicar mesclagens;
5. escrever valores;
6. aplicar estilo;
7. inserir comentários de revisão;
8. criar `_DIAGNOSTICO` opcional;
9. validar;
10. salvar.

Manter como texto:

- CPF e CNPJ;
- matrícula;
- número de processo;
- competência;
- códigos;
- identificadores longos;
- valores com zero à esquerda;
- datas ambíguas.

Converter números somente quando a conversão puder ser revertida sem perda.

## 27. Exportação XLSM

Preservar o fluxo existente.

- nunca renomear XLSX para XLSM;
- preservar `vbaProject.bin`;
- preservar macros, relacionamentos e abas existentes;
- substituir apenas a faixa alvo;
- validar o arquivo final.

## 28. Diagnóstico e referência

A aba `_DIAGNOSTICO` pode conter:

- páginas;
- tabelas;
- células;
- itens não associados;
- duplicações;
- baixa confiança;
- tabelas unidas;
- cabeçalhos removidos;
- tempo por etapa;
- avisos.

Opcionalmente, criar `_REFERENCIA` com imagens das tabelas originais para conferência. A imagem não substitui as células editáveis.

## 29. Segurança

- servidor em `127.0.0.1`;
- sem upload externo;
- sem telemetria de conteúdo;
- pasta temporária por job;
- limpeza em sucesso, falha e cancelamento;
- `temp/` no `.gitignore`;
- PDFs reais fora do Git;
- fixtures anonimizadas;
- limite de tamanho e páginas;
- validação da assinatura `%PDF`.

## 30. Testes

### Unitários

- coordenadas;
- caixas e interseções;
- linhas e segmentos;
- fronteiras;
- grade;
- mesclagens;
- associação de texto;
- conservação;
- continuação;
- dimensões do Excel;
- tipagem segura.

### Golden

Para cada fixture:

```text
entrada.pdf
paginas.txt
settings.json
expected.table-ir.json
expected.xlsx
```

Comparar valores, ordem, linhas, colunas, mesclagens, dimensões, estilos principais e itens não associados.

Não comparar XLSX byte a byte.

### Regressão

Criar fixture para cada bug:

- valor deslocado;
- vazio perdido;
- texto duplicado;
- última linha/página ignorada;
- CPF unido à linha anterior;
- cabeçalho repetido;
- zero à esquerda removido.

## 31. Critérios de aceitação

```text
source_item_conservation = 100%
numeric_exact_match = 100%
duplicated_text_count = 0
silent_content_change_count = 0
```

Além disso:

- toda omissão aparece no diagnóstico;
- células vazias são preservadas em grades;
- mesclagens comuns são reproduzidas;
- seleção de páginas é respeitada;
- XLSX abre sem reparo;
- XLSM preserva macros;
- temporários são apagados.

## 32. Fases

### Fase 0 — Baseline

Fixtures, resultados atuais, falhas conhecidas e teste de conservação.

### Fase 1 — TableIR 2.0

Schema, adaptador, IDs de origem, validação, migração da exportação.

### Fase 2 — Backend Node.js

Servidor local, jobs, status, cancelamento, download, temporários e workers.

### Fase 3 — Operações gráficas

Caminhos, transformações, linhas, retângulos, cores e testes.

### Fase 4 — Grade vetorial

Regiões, fronteiras, vazios, mesclagens, associação e prévia.

### Fase 5 — Sem bordas

Alinhamentos, intervalos, cabeçalho/corpo, continuidades e confiança.

### Fase 6 — Réplica geométrica

Conversão para linhas/colunas do Excel, dimensões, estilos e mesclagens.

### Fase 7 — Continuação entre páginas

Assinaturas, cabeçalhos repetidos, `pageBreaks` e desfazer.

### Fase 8 — Editor e diagnóstico

Overlay, revisão, edição, restauração e abas auxiliares.

### Fase 9 — XLSM e Windows

Preservação das macros, inicializador e documentação final.

## 33. Prompts para o Codex

### Lote 1

```text
Leia o README, a pasta conversor-pdf-excel-estrutural e este documento.
Implemente somente TableIR 2.0, adaptador do resultado atual, validação de
sourceItemIds, detecção de duplicações/ausências e testes. Não altere o layout.
Não implemente backend, IA, OCR, Python ou Apryse.
```

### Lote 2

```text
Implemente somente o backend Node.js local: Fastify, upload, jobs, status,
cancelamento, download, limpeza e worker_threads. Reaproveite o frontend.
Não altere o motor estrutural neste lote.
```

### Lote 3

```text
Use pdfjs-dist para extrair operações gráficas, controlar transformações e
produzir linhas e retângulos normalizados. Não implemente a grade ainda.
Adicione fixtures e testes.
```

### Lote 4

```text
Implemente regiões tabulares, fronteiras X/Y, células vazias, divisórias,
mesclagens e associação por maior interseção. Nunca altere rawText.
Gere TableIR validado e prévia.
```

### Lote 5

```text
Substitua a regra de âncora mais próxima por intervalos de coluna obtidos de
alinhamentos de início, centro e fim. Modele cabeçalho e corpo separadamente.
Preserve vazios, continuidades e sourceItemIds.
```

### Lote 6

```text
Implemente geometric-replica no ExcelJS: fronteiras, dimensões proporcionais,
mesclagens, bordas, preenchimentos, fontes e alinhamentos. Centralize a
conversão de pontos para unidades do Excel.
```

### Lote 7

```text
Una tabelas por assinatura de cabeçalhos e proporções de colunas. Remova
cabeçalhos repetidos, preserve pageBreaks e permita desfazer.
```

### Lote 8

```text
Adicione overlay, grade reconstruída, itens não associados, baixa confiança e
edição manual. Reaproveite o editor existente e permita restaurar.
```

### Lote 9

```text
Fortaleça a preservação de vbaProject.bin, valide XLSM, crie inicializador
Windows e documente instalação. Não use serviços externos ou pagos.
```

## 34. Regras para economizar tokens no Codex

```text
- Implemente somente o lote pedido.
- Não reescreva arquivos sem necessidade.
- Não faça refatoração estética fora do escopo.
- Reaproveite funções existentes.
- Não cole arquivos completos na resposta.
- Informe caminhos, resumo e testes.
- Rode primeiro testes relacionados.
- Não instale dependências duplicadas.
- Não use IA, OCR, Python, Apryse ou API externa.
- Não remova XLSM.
- Não altere texto silenciosamente.
- Não use apenas x inicial para decidir coluna.
- Preserve sourceItemIds.
- Preserve layout e paleta atuais.
```

## 35. Definição de pronto

- aplicação local no Windows;
- PDF textual e páginas específicas;
- tabelas com e sem bordas suportadas;
- células vazias e mesclagens;
- valores preservados literalmente;
- continuação entre páginas;
- prévia, overlay e correção manual;
- XLSX e XLSM;
- funcionamento sem internet;
- sem IA, OCR ou serviço pago;
- temporários apagados;
- testes de regressão.

## 36. Limitações

- PDFs escaneados sem texto não serão convertidos;
- fontes ausentes poderão ser substituídas;
- gráficos muito complexos podem não ser reproduzidos;
- pequenas diferenças métricas entre PDF e Excel podem permanecer;
- tabelas extremamente irregulares podem exigir revisão;
- texto desenhado como curvas não será recuperado como texto.

## 37. Orientação final

A evolução central deve seguir esta ordem:

```text
operações vetoriais
→ grade geométrica
→ células antes do texto
→ associação por interseção
→ conservação de sourceItemIds
→ réplica proporcional no Excel
```

Essa arquitetura mantém o projeto gratuito, local e auditável, usando JavaScript e Node.js como base integral.
