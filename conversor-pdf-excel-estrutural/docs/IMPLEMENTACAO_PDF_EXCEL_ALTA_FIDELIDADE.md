# Implementação — Conversor PDF para Excel de Alta Fidelidade

> Repositório alvo: `jana16-c/Projetos`  
> Projeto existente: `conversor-pdf-excel-estrutural`  
> Objetivo: evoluir o conversor atual para reconstruir tabelas e páginas em Excel com fidelidade próxima a conversores comerciais, preservando o layout visual dos processadores existentes.

---

## 1. Decisão técnica

A solução deve ter **três motores intercambiáveis**, todos usando a mesma interface e o mesmo formato interno de dados:

1. **Motor estrutural atual**
   - Gratuito.
   - Executado no navegador.
   - Usa `pdf.js`, coordenadas dos textos e heurísticas.
   - Adequado para PDFs nativos e tabelas relativamente regulares.

2. **Motor de IA local**
   - Gratuito e executado localmente.
   - Backend principal em Node.js.
   - Worker de visão/OCR em Python.
   - Usa reconhecimento de layout e estrutura de tabelas.
   - Recomendação inicial: **Docling** ou **PaddleOCR PP-StructureV3**.
   - A IA identifica linhas, colunas, células mescladas, cabeçalhos e continuações.
   - O Excel continua sendo gerado deterministicamente pelo programa.

3. **Motor comercial de alta fidelidade**
   - Integração opcional com **Apryse Structured Output**.
   - Utilizado quando houver licença instalada.
   - Converte PDF diretamente para XLSX.
   - Deve ser isolado em um adaptador para que a aplicação funcione sem ele.

A interface existente deve permanecer visualmente compatível com os demais processadores do repositório.

---

## 2. Resposta objetiva sobre o uso de IA

### 2.1 A IA pode reconstruir a tabela?

Sim. Modelos de visão documental conseguem:

- localizar tabelas;
- detectar linhas e colunas;
- reconhecer células;
- identificar `rowspan` e `colspan`;
- diferenciar cabeçalhos e dados;
- recuperar tabelas sem bordas visíveis;
- tratar páginas escaneadas;
- reconhecer tabelas quebradas entre páginas;
- ajudar a corrigir associações erradas entre texto e célula.

### 2.2 A IA pode gerar um resultado idêntico ao iLovePDF?

Não há garantia de identidade absoluta.

Uma IA genérica analisando uma captura da página pode produzir uma tabela visualmente parecida, mas ainda pode:

- trocar números;
- omitir células vazias;
- deslocar texto para a coluna errada;
- interpretar incorretamente células mescladas;
- inventar conteúdo ausente;
- alterar datas, separadores decimais ou zeros à esquerda;
- produzir resultados diferentes em execuções diferentes.

Por isso, a IA **não deve ser a fonte primária dos valores quando o PDF possuir camada textual**.

### 2.3 Papel correto da IA

A IA deve responder principalmente:

- onde está a tabela;
- quantas linhas e colunas existem;
- quais células estão mescladas;
- qual texto pertence a qual célula;
- quais linhas são títulos, cabeçalhos, totais ou continuação;
- se uma tabela continua na página seguinte;
- qual é o nível de confiança da reconstrução.

A IA deve retornar um JSON validado. O XLSX deve ser construído por código determinístico usando `ExcelJS`.

---

## 3. Princípios obrigatórios

1. **Não alterar valores silenciosamente.**
2. **Nunca usar um modelo generativo para recalcular números.**
3. **Preservar o texto original sempre que houver camada textual.**
4. **Usar OCR apenas quando necessário.**
5. **Marcar células de baixa confiança para revisão.**
6. **Não enviar processos trabalhistas para serviços externos por padrão.**
7. **Apagar arquivos temporários após o processamento.**
8. **Manter o motor atual disponível como fallback.**
9. **Separar extração, reconstrução e exportação.**
10. **Toda saída deve ser reproduzível a partir do mesmo PDF e das mesmas configurações.**

---

## 4. Arquitetura proposta

```text
┌──────────────────────────────────────────────────────────────┐
│ Frontend existente — HTML/CSS/JavaScript                     │
│                                                              │
│ PDF + páginas + modo + configurações                         │
└──────────────────────────────┬───────────────────────────────┘
                               │
                               ▼
┌──────────────────────────────────────────────────────────────┐
│ Backend local Node.js                                        │
│                                                              │
│ - valida upload                                               │
│ - seleciona páginas                                           │
│ - cria e acompanha job                                        │
│ - escolhe o motor                                             │
│ - normaliza o resultado em TableIR                            │
│ - gera XLSX/XLSM                                              │
│ - remove temporários                                          │
└───────────────┬───────────────────────┬──────────────────────┘
                │                       │
                ▼                       ▼
┌──────────────────────────┐  ┌───────────────────────────────┐
│ Worker Python de IA      │  │ Apryse Adapter opcional       │
│                          │  │                               │
│ Docling/PaddleOCR        │  │ PDF → XLSX comercial          │
│ OCR + layout + tabelas   │  │                               │
└──────────────┬───────────┘  └───────────────────────────────┘
               │
               ▼
┌──────────────────────────────────────────────────────────────┐
│ TableIR — formato intermediário comum                        │
│                                                              │
│ páginas, tabelas, células, coordenadas, mesclagens, estilo,  │
│ origem do texto, confiança e avisos                          │
└──────────────────────────────┬───────────────────────────────┘
                               │
                               ▼
┌──────────────────────────────────────────────────────────────┐
│ Excel Renderer                                                │
│                                                              │
│ ExcelJS → XLSX                                                │
│ Template existente → XLSM                                    │
└──────────────────────────────────────────────────────────────┘
```

---

## 5. Estrutura de pastas

A evolução deve ocorrer dentro do projeto existente:

```text
conversor-pdf-excel-estrutural/
├── index.html
├── ABRIR_APP_WINDOWS.bat
├── README.md
│
├── frontend/
│   ├── assets/
│   │   ├── css/
│   │   └── js/
│   │       ├── api/
│   │       │   └── jobsApi.js
│   │       ├── ui/
│   │       └── state/
│   └── index.html
│
├── backend/
│   ├── package.json
│   ├── package-lock.json
│   ├── .env.example
│   └── src/
│       ├── server.js
│       ├── config.js
│       ├── routes/
│       │   ├── jobs.routes.js
│       │   └── health.routes.js
│       ├── controllers/
│       │   └── jobs.controller.js
│       ├── jobs/
│       │   ├── jobManager.js
│       │   ├── jobStore.js
│       │   └── jobCleanup.js
│       ├── pdf/
│       │   ├── inspectPdf.js
│       │   ├── selectPages.js
│       │   ├── renderPages.js
│       │   └── textLayerExtractor.js
│       ├── engines/
│       │   ├── engine.interface.js
│       │   ├── legacy.engine.js
│       │   ├── aiLocal.engine.js
│       │   └── apryse.engine.js
│       ├── table-ir/
│       │   ├── tableIr.schema.js
│       │   ├── normalizeTableIr.js
│       │   └── validateTableIr.js
│       ├── reconciliation/
│       │   ├── bindTextToCells.js
│       │   ├── mergeCrossPageTables.js
│       │   ├── inferStyles.js
│       │   └── confidence.js
│       ├── export/
│       │   ├── excelRenderer.js
│       │   ├── xlsmRenderer.js
│       │   └── workbookValidator.js
│       └── utils/
│
├── ai-worker/
│   ├── pyproject.toml
│   ├── requirements.lock
│   ├── app/
│   │   ├── main.py
│   │   ├── config.py
│   │   ├── schemas.py
│   │   ├── pipeline.py
│   │   ├── engines/
│   │   │   ├── docling_engine.py
│   │   │   └── paddle_engine.py
│   │   ├── preprocessing/
│   │   │   ├── deskew.py
│   │   │   ├── denoise.py
│   │   │   └── contrast.py
│   │   └── postprocessing/
│   │       ├── canonicalize.py
│   │       └── confidence.py
│   └── tests/
│
├── shared/
│   ├── schemas/
│   │   ├── job.schema.json
│   │   └── table-ir.schema.json
│   └── fixtures/
│
├── tests/
│   ├── unit/
│   ├── integration/
│   ├── regression/
│   └── fixtures/
│       ├── native/
│       ├── scanned/
│       ├── borderless/
│       ├── multipage/
│       └── expected/
│
├── temp/
│   └── .gitkeep
│
└── docs/
    ├── IMPLEMENTACAO_PDF_EXCEL_ALTA_FIDELIDADE.md
    └── TESTES_DE_FIDELIDADE.md
```

### Observação

Não é necessário mover todos os arquivos do frontend na primeira etapa. A migração pode ser progressiva. O objetivo inicial é colocar o backend e o worker ao lado da aplicação atual sem quebrar o funcionamento existente.

---

## 6. Formato intermediário: TableIR

Todos os motores devem produzir o mesmo formato interno.

### 6.1 Exemplo

```json
{
  "version": "1.0",
  "source": {
    "fileName": "processo.pdf",
    "pageCount": 180,
    "selectedPages": [61, 62, 63]
  },
  "engine": {
    "name": "ai-local",
    "provider": "docling",
    "version": "runtime",
    "deterministic": true
  },
  "pages": [
    {
      "pageNumber": 61,
      "width": 595.28,
      "height": 841.89,
      "rotation": 0,
      "textLayerDetected": true,
      "imagePath": "temp/job-id/page-0061.png"
    }
  ],
  "tables": [
    {
      "id": "table-0001",
      "sourcePages": [61, 62],
      "title": "Cálculo de horas extras",
      "bounds": {
        "pageNumber": 61,
        "x": 37.4,
        "y": 152.0,
        "width": 521.0,
        "height": 603.0
      },
      "rows": 12,
      "columns": 8,
      "headerRows": [0, 1],
      "cells": [
        {
          "id": "cell-0001",
          "row": 0,
          "column": 0,
          "rowSpan": 2,
          "columnSpan": 1,
          "text": "Período",
          "rawText": "Período",
          "value": "Período",
          "valueType": "text",
          "source": "pdf-text-layer",
          "confidence": 0.998,
          "bounds": {
            "pageNumber": 61,
            "x": 37.4,
            "y": 152.0,
            "width": 52.0,
            "height": 28.0
          },
          "style": {
            "bold": true,
            "fontSizePt": 7.5,
            "horizontalAlignment": "center",
            "verticalAlignment": "center",
            "fillArgb": "FFD9D9D9",
            "borderTop": true,
            "borderRight": true,
            "borderBottom": true,
            "borderLeft": true
          },
          "warnings": []
        }
      ],
      "confidence": {
        "structure": 0.97,
        "textBinding": 0.995,
        "style": 0.78,
        "overall": 0.94
      },
      "warnings": []
    }
  ],
  "warnings": []
}
```

### 6.2 Campos obrigatórios por célula

Cada célula deve armazenar:

- linha;
- coluna;
- quantidade de linhas mescladas;
- quantidade de colunas mescladas;
- texto original;
- valor normalizado;
- tipo do valor;
- origem do texto;
- coordenadas;
- confiança;
- estilo inferido;
- avisos.

### 6.3 Origem do conteúdo

O campo `source` deve aceitar:

```text
pdf-text-layer
ocr
ai-inferred-empty
user-edited
```

A IA não pode criar texto com origem genérica. Quando uma célula estiver visualmente vazia, deve ser registrada como vazia, com `source: "ai-inferred-empty"`.

---

## 7. Contrato dos motores

```javascript
/**
 * @typedef {Object} ExtractionContext
 * @property {string} jobId
 * @property {string} inputPdfPath
 * @property {number[]} selectedPages
 * @property {string} tempDir
 * @property {Object} options
 */

/**
 * @typedef {Object} ExtractionEngine
 * @property {string} name
 * @property {(context: ExtractionContext) => Promise<Object>} extract
 * @property {() => Promise<{ available: boolean, reason?: string }>} health
 */
```

Implementação mínima:

```javascript
export class ExtractionEngine {
  constructor(name) {
    this.name = name;
  }

  async health() {
    throw new Error('health() não implementado.');
  }

  async extract(_context) {
    throw new Error('extract() não implementado.');
  }
}
```

O backend não deve conhecer detalhes do Docling, PaddleOCR ou Apryse. Ele deve chamar apenas a interface do motor.

---

## 8. Seleção automática do motor

### 8.1 Modos visíveis ao usuário

```text
Automático
Alta fidelidade — Apryse
IA local
Estrutural atual
```

### 8.2 Estratégia automática

```javascript
async function chooseEngine(pdfInspection, availableEngines) {
  if (
    availableEngines.apryse &&
    pdfInspection.userRequestedHighestFidelity
  ) {
    return 'apryse';
  }

  if (
    pdfInspection.scannedPageRatio > 0.05 ||
    pdfInspection.complexLayoutScore >= 0.65 ||
    pdfInspection.legacyExtractionConfidence < 0.80
  ) {
    return 'ai-local';
  }

  return 'legacy';
}
```

### 8.3 Regras

- PDF nativo e simples: estrutural atual.
- PDF escaneado: IA local com OCR.
- Tabela sem bordas ou com mesclagens complexas: IA local.
- Usuário selecionou alta fidelidade e Apryse está disponível: Apryse.
- Apryse falhou: IA local.
- IA local falhou: estrutural atual com aviso.

---

## 9. Pipeline completo

### Etapa 1 — Recebimento

1. validar extensão e assinatura `%PDF`;
2. rejeitar arquivo vazio;
3. limitar tamanho configurável;
4. gerar `jobId`;
5. criar diretório isolado;
6. salvar arquivo como `input.pdf`;
7. normalizar a seleção de páginas.

### Etapa 2 — Inspeção

Extrair:

- número de páginas;
- dimensões;
- rotação;
- presença de camada textual;
- quantidade de textos por página;
- proporção de imagens;
- quantidade aproximada de linhas vetoriais;
- páginas possivelmente escaneadas;
- páginas com tabelas potenciais.

### Etapa 3 — Recorte de páginas

Criar um PDF temporário apenas com as páginas selecionadas. Isso reduz:

- tempo;
- memória;
- custo de conversão;
- exposição desnecessária de páginas que não serão processadas.

A referência original da página deve ser preservada no TableIR.

### Etapa 4 — Extração textual

Para PDFs nativos:

- usar `pdf.js` ou biblioteca equivalente no backend;
- obter cada item de texto;
- armazenar:
  - texto;
  - transformação;
  - `x`;
  - `y`;
  - largura;
  - altura;
  - nome da fonte;
  - direção;
  - página original.

Os números extraídos dessa camada são considerados a fonte preferencial.

### Etapa 5 — Renderização

Renderizar cada página selecionada em PNG:

- 200 DPI para processamento comum;
- 300 DPI para tabelas pequenas ou OCR;
- manter a transformação entre coordenadas da imagem e do PDF;
- não aplicar compressão destrutiva.

### Etapa 6 — Reconhecimento de layout

O worker deve detectar:

- tabela;
- título;
- cabeçalho;
- rodapé;
- texto comum;
- imagem;
- linhas e divisores;
- blocos repetidos.

### Etapa 7 — Reconhecimento da estrutura

Para cada tabela:

- detectar linhas;
- detectar colunas;
- detectar células;
- detectar células mescladas;
- inferir ordem lógica;
- identificar cabeçalhos;
- identificar linhas de total;
- criar uma grade canônica.

### Etapa 8 — OCR seletivo

Executar OCR somente quando:

- a página não possuir camada textual;
- o texto original estiver ausente na região;
- houver divergência entre estrutura visual e texto extraído;
- o usuário solicitar OCR forçado.

### Etapa 9 — Fusão entre geometria, OCR e texto nativo

Ordem de preferência:

```text
texto nativo do PDF
→ OCR de alta confiança
→ célula vazia inferida
→ revisão manual
```

A IA define os limites das células. O código associa o texto nativo às células por interseção geométrica.

### Etapa 10 — Continuação entre páginas

Juntar tabelas quando:

- a assinatura do cabeçalho for compatível;
- o número e a posição relativa das colunas forem compatíveis;
- a página anterior terminar dentro de uma tabela;
- a próxima página começar com cabeçalho repetido ou linha de continuação;
- a confiança conjunta superar o limite configurado.

Registrar sempre os pontos de quebra entre páginas.

### Etapa 11 — Inferência de estilo

Inferir, quando possível:

- largura proporcional de colunas;
- altura de linhas;
- alinhamento;
- negrito;
- tamanho aproximado da fonte;
- preenchimento;
- bordas;
- células mescladas;
- quebra de linha;
- formato numérico;
- formato de data.

Não é necessário reproduzir cada detalhe gráfico para considerar uma tabela correta. O conteúdo e a estrutura têm prioridade sobre o estilo.

### Etapa 12 — Validação

Antes de gerar o Excel:

- validar o JSON contra o schema;
- garantir que não existam células sobrepostas inválidas;
- garantir que todas as células estejam dentro da grade;
- garantir que `rowSpan` e `columnSpan` sejam válidos;
- comparar a quantidade de textos do PDF com a quantidade associada às células;
- listar textos não associados;
- listar células de baixa confiança;
- conferir duplicação de cabeçalhos;
- conferir números com caracteres suspeitos.

### Etapa 13 — Geração do XLSX

O `ExcelRenderer` deve:

1. criar uma aba por tabela ou uma aba por página, conforme configuração;
2. escrever valores;
3. aplicar mesclagens;
4. aplicar estilos;
5. definir largura das colunas;
6. definir altura das linhas;
7. congelar cabeçalhos quando apropriado;
8. adicionar comentários às células de baixa confiança;
9. criar uma aba opcional `_DIAGNOSTICO`;
10. salvar o arquivo.

---

## 10. Integração com IA local

## 10.1 Recomendação inicial

Começar com **Docling**, pois ele oferece:

- entendimento de layout;
- estrutura de tabelas;
- execução local;
- representação estruturada;
- licença permissiva;
- menor esforço para construir um protótipo.

Usar **PaddleOCR PP-StructureV3** como segunda opção quando for necessário:

- maior controle sobre OCR;
- pré-processamento;
- modelos específicos de estrutura;
- treinamento ou ajuste fino;
- operação com páginas escaneadas problemáticas.

O Microsoft Table Transformer pode ser usado como componente especializado, mas sua integração exige mais pós-processamento.

## 10.2 Por que usar Python

O frontend e o backend principal permanecem em JavaScript. O worker usa Python porque os principais modelos de visão documental e OCR possuem ecossistema mais maduro nessa linguagem.

A aplicação continua sendo um projeto JavaScript do ponto de vista de interface, controle, API, jobs e exportação.

## 10.3 Comunicação Node → Python

O worker deve executar como serviço local:

```text
http://127.0.0.1:8790
```

Endpoints:

```text
GET  /health
POST /v1/extract
POST /v1/extract-page
```

### Requisição

```json
{
  "jobId": "01J...",
  "pdfPath": "C:/.../temp/01J/input-selected.pdf",
  "pageMap": {
    "1": 61,
    "2": 62
  },
  "options": {
    "engine": "docling",
    "ocr": "auto",
    "language": "pt",
    "detectTables": true,
    "detectStyles": true
  }
}
```

### Resposta

```json
{
  "success": true,
  "tableIrPath": "C:/.../temp/01J/table-ir.json",
  "warnings": [],
  "metrics": {
    "pagesProcessed": 2,
    "tablesDetected": 3,
    "durationMs": 8421
  }
}
```

Não retornar imagens ou arquivos grandes em Base64.

---

## 11. Worker Python: esqueleto

```python
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field
from pathlib import Path

app = FastAPI(title="PDF Table AI Worker")


class ExtractOptions(BaseModel):
    engine: str = "docling"
    ocr: str = "auto"
    language: str = "pt"
    detectTables: bool = True
    detectStyles: bool = True


class ExtractRequest(BaseModel):
    jobId: str = Field(min_length=1)
    pdfPath: str
    pageMap: dict[str, int]
    options: ExtractOptions


@app.get("/health")
def health():
    return {"ok": True}


@app.post("/v1/extract")
def extract(request: ExtractRequest):
    pdf_path = Path(request.pdfPath).resolve()

    if not pdf_path.exists():
        raise HTTPException(status_code=404, detail="PDF não encontrado.")

    # 1. Executar engine selecionado.
    # 2. Converter resultado para TableIR.
    # 3. Validar TableIR.
    # 4. Salvar no diretório do job.
    # 5. Retornar apenas caminho e métricas.

    return {
        "success": True,
        "tableIrPath": str(pdf_path.parent / "table-ir.json"),
        "warnings": [],
        "metrics": {}
    }
```

---

## 12. Reconciliação de texto sem alucinação

A regra principal é:

> O modelo reconhece a geometria. O programa decide o texto da célula.

### 12.1 Associação geométrica

Para cada item textual:

1. calcular o centro da caixa;
2. localizar a célula que contém o centro;
3. se houver empate, usar maior área de interseção;
4. ordenar itens da célula por linha e posição horizontal;
5. preservar quebras de linha relevantes;
6. manter o texto bruto no diagnóstico.

### 12.2 OCR

O OCR deve retornar:

```json
{
  "text": "1.234,56",
  "confidence": 0.97,
  "bounds": {
    "x": 101,
    "y": 244,
    "width": 63,
    "height": 14
  }
}
```

### 12.3 Uso opcional de modelo multimodal generativo

Um modelo multimodal pode ser usado apenas para resolver ambiguidades estruturais, por exemplo:

```json
{
  "task": "classify_table_structure",
  "allowedActions": [
    "confirm_cell_merge",
    "classify_header_row",
    "classify_total_row",
    "confirm_cross_page_continuation"
  ],
  "forbiddenActions": [
    "invent_text",
    "change_numeric_value",
    "calculate_missing_value"
  ]
}
```

A saída deve respeitar um schema fechado. Respostas em texto livre não devem ser aceitas pelo pipeline.

---

## 13. Geração determinística do Excel

Exemplo simplificado:

```javascript
import ExcelJS from 'exceljs';

export async function renderWorkbook(tableIr) {
  const workbook = new ExcelJS.Workbook();

  for (const [index, table] of tableIr.tables.entries()) {
    const worksheet = workbook.addWorksheet(
      sanitizeSheetName(table.title || `Tabela ${index + 1}`)
    );

    for (const cellInfo of table.cells) {
      const row = cellInfo.row + 1;
      const column = cellInfo.column + 1;
      const cell = worksheet.getCell(row, column);

      cell.value = toExcelValue(cellInfo);
      applyCellStyle(cell, cellInfo.style);

      if (cellInfo.confidence < 0.85) {
        cell.note = `Revisar. Confiança: ${cellInfo.confidence}`;
      }

      if (cellInfo.rowSpan > 1 || cellInfo.columnSpan > 1) {
        worksheet.mergeCells(
          row,
          column,
          row + cellInfo.rowSpan - 1,
          column + cellInfo.columnSpan - 1
        );
      }
    }

    applyColumnWidths(worksheet, table);
    applyRowHeights(worksheet, table);
  }

  return workbook.xlsx.writeBuffer();
}
```

### 13.1 Conversão de valores

Não transformar automaticamente um texto em número quando houver risco de perda:

- CPF;
- matrícula;
- CNPJ;
- número de processo;
- códigos com zero à esquerda;
- competências;
- identificadores;
- valores com formatação ambígua.

Datas e números só devem ser tipados quando a classificação for segura.

---

## 14. Integração com Apryse

## 14.1 Requisitos

- licença válida;
- Server/Desktop SDK;
- módulo opcional Structured Output;
- arquivos do módulo em diretório local;
- execução em Windows, Linux ou macOS;
- adaptador isolado.

## 14.2 Regra de implementação

A API exata pode mudar entre versões do binding Node.js. O Codex deve:

1. instalar o pacote oficial compatível;
2. consultar os exemplos incluídos na versão instalada;
3. verificar a disponibilidade do Structured Output;
4. usar as opções de páginas quando suportadas;
5. não espalhar chamadas Apryse pelo projeto;
6. manter toda a integração em `apryse.engine.js`.

## 14.3 Interface do adaptador

```javascript
export class ApryseEngine extends ExtractionEngine {
  constructor(config) {
    super('apryse');
    this.config = config;
  }

  async health() {
    // Validar:
    // - módulo instalado;
    // - licença configurada;
    // - runtime carregável.
    return { available: false, reason: 'Ainda não configurado.' };
  }

  async extract(context) {
    // 1. Converter o PDF selecionado diretamente para XLSX.
    // 2. Salvar em context.tempDir.
    // 3. Retornar um resultado do tipo direct-xlsx.
    // 4. Não converter o XLSX novamente com ExcelJS,
    //    pois isso pode reduzir a fidelidade.
    throw new Error('Apryse não configurado.');
  }
}
```

### 14.4 Resultado direto

O contrato do job deve aceitar:

```json
{
  "resultType": "direct-xlsx",
  "outputPath": "temp/job-id/result.xlsx",
  "engine": "apryse"
}
```

Quando o resultado for `direct-xlsx`, o backend apenas valida e entrega o arquivo.

---

## 15. API do backend Node.js

## 15.1 Criar job

```text
POST /api/jobs
Content-Type: multipart/form-data
```

Campos:

```text
pdf                 arquivo obrigatório
pages               "61-66, 70"
engine              auto | legacy | ai-local | apryse
output              xlsx | xlsm
sheetMode           table | page | continuous
ocr                  auto | always | never
includeDiagnostics  true | false
template             arquivo XLSM opcional
```

Resposta:

```json
{
  "jobId": "01J...",
  "status": "queued",
  "statusUrl": "/api/jobs/01J..."
}
```

## 15.2 Consultar job

```text
GET /api/jobs/:jobId
```

Resposta:

```json
{
  "jobId": "01J...",
  "status": "processing",
  "stage": "recognizing-table-structure",
  "progress": 57,
  "message": "Reconstruindo tabela da página 62.",
  "warnings": []
}
```

## 15.3 Baixar resultado

```text
GET /api/jobs/:jobId/result
```

## 15.4 Cancelar e apagar

```text
DELETE /api/jobs/:jobId
```

---

## 16. Estados do job

```text
queued
validating
inspecting
selecting-pages
rendering
extracting-text
detecting-layout
recognizing-table-structure
running-ocr
reconciling
validating-result
generating-excel
completed
failed
cancelled
```

O frontend deve exibir mensagens amigáveis e não apenas percentuais.

---

## 17. Segurança e privacidade

Processos trabalhistas podem conter dados pessoais e documentos sensíveis. Portanto:

- executar localmente por padrão;
- escutar apenas em `127.0.0.1`;
- não publicar o worker na rede;
- não registrar o conteúdo das células em logs normais;
- não enviar PDFs para APIs externas sem ação explícita;
- manter `temp/` fora do Git;
- usar nomes aleatórios para arquivos temporários;
- apagar temporários em sucesso, erro e cancelamento;
- implementar limpeza ao iniciar a aplicação;
- configurar TTL máximo;
- não incluir PDFs reais no repositório;
- usar amostras anonimizadas nos testes.

---

## 18. Sistema de confiança e revisão

### 18.1 Limites iniciais

```text
>= 0,95  aprovado automaticamente
0,85–0,949  aprovado com aviso
0,70–0,849  revisão recomendada
< 0,70  revisão obrigatória
```

### 18.2 Confiança geral

```javascript
overall =
  structureConfidence * 0.40 +
  textBindingConfidence * 0.35 +
  ocrConfidence * 0.15 +
  styleConfidence * 0.10;
```

Quando não houver OCR, redistribuir o peso.

### 18.3 Interface de revisão

Adicionar uma tela com:

- imagem da página;
- sobreposição das células detectadas;
- tabela reconstruída;
- destaque em amarelo para baixa confiança;
- seleção da célula na imagem ao clicar no Excel virtual;
- edição de texto;
- unir e separar células;
- adicionar/remover linha;
- adicionar/remover coluna;
- desfazer;
- reprocessar apenas a página;
- exportar após validação.

O editor existente deve ser aproveitado.

---

## 19. Testes de fidelidade

## 19.1 Conjunto inicial

Criar pelo menos 20 amostras anonimizadas:

- 4 PDFs nativos com bordas;
- 4 PDFs nativos sem bordas;
- 4 PDFs escaneados;
- 4 tabelas quebradas entre páginas;
- 2 tabelas com muitas células mescladas;
- 2 páginas com várias tabelas.

Para cada amostra, manter um XLSX esperado revisado manualmente.

## 19.2 Métricas obrigatórias

### Conteúdo

```text
cell_exact_match
numeric_exact_match
unassigned_text_count
duplicated_text_count
missing_text_count
```

### Estrutura

```text
row_count_match
column_count_match
merge_match
header_match
cell_topology_score
```

### Geometria

```text
column_width_error
row_height_error
table_bounds_error
```

### Operação

```text
processing_time
peak_memory
failure_rate
manual_corrections
```

## 19.3 Critérios mínimos do MVP

- 100% de preservação dos valores numéricos em PDFs nativos de teste;
- nenhuma célula inventada;
- pelo menos 95% de associação correta de texto;
- pelo menos 90% de mesclagens corretas;
- todas as divergências de baixa confiança visíveis ao usuário;
- nenhuma alteração no PDF original;
- arquivos temporários apagados.

---

## 20. Estratégia de avaliação contra o iLovePDF

Para cada PDF de teste:

1. converter no projeto;
2. converter no iLovePDF;
3. abrir os dois XLSX;
4. normalizar propriedades não essenciais;
5. comparar:
   - valores;
   - posição das células;
   - mesclagens;
   - dimensões;
   - estilos;
6. gerar relatório de diferenças;
7. classificar cada diferença como:
   - conteúdo;
   - estrutura;
   - estilo;
   - paginação;
   - limitação aceitável.

Não usar o arquivo do iLovePDF como verdade absoluta para números. O PDF original continua sendo a fonte de verdade.

---

## 21. Dependências sugeridas

## 21.1 Backend Node.js

- servidor: `fastify` ou `express`;
- multipart: plugin oficial do framework escolhido;
- validação: `zod`;
- PDF: `pdf-lib` para seleção de páginas;
- Excel: `exceljs`;
- processos: `execa`;
- logs: `pino`;
- IDs: `ulid` ou `uuid`;
- arquivos: APIs nativas de `fs/promises`;
- testes: `vitest`;
- requisições ao worker: `undici`.

Escolher somente uma biblioteca por responsabilidade.

## 21.2 Worker Python

Opção A:

- `docling`;
- `fastapi`;
- `uvicorn`;
- `pydantic`;
- `pillow`;
- `opencv-python-headless`.

Opção B:

- `paddleocr`;
- `paddlepaddle`;
- `fastapi`;
- `uvicorn`;
- `pydantic`;
- `opencv-python-headless`;
- `numpy`;
- `pillow`.

Não instalar Docling e PaddleOCR juntos no primeiro MVP. Implementar um motor por vez.

---

## 22. Fases de implementação

## Fase 0 — Baseline

Entregas:

- congelar uma versão funcional do conversor atual;
- criar fixtures;
- criar XLSX esperados;
- registrar limitações atuais;
- criar métricas;
- garantir testes do seletor de páginas.

Não iniciar IA sem baseline.

## Fase 1 — Backend local

Entregas:

- servidor Node.js;
- upload;
- jobs;
- seleção de páginas;
- diretórios temporários;
- limpeza;
- API de status;
- download;
- frontend consumindo a API.

O motor inicial continua sendo o atual.

## Fase 2 — TableIR

Entregas:

- schema;
- conversor do resultado atual para TableIR;
- validador;
- renderer Excel baseado em TableIR;
- testes de regressão.

Essa fase desacopla a extração da exportação.

## Fase 3 — IA local

Entregas:

- worker Python;
- endpoint `/health`;
- endpoint `/v1/extract`;
- Docling ou PaddleOCR;
- estrutura de tabela;
- OCR seletivo;
- associação de texto;
- confiança;
- diagnóstico.

## Fase 4 — Reconciliação avançada

Entregas:

- continuação entre páginas;
- cabeçalhos repetidos;
- células mescladas;
- títulos;
- totais;
- estilos;
- comparação visual;
- revisão manual.

## Fase 5 — Apryse opcional

Entregas:

- adaptador;
- detecção de licença;
- seleção de páginas;
- resultado direto XLSX;
- fallback automático;
- documentação de instalação.

## Fase 6 — Empacotamento

Entregas:

- inicializador único para Windows;
- instalação automatizada;
- verificação de Node/Python/modelos;
- Electron opcional;
- build versionado;
- diagnóstico de ambiente.

---

## 23. Ordem recomendada para o Codex

O Codex não deve implementar tudo em uma única execução.

### Lote 1

```text
Leia apenas o README, a pasta conversor-pdf-excel-estrutural e este documento.
Não altere o comportamento existente.
Implemente o backend Node local com health check, jobs em memória,
upload seguro, seleção de páginas, status, download e limpeza de temporários.
Adicione testes. Pare após os testes passarem.
```

### Lote 2

```text
Implemente o schema TableIR e um adaptador que converta o resultado
do motor estrutural atual para TableIR. Migre a geração XLSX para consumir
TableIR, sem alterar visualmente os arquivos existentes. Adicione testes
de regressão e pare após os testes passarem.
```

### Lote 3

```text
Crie o worker Python FastAPI com /health e /v1/extract.
Integre somente Docling nesta etapa. Gere TableIR validado.
Não implemente PaddleOCR nem Apryse. Use fixtures anonimizadas.
Adicione testes e documentação de instalação.
```

### Lote 4

```text
Implemente a reconciliação entre caixas de células detectadas pelo modelo
e os itens da camada textual do PDF. O texto nativo deve ter prioridade.
Não permita que a IA altere valores. Gere avisos para texto não associado,
duplicado ou de baixa confiança. Adicione testes com valores numéricos.
```

### Lote 5

```text
Implemente continuação de tabelas entre páginas, cabeçalhos repetidos,
mesclagens e interface de revisão. Reaproveite o editor atual.
Não altere a paleta visual do projeto.
```

### Lote 6

```text
Implemente o adaptador opcional Apryse. A aplicação deve iniciar e funcionar
sem licença. Detecte disponibilidade em runtime, mantenha toda a integração
em um único módulo e use fallback para ai-local.
```

---

## 24. Regras para economizar tokens no Codex

Inserir estas instruções em cada tarefa:

```text
- Não reescreva arquivos que não precisam ser alterados.
- Não faça refatorações estéticas fora do escopo.
- Antes de editar, localize as funções já existentes que devem ser reaproveitadas.
- Mostre um plano curto e depois execute.
- Rode apenas os testes relacionados ao lote atual antes da suíte completa.
- Não cole arquivos inteiros na resposta; informe caminhos e resumo das mudanças.
- Não crie dependências duplicadas.
- Não altere a interface pública sem necessidade.
- Não implemente fases futuras.
- Ao encontrar ambiguidade, escolha a opção compatível com a arquitetura deste documento.
```

---

## 25. Definição de pronto

O projeto estará pronto para uso real quando:

- o modo estrutural atual continuar funcionando;
- o modo IA local processar PDFs nativos e escaneados;
- os valores do PDF nativo forem preservados;
- células de baixa confiança forem indicadas;
- o usuário puder corrigir a tabela;
- o Excel mantiver linhas, colunas e mesclagens;
- páginas específicas forem processadas;
- a aplicação não depender de internet;
- temporários forem apagados;
- houver testes com amostras anonimizadas;
- Apryse puder ser ativado sem alterar os demais motores;
- erros de um motor acionarem fallback controlado.

---

## 26. Recomendação final

A melhor primeira versão não é tentar criar uma IA própria do zero.

Implementar nesta ordem:

```text
TableIR
→ backend Node.js
→ Docling local
→ fusão com texto nativo
→ ExcelJS determinístico
→ revisão manual
→ Apryse opcional
→ ajuste fino somente se os testes demonstrarem necessidade
```

Treinar um modelo próprio só deve ser considerado depois de reunir um conjunto anonimizado e revisado de tabelas reais. Na maioria dos casos, o maior ganho virá da reconciliação correta entre:

- geometria do PDF;
- estrutura detectada pela IA;
- texto nativo;
- OCR;
- regras determinísticas;
- revisão do usuário.

Essa combinação é mais segura e mais próxima de um conversor comercial do que pedir a uma IA generativa para recriar livremente a planilha.

---

## 27. Referências técnicas

- Apryse — Convert PDF to MS Office / Structured Output:  
  https://docs.apryse.com/core/guides/features/office/convert-to-office/

- PaddleOCR — PP-StructureV3:  
  https://www.paddleocr.ai/latest/en/version3.x/pipeline_usage/PP-StructureV3.html

- Docling:  
  https://github.com/docling-project/docling

- Microsoft Table Transformer:  
  https://github.com/microsoft/table-transformer

- PubTables-1M:  
  https://arxiv.org/abs/2110.00061

- TableFormer:  
  https://arxiv.org/abs/2203.01017
