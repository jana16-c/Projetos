# Estrutura técnica

## Fluxo principal

1. `main.js` inicializa o controlador.
2. `ui/appController.js` gerencia seleção de arquivo, opções, processamento e exportação.
3. `pdf/pdfLoader.js` carrega o PDF via pdf.js e extrai `textContent` de cada página.
4. `extraction/tableExtractor.js` coordena a reconstrução estrutural.
5. `extraction/rows.js` agrupa itens por linha visual.
6. `extraction/columns.js` detecta âncoras verticais e monta células.
7. `export/workbookBuilder.js` gera Excel com ExcelJS.
8. `export/zipBuilder.js` empacota Excel, CSVs e JSON técnico com zip.js.

## Estratégia de extração

A extração não é baseada em copiar texto puro. Ela usa a geometria da camada textual:

- posição X/Y de cada fragmento;
- largura do fragmento;
- altura/tamanho de fonte;
- nome da fonte quando disponível;
- distribuição das posições horizontais;
- distância entre fragmentos.

O algoritmo reconstrói:

- linhas por baseline;
- fragmentos por proximidade;
- colunas por clusters de alinhamento;
- títulos/cabeçalhos por peso visual;
- células vazias por lacunas entre âncoras.

## Modos

### Estrutural inteligente

Usa clusters de X e repetição de alinhamento para inferir colunas consistentes. É o padrão.

### Grade visual por posição

Usa faixas horizontais por posição, preservando melhor o aspecto visual quando a estrutura da tabela é irregular.

## Diagnóstico

Cada página processada gera um objeto técnico com:

- número da página;
- quantidade de itens extraídos;
- quantidade de linhas;
- quantidade de colunas;
- confiança estimada;
- avisos;
- parâmetros usados.

Esse diagnóstico é exportado no ZIP e também em uma aba `_diagnostico` no Excel.
