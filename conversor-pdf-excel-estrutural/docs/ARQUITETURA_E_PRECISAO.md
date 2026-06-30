# Arquitetura, precisão e desempenho

Este documento descreve o funcionamento atual do Processador de Tabelas de Processos Trabalhistas, os pontos que afetam a precisão e a arquitetura recomendada para tornar a extração adequada ao uso como dado bruto em Excel, VBA, Power Query e análise de dados.

## 1. Objetivo técnico

O processador deve converter uma representação visual de tabela em uma estrutura tabular verificável:

```text
página PDF → itens de origem → linhas → células → tabela → planilha
```

Uma extração confiável precisa preservar, no mínimo:

- todas as linhas relevantes;
- a ordem das linhas;
- o número correto de colunas;
- células vazias;
- separação entre valores de colunas vizinhas;
- números, sinais e casas decimais;
- identificadores como CPF, CNPJ, matrícula e número de processo;
- continuidade entre páginas;
- rastreabilidade entre cada célula e os itens do PDF que a originaram.

A prioridade não deve ser apenas gerar uma planilha visualmente bonita. A prioridade é produzir dados corretos e detectar quando o sistema não possui evidência suficiente para afirmar que a tabela está correta.

## 2. Componentes atuais

### Interface

- `index.html`
- `assets/css/app.css`
- `assets/js/ui/appController.js`
- `assets/js/ui/status.js`

Responsabilidades:

- seleção do PDF;
- seleção de páginas;
- escolha do modo de origem;
- escolha do modo de saída;
- parâmetros de OCR;
- execução;
- exportação.

### Leitura e renderização do PDF

- `assets/js/pdf/pdfLoader.js`
- `assets/js/pdf/pageRenderer.js`

O `pdfLoader` usa `pdf.js` para obter itens textuais e coordenadas. Cada item normalizado contém:

```text
id
pageNumber
text
rawText
x
y
width
height
right
bottom
fontName
fontSize
dir
hasEOL
```

O `pageRenderer` renderiza uma página em PNG na resolução escolhida para OCR e artefatos visuais.

### Orquestração do processamento

- `assets/js/processing/browserProcessor.js`
- `assets/js/processing/processingWorker.js`

Responsabilidades:

1. extrair o texto da página;
2. renderizar a página;
3. decidir entre texto, OCR e híbrido;
4. enviar os dados serializáveis ao Web Worker;
5. reconstruir o resultado no thread principal;
6. anexar artefatos de página.

### Reconstrução estrutural

- `assets/js/extraction/rows.js`
- `assets/js/extraction/tableBlocks.js`
- `assets/js/extraction/columns.js`
- `assets/js/extraction/headerSignature.js`
- `assets/js/extraction/tableContinuation.js`
- `assets/js/extraction/splitRowContinuation.js`
- `assets/js/extraction/valueClassifier.js`
- `assets/js/extraction/tableExtractor.js`

Fluxo:

```text
itens de texto
  ↓
agrupamento por coordenada vertical
  ↓
segmentos da linha por distância horizontal
  ↓
seleção dos blocos com aparência tabular
  ↓
clusters de posições X
  ↓
âncoras de coluna
  ↓
atribuição de cada segmento à âncora mais próxima
  ↓
matriz de células
  ↓
detecção de cabeçalho e tipos
  ↓
união de tabelas consecutivas
```

### Modelo e auditoria

- `assets/js/model/resultModel.js`
- `assets/js/model/tableModel.js`

O resultado preserva:

- nome do arquivo;
- páginas totais e selecionadas;
- tabelas;
- diagnósticos;
- configurações;
- alterações manuais;
- itens de origem;
- itens não associados;
- estado de OCR;
- validação de conservação de conteúdo;
- avisos.

### Exportação

- `assets/js/export/workbookBuilder.js`
- `assets/js/export/xlsmTemplateBuilder.js`
- `assets/js/export/zipBuilder.js`
- `assets/js/export/tableLayout.js`
- `assets/js/export/csvBuilder.js`

Saídas:

- XLSX com abas `Dados_Tnnn`;
- XLSM baseado em modelo com VBA;
- ZIP com XLSX, CSVs e diagnóstico.

## 3. O que já está bem encaminhado

### Rastreabilidade

As células guardam IDs dos itens de origem. Isso permite conferir se um fragmento foi usado, duplicado ou perdido.

### Conservação de conteúdo

O modelo calcula itens:

- atribuídos;
- não atribuídos;
- duplicados;
- ausentes;
- não atribuídos dentro da área de uma tabela;
- não atribuídos na parte inferior da tabela.

Essa é uma base importante para impedir perda silenciosa de linhas finais.

### Continuação entre páginas

O código compara:

- páginas consecutivas;
- assinatura de cabeçalho;
- quantidade de colunas;
- distância entre âncoras;
- posição da tabela no fim e no início das páginas;
- linha terminal;
- cabeçalho repetido;
- linha dividida na quebra de página.

### Separação entre extração, modelo e exportação

A divisão em módulos permite substituir o algoritmo de detecção sem reescrever a interface e os exportadores.

### Web Worker

A reconstrução estrutural pode ser executada fora do thread principal, reduzindo o travamento da interface.

## 4. Fontes principais de imprecisão

## 4.1 Qualidade da camada textual

O modo automático considera a camada textual suficiente quando a página possui pelo menos três itens de texto.

Essa regra é rápida, mas não mede:

- proporção de caracteres ilegíveis;
- texto invisível ou duplicado;
- diferença entre o texto renderizado e o texto extraído;
- sobreposição anormal de itens;
- coordenadas inconsistentes;
- ausência de números esperados;
- fragmentação excessiva;
- cobertura da área da página.

Consequência: uma página pode ser classificada como textual mesmo com uma camada de texto ruim.

### Correção recomendada

Criar `scoreTextLayerQuality(pageData)` com métricas como:

```text
itemCount
printableCharacterRatio
replacementCharacterRatio
overlapRatio
medianTokenLength
singleCharacterRatio
coordinateDispersion
pageCoverage
numericPatternCount
readingOrderConsistency
```

Resultado sugerido:

```js
{
  score: 0.0,
  classification: 'good' | 'suspect' | 'bad',
  reasons: []
}
```

Regras:

- `good`: usar texto;
- `suspect`: usar híbrido ou comparar texto com OCR;
- `bad`: usar OCR.

## 4.2 Renderização desnecessária

Atualmente cada página selecionada é renderizada em PNG antes da decisão final sobre OCR.

Isso aumenta:

- tempo total;
- consumo de memória;
- tamanho temporário dos objetos;
- custo de páginas textuais que não precisam de imagem.

### Correção recomendada

Renderizar apenas quando uma destas condições for verdadeira:

```text
sourceMode = OCR
sourceMode = híbrido
camada textual classificada como suspeita ou ruim
saída visual solicitada
detecção de bordas ou cores solicitada
imagem solicitada para auditoria
```

Para PDF textual confiável, o caminho deve ser:

```text
getTextContent → reconstrução → exportação
```

sem PNG intermediário.

## 4.3 Agrupamento de linhas somente por distância vertical

O agrupamento atual procura a linha cuja coordenada `y` esteja dentro de uma tolerância.

Riscos:

- sobrescritos ou textos com fonte menor podem formar outra linha;
- duas linhas muito próximas podem ser unidas;
- células com quebra interna podem ser interpretadas como duas linhas da tabela;
- OCR com caixas ligeiramente desalinhadas pode separar palavras da mesma linha.

### Correção recomendada

Usar uma combinação de:

- distância entre baselines;
- interseção vertical das caixas;
- altura da fonte;
- número de linha fornecido pelo OCR;
- proximidade horizontal;
- padrão de colunas das linhas vizinhas.

A compatibilidade pode ser calculada por pontuação, não por uma única distância.

## 4.4 Segmentação horizontal antes da existência das colunas

Itens próximos são unidos em segmentos usando um `hardGap` derivado da largura mediana de caractere.

Riscos:

- duas colunas estreitas podem ser unidas;
- palavras da mesma célula podem ser separadas;
- um número negativo pode ser separado do sinal;
- símbolo monetário pode ficar em outra célula;
- cabeçalho em múltiplas linhas pode gerar âncoras inconsistentes.

### Correção recomendada

Separar o fluxo em duas etapas:

1. manter itens ou palavras com caixas individuais;
2. detectar limites de células ou colunas;
3. unir os itens que pertencem à mesma célula.

Quando houver bordas, a borda deve definir a célula. Quando não houver, os limites devem ser inferidos pela repetição de alinhamentos e espaços vazios.

## 4.5 Colunas baseadas apenas na coordenada esquerda

O modelo estrutural agrupa `segment.x`.

Isso funciona bem para texto alinhado à esquerda, mas é frágil para:

- números alinhados à direita;
- valores centralizados;
- colunas com quantidades diferentes de dígitos;
- datas e moedas;
- células vazias;
- colunas preenchidas em poucas linhas.

Exemplo:

```text
      9,50
  1.234,56
123.456,78
```

Os três valores pertencem à mesma coluna, mas têm coordenadas esquerdas diferentes.

### Correção recomendada

Gerar candidatos usando:

- borda esquerda;
- centro;
- borda direita;
- intervalos vazios entre itens;
- cabeçalho;
- tipo provável da célula.

Para cada coluna, inferir o alinhamento predominante:

```text
left
center
right
decimal
```

Atribuir itens usando os limites da coluna, e não somente a âncora mais próxima.

## 4.6 Clustering e suporte mínimo

O agrupamento atual:

- procura o primeiro cluster dentro da tolerância;
- atualiza o centro durante a leitura;
- exige suporte proporcional ao número de linhas;
- limita a 24 âncoras.

Riscos:

- resultado dependente da ordem;
- efeito de encadeamento entre posições próximas;
- exclusão de colunas esparsas;
- exclusão de colunas à direita quando o limite é atingido.

### Correção recomendada

Usar clustering unidimensional determinístico:

- ordenar todos os candidatos;
- agrupar por distância entre vizinhos;
- calcular centro robusto por mediana;
- pontuar por quantidade de linhas distintas, não quantidade absoluta de itens;
- preservar candidatos esparsos quando confirmados pelo cabeçalho ou por bordas.

## 4.7 Atribuição pela âncora mais próxima sem limite

Todo segmento recebe a coluna cuja âncora está mais próxima, mesmo que a distância seja grande.

Riscos:

- títulos entram em uma coluna aleatória;
- notas e rodapés entram na última ou primeira coluna;
- texto fora da tabela é incorporado;
- células mescladas são reduzidas a uma coluna.

### Correção recomendada

Calcular limites entre âncoras:

```text
boundary[i] = midpoint(anchor[i], anchor[i + 1])
```

Depois:

- rejeitar item fora dos limites externos;
- detectar item que cruza vários limites;
- marcar título ou célula mesclada;
- registrar item não associado quando não houver decisão segura.

## 4.8 Detecção de tabela permissiva

Uma linha pode ser considerada candidata mesmo com um único segmento longo.

Isso ajuda a preservar continuações, mas pode misturar:

- narrativa;
- títulos;
- observações;
- rodapés;
- texto jurídico.

### Correção recomendada

A detecção deve considerar evidências combinadas:

- repetição de colunas em pelo menos três linhas;
- alinhamentos verticais;
- presença de bordas;
- densidade numérica;
- cabeçalho provável;
- proximidade entre linhas;
- padrão semelhante nas páginas vizinhas.

Linhas com uma célula devem ser anexadas depois que a tabela estiver confirmada.

## 4.9 Modo visual ainda sem detector conectado

O extrator visual recebe `pageData.visualTables`, mas o processamento atual não cria essa coleção.

As opções:

```text
Detectar bordas
Detectar cores
Réplica visual
```

já existem na interface e no modelo, porém faltam as etapas que:

1. leem operadores gráficos ou pixels;
2. encontram linhas horizontais e verticais;
3. unem segmentos quebrados;
4. encontram interseções;
5. geram retângulos de células;
6. identificam `rowSpan` e `columnSpan`;
7. extraem preenchimentos e bordas;
8. produzem `visualTables`.

### Correção recomendada

Adicionar um módulo:

```text
assets/js/extraction/visualGridDetector.js
```

Entrada:

```js
{
  page,
  operatorList,
  viewport,
  textItems,
  settings
}
```

Saída:

```js
{
  visualLines: [],
  visualTables: [],
  confidence: 0,
  warnings: []
}
```

## 4.10 Mesclagem de texto PDF e OCR

A deduplicação híbrida atual usa principalmente sobreposição de caixas.

Riscos:

- texto incorreto do PDF pode impedir a entrada do OCR correto;
- pequenas diferenças de escala podem manter duas versões do mesmo texto;
- palavras parcialmente sobrepostas podem ser eliminadas incorretamente;
- o sistema não compara similaridade textual.

### Correção recomendada

Pontuar cada par com:

```text
geometricOverlap
centerDistance
textSimilarity
characterClassSimilarity
sourceConfidence
ocrConfidence
```

Política:

- mesma geometria e mesmo texto: manter o PDF;
- mesma geometria e textos diferentes: escolher pela qualidade da página e confiança OCR;
- sobreposição parcial: reconstruir por linha ou célula;
- dúvida: manter uma alternativa no diagnóstico e marcar a célula.

## 4.11 OCR por chamada isolada

O fluxo usa a função de reconhecimento diretamente para cada página.

Para documentos grandes, o ideal é criar um worker OCR uma vez, reutilizá-lo e encerrá-lo no final.

### Correção recomendada

Criar um `OcrWorkerPool` com:

- inicialização única;
- um ou dois workers;
- fila limitada;
- idioma carregado uma vez;
- configuração específica para números e tabelas;
- encerramento ao fim do documento.

Também é preferível reconhecer somente a região da tabela quando ela puder ser localizada.

## 4.12 Configurações sem efeito no caminho atual

Há configurações lidas pela interface ou pelo controlador que ainda não alteram o resultado principal como esperado.

Pontos a revisar:

- `detectBorders`;
- `detectColors`;
- `keepPageImagesInAudit`;
- `mergeSplitRows`, porque a união de linha na continuação é acionada diretamente no combinador;
- `outputMode = visual-replica`, por ausência de `visualTables`;
- opções técnicas presentes em `DEFAULT_SETTINGS`, mas sem campos na interface atual.

Cada controle deve ter:

1. efeito verificável;
2. teste automatizado;
3. descrição na documentação;
4. registro no diagnóstico.

## 4.13 Código especializado dentro do núcleo genérico

`applyKnownStrongModel` reconhece uma sequência específica de cabeçalhos trabalhistas.

Essa estratégia pode melhorar um formato conhecido, mas deve ser transformada em perfil configurável.

### Correção recomendada

Criar:

```text
assets/js/profiles/
  generic.js
  pje-demonstrativo.js
  fgts-mensal.js
  fgts-rescisorio.js
  contracheque.js
```

Cada perfil pode definir:

- aliases de cabeçalho;
- número esperado de colunas;
- tipos por coluna;
- campos obrigatórios;
- regras de continuação;
- totais esperados;
- validações de linha;
- normalizações específicas.

O núcleo continua genérico, e o perfil adiciona precisão quando o documento é conhecido.

## 4.14 Problemas de codificação de texto

Há indícios de caracteres corrompidos em expressões regulares de continuação, como variantes de palavras acentuadas.

Isso pode impedir a identificação de rodapés e linhas decorativas.

### Correção recomendada

- salvar todos os arquivos como UTF-8 sem conversões intermediárias;
- usar texto normalizado por `normalize('NFD')` e remoção de diacríticos;
- evitar regex com sequências já corrompidas;
- adicionar testes com `cálculo`, `página`, `versão`, `competência` e outras palavras acentuadas.

## 5. Arquitetura recomendada

## 5.1 Pipeline em múltiplas estratégias

```text
Fase 1 — inspeção barata
  ├── metadados
  ├── quantidade e qualidade do texto
  ├── presença de desenhos e linhas
  ├── presença de imagens
  └── provável região tabular

Fase 2 — escolha de estratégia por página
  ├── text-grid
  ├── text-whitespace
  ├── visual-grid
  ├── OCR
  └── hybrid

Fase 3 — reconstrução
  ├── linhas
  ├── células
  ├── cabeçalho
  ├── tipos
  └── continuidade

Fase 4 — validação
  ├── conservação dos itens
  ├── esquema
  ├── padrões de tipos
  ├── totais
  ├── linhas finais
  └── confiança

Fase 5 — exportação
  ├── tabela aceita
  ├── tabela com aviso
  └── página rejeitada para revisão
```

## 5.2 Estratégia para tabelas com bordas

1. obter operadores gráficos ou linhas vetoriais;
2. converter tudo para o mesmo sistema de coordenadas;
3. filtrar linhas quase horizontais e quase verticais;
4. unir segmentos próximos;
5. encontrar interseções;
6. construir células mínimas;
7. detectar células mescladas;
8. atribuir texto pela posição central ou pela área de interseção;
9. validar se todos os itens dentro da tabela foram atribuídos.

Essa estratégia deve ser prioritária quando a grade for detectada com confiança alta.

## 5.3 Estratégia para tabelas sem bordas

1. detectar cabeçalho provável;
2. criar candidatos de alinhamento esquerdo, central e direito;
3. inferir limites de coluna por espaços persistentes;
4. usar as linhas de dados para confirmar o modelo;
5. ajustar colunas numéricas por borda direita ou separador decimal;
6. preservar células vazias;
7. rejeitar linhas incompatíveis em vez de forçá-las para a coluna mais próxima.

## 5.4 Perfis de documento

Uma extração genérica deve continuar disponível, mas os formatos recorrentes do trabalho podem ganhar perfis.

Exemplos:

```text
Demonstrativo de cálculo
Débito mensal de FGTS por empregado
Débito rescisório por empregado
Contracheque
Ficha financeira
Cartão de ponto
```

Perfis melhoram a precisão porque permitem validar a semântica, não apenas a geometria.

## 5.5 Confiança por célula

Cada célula deve guardar:

```js
{
  value,
  sourceType,
  sourceItemIds,
  geometryConfidence,
  textConfidence,
  schemaConfidence,
  finalConfidence,
  warnings
}
```

Exemplos de aviso:

```text
OCR com confiança baixa
valor atravessa limite de coluna
texto conflitante entre PDF e OCR
célula esperada vazia
tipo incompatível com o cabeçalho
fragmento não associado dentro da célula
```

## 6. Desempenho

## 6.1 Caminho rápido

Para página textual classificada como boa:

```text
não renderizar PNG
não executar OCR
não guardar imagem
processar texto no worker
```

## 6.2 Concorrência limitada

Usar uma fila com concorrência configurável:

```text
texto PDF: 3 ou 4 páginas simultâneas
renderização: 2 páginas simultâneas
OCR: 1 ou 2 páginas simultâneas
```

A concorrência deve considerar memória, não apenas quantidade de núcleos.

## 6.3 Evitar `dataUrl` para páginas grandes

`dataUrl` mantém a imagem codificada em base64 e aumenta o uso de memória.

Preferir:

- `Blob`;
- `ImageBitmap`;
- `OffscreenCanvas`;
- descarte imediato após OCR;
- guardar imagem apenas quando solicitado na auditoria.

## 6.4 Processamento incremental

Em vez de guardar todas as páginas antes da reconstrução:

1. processar uma pequena janela de páginas;
2. extrair e validar;
3. manter somente os dados estruturais;
4. conservar a página anterior para avaliar continuação;
5. liberar canvas, bitmap e imagem.

## 6.5 Índice de páginas

Para processos muito grandes, criar uma primeira varredura barata:

- texto inicial e final da página;
- quantidade de itens;
- palavras-chave;
- provável existência de tabela;
- assinatura de cabeçalho.

O usuário pode então processar somente as páginas candidatas.

## 7. Validação e testes

## 7.1 Corpus de referência

Criar uma pasta não pública ou um mecanismo de fixtures anonimizadas:

```text
tests/corpus/
  caso-001/
    input.pdf
    expected.tables.json
    expected.csv
  caso-002/
```

Os casos devem incluir:

- última linha na troca de página;
- cabeçalho repetido;
- rodapé perto da tabela;
- número negativo;
- coluna vazia;
- valor monetário;
- CPF e matrícula;
- tabela com e sem borda;
- PDF nativo;
- PDF escaneado;
- rotação;
- mais de uma tabela na página.

## 7.2 Métricas

Medir:

```text
cell_exact_match
row_exact_match
column_count_accuracy
numeric_exact_match
identifier_exact_match
source_item_recall
source_item_precision
unassigned_inside_table
processing_time_per_page
peak_memory
```

A métrica principal para o fluxo de análise deve ser a exatidão de células numéricas e identificadores, não apenas similaridade visual.

## 7.3 Testes de regressão

Toda correção de um PDF real deve gerar um caso reduzido e anonimizado que impeça o erro de voltar.

## 8. Ordem de implementação recomendada

### Etapa 1 — correções rápidas

- renderização condicional;
- worker OCR persistente;
- correção de codificação UTF-8;
- conexão correta dos controles;
- teste para cada opção da interface;
- relatório visível de itens não associados;
- exportação de uma aba de auditoria no XLSX.

### Etapa 2 — qualidade estrutural

- pontuação da camada textual;
- novo modelo de colunas com alinhamento esquerdo, central e direito;
- limites de coluna;
- rejeição de itens distantes;
- confiança por célula;
- tratamento robusto de cabeçalho em múltiplas linhas.

### Etapa 3 — grade visual

- leitura de linhas e retângulos;
- geração de `visualTables`;
- células mescladas;
- bordas e preenchimentos;
- ativação real de “Réplica visual”.

### Etapa 4 — perfis e validações

- perfis de documentos recorrentes;
- tipos esperados por coluna;
- validação de totais;
- validação de competências e datas;
- comparação PDF × Excel.

### Etapa 5 — corpus e métricas

- conjunto de referência;
- painel de regressão;
- tempo por página;
- memória máxima;
- taxa de revisão manual.

## 9. Alternativa para precisão máxima

Se a versão totalmente em navegador atingir um limite, a interface atual pode ser preservada e a extração movida para um serviço local.

Arquitetura:

```text
HTML/JavaScript
  ↓ HTTP local
Python local
  ├── PyMuPDF
  ├── pdfplumber
  ├── OCR
  ├── perfis
  └── validação
  ↓
JSON tabular
  ↓
ExcelJS/SheetJS ou openpyxl
```

Vantagens:

- acesso mais simples a palavras, desenhos e tabelas;
- melhor controle de memória;
- processamento em lote;
- bibliotecas especializadas;
- testes automatizados mais fortes;
- possibilidade de empacotar como aplicativo desktop.

A interface, as cores e o fluxo do processador podem permanecer praticamente iguais.

## 10. Critério de aceite

Uma página deve ser marcada como confiável somente quando:

- não existem itens de origem perdidos dentro da área tabular;
- não existem itens duplicados;
- o número de colunas é consistente;
- os tipos esperados são respeitados;
- a última linha foi capturada;
- a continuação entre páginas foi resolvida ou explicitamente sinalizada;
- a confiança mínima foi atingida.

Caso contrário, a página deve sair como:

```text
REVISÃO NECESSÁRIA
```

com a razão exata da incerteza.