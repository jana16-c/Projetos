# Estrutura tecnica

## Fluxo

1. `main.js` inicializa `AppController`.
2. `ui/appController.js` controla upload, opcoes, processamento, edicao e exportacao.
3. `pdf/pdfLoader.js` le cada pagina com `pdf.js`, normaliza coordenadas e aplica margens ignoradas.
4. `extraction/tableExtractor.js` monta o resultado do documento.
5. `extraction/rows.js` reconstrói linhas por baseline.
6. `extraction/tableBlocks.js` separa blocos tabulares na pagina.
7. `extraction/columns.js` infere ancoras de coluna e monta a matriz.
8. `extraction/headerSignature.js` detecta a assinatura do cabecalho.
9. `extraction/tableContinuation.js` tenta unir tabelas consecutivas.
10. `extraction/valueClassifier.js` tipa valores de forma conservadora.
11. `ui/tableEditor.js` aplica alteracoes em memoria com undo por tabela.
12. `export/workbookBuilder.js`, `export/xlsmTemplateBuilder.js` e `export/zipBuilder.js` geram as saidas finais.

## Modelo de saida

O estado principal do processamento e um `DocumentExtractionResult` contendo:

- arquivo de origem;
- total de paginas e paginas selecionadas;
- tabelas detectadas;
- diagnostico por pagina;
- configuracoes usadas;
- alteracoes manuais;
- data da extracao.

Cada tabela preserva:

- `matrix` para exibicao e exportacao;
- `cells` com metadados da origem e valor normalizado;
- `rowMeta` com perfil visual das linhas;
- `headerSignature`;
- `sourcePages`;
- `pageBreaks` para separar novamente tabelas unidas.

## Testes

Os testes Node cobrem:

- selecao de paginas;
- agrupamento de linhas;
- inferencia de colunas;
- deteccao de blocos;
- continuacao entre paginas;
- classificacao de valores;
- substituicao segura de abas `EXTRACAO_` no fluxo XLSM;
- extracao fim a fim com fixture sintetica.
