# Plano incremental de implementação para o Codex

## Objetivo

Evoluir o processador sem degradar o resultado atual, acrescentando:

- build confiável do HTML consolidado;
- opção de exportar todas as tabelas em uma única aba;
- caminho rápido para PDFs textuais;
- decisão mais segura entre texto e OCR;
- reconstrução de colunas mais precisa;
- detecção visual de grades;
- auditoria e testes de regressão.

Este documento é uma especificação de execução. Evite refatorações fora do escopo.

---

## 1. Regras obrigatórias

1. O comportamento padrão deve permanecer igual ao atual.
2. Novas estratégias devem ter fallback para a implementação existente.
3. Não remover dados para produzir uma tabela visualmente mais limpa.
4. Todo item não associado deve permanecer disponível na auditoria.
5. Não executar OCR ou renderização se o texto nativo confiável for suficiente.
6. Não alterar formatos públicos do `documentResult` sem compatibilidade retroativa.
7. Não modificar arquivos em `assets/js/vendor/`.
8. Não reescrever módulos completos quando uma função isolada resolver o problema.
9. Cada fase deve incluir testes antes de ser ativada por padrão.
10. O modo de uma única aba deve alterar apenas a exportação.

### Estratégia de compatibilidade

```text
recurso novo aprovado → usar recurso novo
recurso novo incerto   → usar implementação atual
recurso novo falhou    → usar implementação atual + aviso
```

---

## 2. Fluxo de desenvolvimento e build

### Desenvolvimento

- Entrada: `index.html`.
- Execução: VS Code Live Preview.
- Build não obrigatório durante testes.
- Manter imports modulares e cache-busters atuais enquanto necessários.

### Distribuição

O artefato final deve ser um HTML consolidado aberto diretamente no navegador, sem servidor Python.

### Implementação

1. Verificar se já existe uma rotina de build funcional.
2. Preservar o nome e o destino do HTML consolidado já utilizado.
3. Caso não exista build versionado, criar:

```text
scripts/build-standalone.mjs
```

4. Adicionar ao `package.json`:

```json
"build": "node scripts/build-standalone.mjs"
```

5. Na ausência de padrão existente, usar:

```text
dist/processador-tabelas.html
```

### Requisitos do build

- consolidar HTML, CSS e módulos JavaScript;
- resolver imports relativos;
- funcionar em `file://`;
- não depender de `server.py`;
- não alterar a lógica de desenvolvimento;
- preferir dependências locais no artefato final;
- falhar explicitamente se uma dependência obrigatória não puder ser incorporada;
- não gerar arquivos intermediários no repositório, exceto em `dist/`;
- saída determinística sempre que o código não mudar.

### Teste de aceite

1. Executar o build.
2. Desconectar a internet.
3. Abrir o HTML consolidado diretamente.
4. Processar um PDF textual.
5. Exportar XLSX.
6. Confirmar ausência de erro de CORS, import ou worker.

---

## 3. Opção: todas as tabelas em uma única aba

## 3.1 Contrato funcional

Adicionar em **Opções avançadas**:

```text
Organização do Excel
- Uma aba por tabela
- Todas as tabelas em uma única aba
```

Valores internos:

```text
sheetMode = "table"   // padrão atual
sheetMode = "single"  // novo
```

O padrão deve continuar sendo `table`.

## 3.2 Arquivos principais

```text
index.html
assets/js/config/settings.js
assets/js/ui/appController.js
assets/js/export/workbookBuilder.js
assets/js/export/xlsmTemplateBuilder.js
assets/js/export/zipBuilder.js
tests/
```

## 3.3 Interface e configuração

### `index.html`

Adicionar `select#sheetMode` sem alterar os IDs existentes:

```html
<select id="sheetMode" name="sheetMode">
  <option value="table" selected>Uma aba por tabela</option>
  <option value="single">Todas as tabelas em uma única aba</option>
</select>
```

### `settings.js`

Manter:

```js
sheetMode: 'table'
```

### `appController.js`

O controlador já tenta ler `#sheetMode`. Apenas validar que:

```js
sheetMode: readValue('#sheetMode', DEFAULT_SETTINGS.sheetMode)
```

é preservado no `documentResult.settings`.

## 3.4 XLSX

### Regra principal

Não alterar `buildRenderableTable`, a extração nem o conteúdo das matrizes.

No `workbookBuilder.js`:

```js
if (documentResult.settings.sheetMode === 'single') {
  addSingleDataSheet(workbook, documentResult);
} else {
  addTableSheets(workbook, documentResult);
}
```

### `addSingleDataSheet`

1. Usar `normalizeWorkbookTablesForExport(documentResult.tables)`.
2. Respeitar a ordem de página e tabela já retornada.
3. Criar uma única aba com nome seguro:

```text
Dados
```

4. Escrever cada `renderable` usando a mesma função usada no modo atual.
5. Aplicar um `rowOffset` por bloco.
6. Preservar:
   - valores;
   - tipos;
   - estilos;
   - alturas;
   - larguras;
   - células mescladas;
   - cabeçalhos;
   - títulos.
7. Inserir uma linha vazia entre tabelas independentes.
8. Não inserir colunas de página, tabela ou origem.
9. Não remover cabeçalhos repetidos nesta fase.
10. Não concatenar semanticamente tabelas diferentes.

### Motivo

O modo deve ser **sem perda e sem interpretação adicional**. A consolidação semântica pode ser implementada futuramente como outro recurso.

### Autofiltro

Uma planilha aceita apenas um autofiltro global simples. Portanto:

- no modo `table`, manter o comportamento atual;
- no modo `single`, não aplicar autofiltro global quando houver mais de um bloco;
- não criar um filtro que inclua títulos ou tabelas incompatíveis.

### Congelamento

- no modo `table`, manter o cabeçalho congelado;
- no modo `single`, congelar apenas a primeira linha se o primeiro bloco iniciar com cabeçalho na linha 1;
- caso contrário, não congelar.

### Largura de colunas

Calcular a maior largura solicitada por índice de coluna entre todos os blocos:

```js
finalWidth[column] = max(widthAcrossBlocks[column])
```

Aplicar limite atual de largura.

### Mesclagens

Somar o deslocamento da tabela:

```js
merge.startRow += rowOffset
merge.endRow += rowOffset
```

Validar para impedir sobreposição de intervalos.

## 3.5 XLSM

No `xlsmTemplateBuilder.js`:

- `table`: manter abas `EXTRACAO_*` atuais;
- `single`: criar somente uma aba de dados, por exemplo:

```text
EXTRACAO_DADOS
```

Usar as mesmas regras de ordem, separador e preservação do XLSX.

Não alterar abas do modelo que não começam com o prefixo reservado de extração.

## 3.6 ZIP

O XLSX ou XLSM incluído no ZIP deve respeitar `sheetMode`.

Os CSVs devem continuar separados por tabela. Não alterar o pacote atual.

## 3.7 Testes

Criar testes para:

1. padrão continua `table`;
2. `table` produz várias abas;
3. `single` produz somente `Dados`;
4. ordem das tabelas é preservada;
5. todas as células aparecem na aba única;
6. linha separadora não elimina dados;
7. mesclagens recebem offset correto;
8. larguras usam o maior valor por coluna;
9. XLSM preserva abas não relacionadas;
10. ZIP respeita o modo selecionado;
11. extração e `documentResult.tables` são idênticos nos dois modos.

---

## 4. Melhorias de desempenho sem regressão

## 4.1 Pontuação da camada textual

Criar:

```text
assets/js/pdf/textLayerQuality.js
```

API:

```js
export function scoreTextLayerQuality(pageData) {
  return {
    score: 0,
    classification: 'good', // good | suspect | bad
    reasons: [],
    metrics: {},
  };
}
```

Métricas mínimas:

- quantidade de itens;
- proporção de caracteres imprimíveis;
- proporção de itens com um caractere;
- sobreposição anormal;
- cobertura da página;
- consistência das coordenadas;
- quantidade de padrões numéricos;
- repetição excessiva.

### Integração

No modo automático:

```text
good    → texto nativo
suspect → híbrido, se OCR disponível
bad     → OCR
```

O critério atual de quantidade mínima deve permanecer como fallback.

## 4.2 Renderização condicional

No `browserProcessor.js`, renderizar somente quando:

```text
sourceMode = ocr
sourceMode = hybrid
textQuality != good
outputMode = visual-replica
detectBorders = true e detector visual ativo
detectColors = true e detector visual ativo
keepPageImagesInAudit = true
```

Para texto confiável e saída limpa:

```text
extractPageTextItems → worker estrutural → exportação
```

Sem canvas e sem PNG.

### Compatibilidade

A ausência de imagem não deve ser considerada falha quando nenhuma funcionalidade visual foi solicitada.

## 4.3 Memória

- evitar `dataUrl` permanente para páginas grandes;
- preferir `Blob`, `ImageBitmap` ou canvas transitório;
- liberar canvas após OCR;
- não armazenar imagem no `documentResult` quando `keepPageImagesInAudit` for falso;
- processar páginas em janela limitada.

## 4.4 OCR persistente

Criar:

```text
assets/js/ocr/ocrWorkerPool.js
```

Requisitos:

- inicializar uma vez por documento;
- reutilizar idioma e worker;
- concorrência padrão: 1;
- permitir máximo 2 após medição;
- encerrar no `finally`;
- manter fallback atual caso a inicialização falhe.

---

## 5. Melhorias de precisão estrutural

## 5.1 Não substituir o modelo atual imediatamente

Manter `columns.js` como implementação legada.

Criar uma implementação paralela:

```text
assets/js/extraction/columnBoundaries.js
```

Ativar inicialmente por flag:

```js
columnModelV2: false
```

Somente mudar o padrão após testes reais.

## 5.2 Modelo de colunas V2

Usar candidatos:

```text
left   = x
center = x + width / 2
right  = right
decimal = posição do separador decimal
```

Para cada coluna, inferir:

```text
left | center | right | decimal
```

Produzir:

```js
{
  columns: [
    {
      leftBoundary,
      rightBoundary,
      anchor,
      alignment,
      supportRows,
      confidence,
    }
  ],
  confidence,
  warnings,
}
```

## 5.3 Associação de células

Não atribuir automaticamente todo item à âncora mais próxima.

Regras:

1. item dentro dos limites → associar;
2. item cruza vários limites → marcar como mesclado ou incerto;
3. item fora dos limites → não associado;
4. distância excessiva → não associado;
5. título largo → preservar como título, sem forçar em coluna de dados.

O item não associado deve continuar no diagnóstico.

## 5.4 Linhas V2

Criar pontuação de compatibilidade usando:

- distância de baseline;
- interseção vertical;
- altura;
- tamanho de fonte;
- proximidade horizontal;
- linha do OCR, quando disponível;
- compatibilidade com o padrão de colunas.

Manter `rows.js` atual como fallback.

## 5.5 Reconciliação PDF + OCR

Comparar:

- sobreposição geométrica;
- distância entre centros;
- similaridade textual;
- classes de caracteres;
- qualidade da camada textual;
- confiança OCR.

Não permitir que texto PDF de baixa qualidade elimine automaticamente OCR de alta confiança.

Registrar conflitos no diagnóstico da célula.

---

## 6. Detecção visual de grades

Implementar somente após as fases anteriores.

Criar:

```text
assets/js/extraction/visualGridDetector.js
```

Entrada:

```js
{
  page,
  viewport,
  operatorList,
  textItems,
  renderedPage,
  settings,
}
```

Saída compatível com `visualTableExtractor.js`:

```js
{
  visualLines: [],
  visualTables: [],
  confidence: 0,
  warnings: [],
}
```

Etapas:

1. extrair linhas e retângulos vetoriais;
2. normalizar coordenadas;
3. unir segmentos colineares próximos;
4. localizar interseções;
5. construir células;
6. detectar `rowSpan` e `columnSpan`;
7. atribuir texto por interseção de área;
8. detectar bordas e preenchimentos;
9. validar cobertura dos itens.

### Ativação

```js
visualGridV2: false
```

Usar o detector visual apenas quando sua confiança superar a estratégia estrutural. Caso contrário, manter o resultado atual.

---

## 7. Perfis de documentos

Criar somente depois de estabilizar o núcleo:

```text
assets/js/profiles/
├── generic.js
├── demonstrativo-calculo.js
├── fgts-mensal.js
├── fgts-rescisorio.js
├── contracheque.js
├── ficha-financeira.js
└── cartao-ponto.js
```

Contrato sugerido:

```js
{
  id,
  detect(documentContext),
  headerAliases,
  expectedColumns,
  requiredColumns,
  columnTypes,
  continuationRules,
  validators,
  normalizers,
}
```

Mover regras específicas atualmente presentes no núcleo para perfis, mantendo compatibilidade.

---

## 8. Auditoria

## 8.1 XLSX

Adicionar aba opcional:

```text
_AUDITORIA
```

Conteúdo mínimo:

- página;
- tabela;
- confiança;
- itens de origem;
- itens associados;
- itens não associados;
- itens não associados dentro da área tabular;
- itens da zona inferior não associados;
- OCR utilizado;
- avisos.

Não adicionar essa aba quando uma configuração futura `includeAuditSheet` estiver desabilitada. Até existir interface, manter habilitada somente no ZIP ou atrás de flag.

## 8.2 Interface

Exibir resumo após processamento:

```text
Páginas OK
Páginas para revisar
Itens não associados em tabelas
Conflitos PDF/OCR
Tabelas com baixa confiança
```

Não renderizar milhares de itens no DOM. Mostrar contagem e detalhes sob demanda.

---

## 9. Testes e métricas

## 9.1 Antes de modificar

Executar:

```bash
npm test
npm run check:syntax
```

Registrar tempo de uma fixture grande antes e depois.

## 9.2 Corpus

Criar fixtures anonimizadas ou sintéticas para:

- PDF textual;
- PDF escaneado;
- números alinhados à direita;
- sinal negativo;
- moeda;
- CPF e matrícula;
- célula vazia;
- cabeçalho em duas linhas;
- última linha da página;
- linha dividida entre páginas;
- rodapé próximo à tabela;
- mais de uma tabela;
- tabela com bordas;
- tabela sem bordas.

## 9.3 Métricas

```text
cell_exact_match
numeric_exact_match
identifier_exact_match
row_exact_match
column_count_accuracy
source_item_recall
source_item_precision
unassigned_inside_table
processing_time_per_page
peak_memory
```

## 9.4 Limites de regressão

Uma mudança não pode ser ativada por padrão se:

- reduzir `numeric_exact_match`;
- reduzir `identifier_exact_match`;
- aumentar itens perdidos dentro da tabela;
- aumentar o tempo do caminho textual rápido em mais de 10%;
- aumentar memória máxima sem justificativa mensurada;
- alterar o XLSX padrão quando `sheetMode = table`.

---

## 10. Ordem de execução

Implementar em commits separados:

### Fase 1 — segura

1. corrigir README e build;
2. adicionar `sheetMode` na interface;
3. implementar aba única em XLSX;
4. implementar aba única em XLSM;
5. adicionar testes de exportação.

### Fase 2 — desempenho

1. pontuação da camada textual;
2. renderização condicional;
3. OCR persistente;
4. liberação de imagens e canvas;
5. métricas de tempo e memória.

### Fase 3 — precisão

1. colunas V2;
2. limites de associação;
3. linhas V2;
4. reconciliação híbrida;
5. confiança por célula.

### Fase 4 — visual

1. operadores gráficos;
2. linhas e retângulos;
3. células e mesclagens;
4. cores e bordas;
5. ativação da réplica visual.

### Fase 5 — domínio

1. perfis;
2. validações por esquema;
3. totais;
4. painel de revisão.

---

## 11. Instruções de economia para o Codex

- Leia apenas os arquivos indicados na fase atual.
- Não analise `vendor/`.
- Não reformate arquivos sem necessidade.
- Não renomeie APIs existentes.
- Não crie abstrações sem uso imediato.
- Reutilize `buildRenderableTable` e funções de exportação existentes.
- Faça alterações pequenas e testáveis.
- Execute testes direcionados antes da suíte completa.
- Não implemente fases futuras junto com a fase atual.
- Documente apenas decisões não evidentes.

---

## 12. Definição de concluído

A implementação inicial estará concluída quando:

1. o desenvolvimento continuar funcionando pelo `index.html` no Live Preview;
2. o build gerar um HTML consolidado aberto diretamente;
3. o padrão continuar exportando uma aba por tabela;
4. a nova opção exportar todas as tabelas em uma única aba;
5. XLSX, XLSM e ZIP respeitarem `sheetMode`;
6. nenhuma tabela ou célula for perdida na aba única;
7. os testes anteriores continuarem passando;
8. os novos testes de exportação passarem;
9. o caminho padrão não ficar mais lento de forma mensurável;
10. toda nova estratégia possuir fallback para o comportamento atual.