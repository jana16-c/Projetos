# Processador de Tabelas de Processos Trabalhistas

Aplicativo local para converter dados estruturados de arquivos PDF em planilhas Excel, com foco em duas necessidades principais:

1. **velocidade de processamento**, inclusive em documentos grandes;
2. **confiabilidade da tabela gerada**, para que o Excel possa ser usado como dado bruto em filtros, comparações, análises e rotinas VBA.

O processamento ocorre no navegador. O PDF não é enviado pela aplicação para um servidor externo. Quando as bibliotecas locais não estão instaladas, o aplicativo pode baixar os scripts necessários por CDN; para documentos sigilosos, prefira o modo totalmente offline.

## Estado atual

| Recurso | Situação |
|---|---|
| Leitura de PDF textual com `pdf.js` | Implementado |
| Seleção de páginas e intervalos | Implementado |
| Reconstrução de linhas e colunas por coordenadas | Implementado |
| Separação de blocos tabulares | Implementado |
| Continuação de tabelas entre páginas | Implementado |
| Tentativa de união de linhas quebradas na troca de página | Implementado |
| OCR com `Tesseract.js` | Implementado como recurso opcional |
| Modo híbrido: texto do PDF + OCR | Implementado |
| Classificação de datas, valores, percentuais e identificadores | Implementado |
| Exportação XLSX | Implementado |
| Exportação XLSM a partir de um modelo com macros | Implementado |
| Pacote ZIP com CSVs e diagnóstico técnico | Implementado |
| Auditoria de itens não associados | Implementada no modelo de dados e no ZIP |
| Detecção real de bordas, células e cores da página | Parcial; a interface já possui as opções, mas o detector visual ainda precisa ser conectado ao fluxo principal |
| Réplica visual da tabela baseada na grade do PDF | Parcial; atualmente pode usar o fluxo estrutural como fallback |
| Prévia e editor de tabela na interface atual | Módulos existentes, ainda não conectados à tela principal |

## Aplicações pretendidas

As planilhas geradas podem ser usadas como entrada para:

- limpeza e padronização de colunas;
- busca de valores, nomes, matrículas, competências e datas;
- comparação de duas tabelas com a mesma estrutura;
- conferência de valores pagos, devidos ou divergentes;
- consolidação de várias páginas ou documentos;
- criação de indicadores e relatórios;
- execução de macros VBA sem depender da leitura manual do PDF.

## Requisitos

### Para executar o aplicativo

- Windows, Linux ou macOS;
- navegador moderno;
- Python 3 apenas para iniciar o servidor local;
- bibliotecas JavaScript locais ou acesso à internet para carregamento por CDN.

### Para desenvolver e executar os testes

- Node.js;
- não há dependências NPM obrigatórias no momento.

## Instalação no Windows

Na pasta do projeto, execute uma vez:

```text
BAIXAR_BIBLIOTECAS_WINDOWS.bat
```

Esse arquivo baixa as bibliotecas para `assets/js/vendor/`, permitindo o uso offline.

Bibliotecas utilizadas:

- `pdf.js` para leitura da camada textual e renderização do PDF;
- `ExcelJS` para geração de arquivos `.xlsx`;
- `SheetJS` para manipulação de modelos `.xlsm`;
- `zip.js` para criação do pacote de auditoria;
- `Tesseract.js` para OCR opcional.

## Como abrir

No Windows:

```text
ABRIR_APP_WINDOWS.bat
```

Ou manualmente:

```bash
cd conversor-pdf-excel-estrutural
py -3 server.py
```

Depois acesse:

```text
http://127.0.0.1:8787
```

O servidor local desativa cache para evitar que o navegador mantenha uma versão antiga dos módulos durante os testes.

## Como usar

1. Clique em **Escolher PDF** ou arraste o arquivo para a área indicada.
2. Informe as páginas que devem ser processadas.
3. Abra **Opções avançadas** quando precisar alterar a origem do texto ou o tipo de saída.
4. Clique em **Processar**.
5. Confira a quantidade de páginas com camada textual e páginas processadas por OCR.
6. Exporte em `XLSX`, `XLSM` ou `ZIP`.

### Seleção de páginas

Exemplos válidos:

```text
1-3
1-3, 5
2, 4-6, 10
```

A lista é normalizada, validada e deduplicada antes do processamento.

## Modos de origem

### Automático

Usa a camada textual do PDF quando ela parece existir. O OCR é acionado quando a página possui quantidade insuficiente de itens textuais.

É o modo mais rápido, mas a regra automática atual ainda é simples. Um PDF pode possuir uma camada de texto numericamente suficiente e, mesmo assim, conter caracteres incorretos ou coordenadas ruins.

### Texto PDF

Usa somente os itens fornecidos pelo `pdf.js`.

Indicado para PDFs digitais com texto selecionável e alinhamento consistente.

### OCR

Renderiza a página e utiliza somente o texto reconhecido pelo `Tesseract.js`.

Indicado para PDF escaneado ou página composta por imagem. É mais lento e pode cometer erros em números, pontuação e caracteres semelhantes.

### Híbrido

Combina texto do PDF e OCR, tentando remover itens sobrepostos.

Pode ajudar quando a página mistura texto digital e imagem. Também exige mais processamento e precisa de validação mais rigorosa para evitar duplicidades ou substituição indevida de um texto correto.

## Modos de saída

### Tabela limpa

Reconstrói uma matriz de linhas e colunas voltada para análise de dados.

Esse é o modo recomendado para:

- filtros;
- macros VBA;
- comparação entre tabelas;
- fórmulas;
- Power Query;
- Power BI;
- consolidação de dados.

### Réplica visual

Foi preparada para usar células detectadas por bordas, posições e estilos visuais.

Na versão atual, a estrutura necessária para esse modo já existe, mas o detector que transforma linhas, retângulos e cores da página em `visualTables` ainda não está conectado ao processamento executado pelo navegador. Quando nenhuma grade visual é fornecida, o fluxo estrutural é usado como fallback.

## Saídas geradas

### XLSX

O nome de saída segue o arquivo original:

```text
nome-do-arquivo.xlsx
```

Cada tabela exportável é gravada em uma aba:

```text
Dados_T001
Dados_T002
Dados_T003
```

O exportador aplica, quando disponíveis:

- cabeçalho congelado;
- autofiltro;
- largura estimada das colunas;
- altura estimada das linhas;
- quebra automática de texto;
- tipos numéricos, datas e percentuais;
- células mescladas;
- bordas e preenchimentos vindos do modelo visual.

### XLSM

Requer a seleção de um arquivo `.xlsm` real como modelo.

O aplicativo preserva o conteúdo VBA do modelo e substitui ou adiciona as abas de extração. Não é possível criar um projeto VBA válido do zero apenas renomeando um arquivo `.xlsx`.

### ZIP

O pacote recebe o nome:

```text
nome-do-arquivo.zip
```

Conteúdo atual:

```text
nome-do-arquivo.xlsx
tabelas/
  pagina_001_tabela_1.csv
  pagina_002_tabela_1.csv
diagnostico/
  resultado.json
  configuracoes.json
  alteracoes_manuais.json
  avisos.txt
```

O JSON de resultado contém tabelas, páginas, avisos, itens não associados, validações de conservação de conteúdo e parâmetros usados na extração.

## Fluxo interno

```text
PDF
  ↓
pdf.js: texto e coordenadas
  ↓
renderização da página, quando necessária
  ↓
seleção da fonte: texto, OCR ou híbrido
  ↓
agrupamento dos itens em linhas
  ↓
detecção de blocos tabulares
  ↓
inferência das colunas
  ↓
classificação e normalização das células
  ↓
união de tabelas entre páginas
  ↓
validação de itens associados e não associados
  ↓
XLSX, XLSM ou ZIP
```

Detalhes de arquitetura, limitações e plano de precisão estão em [`docs/ARQUITETURA_E_PRECISAO.md`](./docs/ARQUITETURA_E_PRECISAO.md).

## Estrutura principal

```text
conversor-pdf-excel-estrutural/
├── index.html
├── server.py
├── package.json
├── assets/
│   ├── css/
│   └── js/
│       ├── config/
│       ├── export/
│       ├── extraction/
│       ├── model/
│       ├── pdf/
│       ├── processing/
│       ├── ui/
│       ├── utils/
│       └── vendor/
├── scripts/
├── tests/
└── docs/
```

## Testes

Execute na pasta do projeto:

```bash
npm test
npm run check:syntax
```

Os testes atuais cobrem, entre outros pontos:

- interpretação da seleção de páginas;
- agrupamento de itens em linhas;
- inferência de colunas;
- detecção de blocos;
- continuação entre páginas;
- linhas divididas na mudança de página;
- layout de exportação;
- classificação de valores;
- fluxo XLSM;
- extração sintética fim a fim.

## Limitações importantes

Nenhum extrator genérico consegue garantir precisão absoluta para todos os PDFs, porque um PDF descreve como desenhar uma página, não necessariamente a estrutura lógica da tabela.

Os principais casos de risco são:

- tabelas sem bordas e com alinhamentos variáveis;
- números alinhados à direita;
- células mescladas;
- cabeçalhos em duas ou mais linhas;
- linhas que começam em uma página e terminam em outra;
- rodapés misturados à última linha da tabela;
- texto desenhado caractere por caractere;
- camada textual invisível ou incorreta;
- PDFs escaneados com baixa resolução;
- tabelas diferentes na mesma página;
- colunas opcionais preenchidas em poucas linhas.

A meta do projeto deve ser: **não perder conteúdo silenciosamente**. Quando a confiança for insuficiente, o resultado deve ser marcado para revisão, e não tratado como correto apenas porque um arquivo Excel foi gerado.

## Privacidade

O arquivo é processado localmente no navegador. Entretanto:

- sem as bibliotecas locais, scripts podem ser carregados por CDN;
- isso não significa que o PDF seja enviado pela aplicação, mas adiciona dependência de código externo;
- para processos judiciais e documentos sensíveis, execute `BAIXAR_BIBLIOTECAS_WINDOWS.bat` e utilize o aplicativo offline.

## Direção recomendada

A evolução prioritária é transformar o processamento em um pipeline de múltiplas estratégias:

1. caminho rápido para PDF textual confiável;
2. detecção de linhas e retângulos para tabelas com grade;
3. inferência por alinhamento para tabelas sem borda;
4. OCR apenas nas páginas ou regiões necessárias;
5. validação por esquema e conservação de conteúdo;
6. relatório de confiança por página, linha e célula.

Essa abordagem melhora simultaneamente velocidade, precisão e rastreabilidade.