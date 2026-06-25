# Implementação — Conversor PDF para Excel de Alta Fidelidade

> Repositório: `jana16-c/Projetos`  
> Projeto: `conversor-pdf-excel-estrutural`

## 1. Objetivo e escopo

Evoluir o conversor atual para reconstruir tabelas de páginas específicas de PDFs em XLSX/XLSM, mantendo o padrão visual dos processadores existentes.

A solução terá somente dois modos:

1. **Estrutural local — gratuito**: `pdf.js`, coordenadas, linhas vetoriais e regras determinísticas.
2. **Apryse — opcional e pago**: conversão direta por Structured Output quando houver licença.

Não implementar motor de IA local, worker Python, Docling, PaddleOCR, Table Transformer ou modelo generativo.

## 2. Apryse: licença e custo

O Apryse é comercial. A conversão PDF → Excel exige o SDK Server/Desktop e o **Structured Output**, descrito como módulo adicional.

- Há avaliação gratuita para testes.
- Uso em produção exige licença paga.
- A página de preços anuncia pacotes iniciais a partir de **US$ 1.500**.
- O preço final depende de recursos, volume e implantação.
- O valor inicial não garante a inclusão do Structured Output; é necessário orçamento.

Referências oficiais:

- https://docs.apryse.com/core/guides/features/office/convert-to-office/
- https://apryse.com/pricing

O projeto deve funcionar integralmente sem Apryse.

## 3. Arquitetura

```text
Frontend HTML/CSS/JS
        │
        ▼
Backend local Node.js
        │
        ├── Motor estrutural local
        │       └── TableIR ──► ExcelJS ──► XLSX/XLSM
        │
        └── Apryse opcional
                └── Structured Output ──► XLSX direto
```

Regras:

- o modo estrutural é o padrão;
- o Apryse só fica habilitado quando licença e módulo forem detectados;
- não executar fallback silencioso;
- não enviar processos para serviços externos;
- apagar temporários após sucesso, erro ou cancelamento.

## 4. Estrutura de pastas

```text
conversor-pdf-excel-estrutural/
├── index.html
├── ABRIR_APP_WINDOWS.bat
├── README.md
├── assets/
│   ├── css/
│   └── js/
│       ├── extraction/
│       ├── export/
│       ├── model/
│       ├── pdf/
│       ├── ui/
│       └── utils/
├── backend/
│   ├── package.json
│   ├── .env.example
│   └── src/
│       ├── server.js
│       ├── config.js
│       ├── routes/
│       ├── jobs/
│       ├── pdf/
│       │   ├── inspectPdf.js
│       │   └── selectPages.js
│       ├── engines/
│       │   ├── engine.interface.js
│       │   ├── structural.engine.js
│       │   └── apryse.engine.js
│       ├── table-ir/
│       │   ├── tableIr.schema.js
│       │   ├── validateTableIr.js
│       │   └── normalizeTableIr.js
│       └── export/
│           ├── excelRenderer.js
│           ├── xlsmRenderer.js
│           └── workbookValidator.js
├── tests/
│   ├── unit/
│   ├── integration/
│   ├── regression/
│   └── fixtures/
├── temp/
│   └── .gitkeep
└── docs/
    └── IMPLEMENTACAO_PDF_EXCEL_ALTA_FIDELIDADE.md
```

Não criar pasta de IA ou worker Python.

## 5. TableIR

O motor estrutural deve produzir um modelo intermediário validável antes de gerar o Excel.

```json
{
  "version": "1.0",
  "source": {
    "fileName": "processo.pdf",
    "pageCount": 180,
    "selectedPages": [61, 62]
  },
  "engine": {
    "name": "structural",
    "deterministic": true
  },
  "tables": [
    {
      "id": "table-0001",
      "sourcePages": [61, 62],
      "title": "Cálculo",
      "rows": 12,
      "columns": 8,
      "headerRows": [0],
      "cells": [
        {
          "row": 0,
          "column": 0,
          "rowSpan": 1,
          "columnSpan": 2,
          "rawText": "Período",
          "value": "Período",
          "valueType": "text",
          "source": "pdf-text-layer",
          "confidence": 0.98,
          "bounds": {
            "pageNumber": 61,
            "x": 37.4,
            "y": 152,
            "width": 80,
            "height": 20
          },
          "style": {
            "bold": true,
            "horizontalAlignment": "center"
          },
          "warnings": []
        }
      ],
      "warnings": []
    }
  ],
  "warnings": []
}
```

Origens permitidas:

```text
pdf-text-layer
structural-empty
user-edited
```

## 6. Pipeline estrutural

1. Validar extensão, assinatura `%PDF`, tamanho e páginas.
2. Criar `jobId` e pasta temporária.
3. Ler com `pdf.js`: texto, `x/y`, largura, altura, transformação, fonte, dimensões e rotação.
4. Agrupar textos em linhas por tolerância vertical.
5. Detectar blocos tabulares por alinhamento, densidade, linhas vetoriais e repetição de colunas.
6. Calcular âncoras de colunas usando início, fim e centro dos textos.
7. Associar cada item textual a uma célula por interseção geométrica.
8. Inferir títulos, cabeçalhos, totais e células mescladas.
9. Classificar valores sem perder o texto original.
10. Calcular confiança e gerar TableIR.
11. Validar sobreposição, duplicação, textos não associados e mesclagens.
12. Gerar XLSX/XLSM.

### Continuação entre páginas

Juntar tabelas apenas quando:

- cabeçalhos forem compatíveis;
- quantidade e posição de colunas forem equivalentes;
- a primeira tabela terminar perto do rodapé;
- a seguinte começar perto do topo;
- não houver novo título independente.

Ao juntar, remover cabeçalho repetido, guardar a página de origem e permitir desfazer no editor.

### Preservação de valores

Manter como texto:

- CPF e CNPJ;
- matrícula;
- número de processo;
- competência `MM/AAAA`;
- códigos com zero à esquerda;
- datas e números ambíguos.

Nunca recalcular valores durante a conversão.

## 7. Exportação com ExcelJS

O renderer deve:

- criar aba por tabela, página ou modo contínuo;
- escrever valores seguros;
- aplicar mesclagens, larguras, alturas, alinhamentos, bordas, preenchimentos e fontes;
- adicionar comentário em célula de baixa confiança;
- criar aba `_DIAGNOSTICO` opcional;
- preservar o fluxo existente para modelos XLSM.

```javascript
export async function renderWorkbook(tableIr) {
  const workbook = new ExcelJS.Workbook();

  for (const [index, table] of tableIr.tables.entries()) {
    const worksheet = workbook.addWorksheet(
      sanitizeSheetName(table.title || `Tabela ${index + 1}`)
    );

    for (const info of table.cells) {
      const row = info.row + 1;
      const column = info.column + 1;
      const cell = worksheet.getCell(row, column);

      cell.value = toSafeExcelValue(info);
      applyCellStyle(cell, info.style);

      if (info.confidence < 0.85) {
        cell.note = `Revisar. Confiança: ${info.confidence}`;
      }

      if (info.rowSpan > 1 || info.columnSpan > 1) {
        worksheet.mergeCells(
          row,
          column,
          row + info.rowSpan - 1,
          column + info.columnSpan - 1
        );
      }
    }
  }

  return workbook.xlsx.writeBuffer();
}
```

## 8. Integração Apryse

### Configuração

```dotenv
APRYSE_ENABLED=false
APRYSE_LICENSE_KEY=
APRYSE_LIB_PATH=./vendor/apryse/lib
```

`.gitignore`:

```gitignore
.env
vendor/apryse/
temp/*
!temp/.gitkeep
```

Toda a integração deve ficar em:

```text
backend/src/engines/apryse.engine.js
```

O health check deve validar integração habilitada, chave, runtime e Structured Output. Quando indisponível, retornar o motivo sem afetar o modo estrutural.

Fluxo:

1. criar PDF temporário somente com as páginas selecionadas;
2. converter para XLSX;
3. validar o arquivo gerado;
4. entregar o XLSX diretamente;
5. não reconstruir o arquivo do Apryse com ExcelJS;
6. apagar temporários.

Em caso de falha, perguntar se o usuário deseja tentar o modo estrutural. Não trocar silenciosamente.

## 9. API local

```text
POST   /api/jobs
GET    /api/jobs/:jobId
GET    /api/jobs/:jobId/result
DELETE /api/jobs/:jobId
GET    /api/engines
```

Criação de job:

```text
pdf
pages
engine=structural|apryse
output=xlsx|xlsm
sheetMode=table|page|continuous
includeDiagnostics=true|false
template=arquivo.xlsm opcional
```

Resposta de motores:

```json
{
  "engines": [
    { "id": "structural", "available": true, "paid": false },
    {
      "id": "apryse",
      "available": false,
      "paid": true,
      "reason": "Licença não configurada."
    }
  ]
}
```

## 10. Interface e revisão

Exibir somente:

```text
Estrutural local — gratuito
Apryse — requer licença
```

O estrutural será o padrão. O Apryse ficará oculto ou desativado quando indisponível.

A revisão deve permitir editar célula, unir/separar células, adicionar/remover linha ou coluna, marcar cabeçalho, desfazer união entre páginas, restaurar resultado e exportar.

## 11. Segurança

- processar em `127.0.0.1`;
- não expor o backend na rede;
- não registrar conteúdo integral em logs comuns;
- não incluir processos reais no Git;
- usar fixtures anonimizadas;
- apagar temporários em `finally`;
- limpar jobs antigos ao iniciar;
- não enviar arquivos a APIs externas;
- usar Apryse apenas como SDK instalado localmente.

## 12. Testes e critérios

Fixtures:

- PDFs nativos com e sem bordas;
- tabelas divididas entre páginas;
- células mescladas;
- várias tabelas na mesma página.

Métricas:

```text
cell_exact_match
numeric_exact_match
row_count_match
column_count_match
merge_match
header_match
unassigned_text_count
duplicated_text_count
processing_time
manual_corrections
```

Critérios mínimos:

- 100% dos valores numéricos preservados nas amostras nativas;
- nenhuma célula inventada;
- ao menos 95% dos textos associados corretamente;
- ao menos 90% das mesclagens esperadas;
- divergências de baixa confiança visíveis;
- temporários apagados.

PDFs escaneados sem camada textual ficam fora do escopo desta versão.

## 13. Fases

1. **Baseline**: congelar versão atual, fixtures e resultados esperados.
2. **TableIR**: schema, validação e adaptação do resultado atual.
3. **Motor estrutural**: melhorar linhas, colunas, associação, mesclagens e confiança.
4. **Continuação**: cabeçalhos repetidos e página de origem.
5. **Backend Node.js**: jobs, upload, status, download, cancelamento e limpeza.
6. **Revisão**: baixa confiança, edição e diagnóstico.
7. **Apryse opcional**: somente com licença ou avaliação.

## 14. Prompts para o Codex

### Lote 1

```text
Crie o schema TableIR e um adaptador do resultado atual. Não altere o
comportamento existente. Adicione validação e testes.
```

### Lote 2

```text
Migre a geração XLSX/XLSM para consumir TableIR. Preserve valores, layout,
interface e modelos XLSM. Adicione testes de regressão.
```

### Lote 3

```text
Melhore o motor estrutural sem IA e sem OCR: linhas, âncoras de colunas,
associação geométrica, valores e mesclagens. Preserve rawText e zeros à esquerda.
```

### Lote 4

```text
Implemente continuação de tabelas entre páginas, cabeçalhos repetidos,
página de origem e opção de desfazer no editor.
```

### Lote 5

```text
Implemente o backend Node.js com jobs, upload, seleção de páginas, status,
download, cancelamento e limpeza. Mantenha o estrutural como padrão.
```

### Lote 6 — somente com licença

```text
Implemente o adaptador Apryse opcional em um único módulo. A aplicação deve
funcionar sem o SDK. Detecte licença e Structured Output, entregue XLSX direto
e não execute fallback silencioso.
```

Regras:

```text
- Não implemente IA, OCR ou worker Python.
- Não reescreva arquivos sem necessidade.
- Não faça refatorações fora do escopo.
- Não remova XLSM.
- Não instale Apryse sem licença e arquivos oficiais.
- Execute um lote por vez.
```

## 15. Definição de pronto

O modo gratuito estará pronto quando processar páginas específicas, preservar textos e números, reconstruir linhas/colunas/mesclagens comuns, juntar tabelas compatíveis, indicar baixa confiança, permitir correção, exportar XLSX/XLSM, funcionar sem internet e possuir testes.

O Apryse estará pronto quando houver licença, Structured Output instalado, health check positivo, conversão das páginas selecionadas e download do XLSX direto sem afetar o modo gratuito.

## 16. Recomendação final

Modo principal gratuito:

```text
pdf.js → coordenadas → linhas → colunas → células → TableIR → revisão → ExcelJS
```

Modo opcional pago:

```text
licença Apryse → páginas selecionadas → Structured Output → XLSX direto
```

Sem Apryse, o projeto continua funcional e gratuito, mas não pode prometer a mesma fidelidade de um conversor comercial para qualquer PDF.
