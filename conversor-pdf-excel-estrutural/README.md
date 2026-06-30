# Processador de Tabelas de Processos Trabalhistas

Aplicação local para converter dados estruturados de PDFs em planilhas Excel, priorizando:

1. velocidade em documentos grandes;
2. conservação do conteúdo original;
3. precisão de linhas, colunas, valores e identificadores;
4. rastreabilidade para conferência e automações VBA.

## Estado atual

| Recurso | Situação |
|---|---|
| Leitura de PDF textual com `pdf.js` | Implementado |
| Seleção de páginas e intervalos | Implementado |
| Reconstrução por coordenadas | Implementado |
| Separação de blocos tabulares | Implementado |
| Continuação entre páginas | Implementado |
| União de linhas quebradas na troca de página | Implementado |
| OCR com `Tesseract.js` | Implementado como recurso opcional |
| Modo híbrido: texto do PDF + OCR | Implementado |
| Classificação de datas, valores e identificadores | Implementado |
| Exportação XLSX | Implementado |
| Exportação XLSM baseada em modelo | Implementado |
| ZIP com CSVs e diagnóstico | Implementado |
| Auditoria de itens não associados | Implementada no modelo e no ZIP |
| Detecção real de bordas e cores | Parcial |
| Réplica visual baseada em grade | Parcial |
| Prévia e editor de tabela na interface principal | Módulos existentes, ainda não conectados |
| Todas as tabelas em uma única aba | Planejado |

## Execução correta

### Desenvolvimento no VS Code

Durante o desenvolvimento e os testes, **não é necessário executar o build**.

1. Abra a pasta do projeto no VS Code.
2. Abra `index.html`.
3. Execute com **Live Preview**.
4. Teste as alterações usando os módulos em `assets/js/`.

O `index.html` é a entrada modular de desenvolvimento. Ele não é o artefato final de distribuição.

### Uso final e distribuição

Para uso fora do ambiente de desenvolvimento:

1. execute o build do projeto;
2. localize o HTML consolidado gerado;
3. abra diretamente esse arquivo no navegador.

O usuário final não deve precisar iniciar servidor Python, executar `server.py` ou usar `ABRIR_APP_WINDOWS.bat`.

O build final deve preservar estas propriedades:

- um HTML consolidado e executável diretamente;
- funcionamento sem servidor local;
- módulos, estilos e dependências corretamente incorporados ou resolvidos;
- mesmo comportamento validado no `index.html` de desenvolvimento;
- processamento local do PDF;
- ausência de dependência obrigatória de CDN para documentos sigilosos.

> O comando e o destino do build ainda devem ser padronizados no projeto. A implementação deve preservar o nome e o destino do HTML consolidado já utilizado. Caso não exista um padrão versionado, o plano técnico recomenda `npm run build` com saída em `dist/`.

## Uso da aplicação

1. Escolha ou arraste o PDF.
2. Informe as páginas desejadas.
3. Ajuste a origem e o formato de saída, quando necessário.
4. Processe o documento.
5. Confira os avisos e métricas.
6. Exporte em XLSX, XLSM ou ZIP.

### Seleção de páginas

```text
1-3
1-3, 5
2, 4-6, 10
```

A lista é validada, ordenada e deduplicada antes do processamento.

## Modos de origem

### Automático

Usa a camada textual quando ela parece suficiente e tenta OCR quando a página possui pouco texto detectável.

A regra atual ainda é simples e será substituída por uma pontuação de qualidade da camada textual.

### Texto PDF

Usa os itens e coordenadas fornecidos pelo `pdf.js`.

É o caminho mais rápido para PDFs digitais com camada textual confiável.

### OCR

Renderiza a página e usa o texto reconhecido pelo `Tesseract.js`.

É indicado para páginas escaneadas, mas é mais lento e exige validação de números e caracteres semelhantes.

### Híbrido

Combina texto nativo e OCR, removendo itens sobrepostos.

A reconciliação deverá evoluir para considerar também similaridade textual e confiança de cada fonte.

## Modos de saída

### Tabela limpa

Produz matriz voltada a:

- filtros;
- macros VBA;
- comparação entre tabelas;
- Power Query;
- Power BI;
- consolidação de dados.

### Réplica visual

A estrutura de exportação visual já existe, mas a geração automática de `visualTables` por bordas, retângulos e cores ainda precisa ser conectada ao processamento principal.

### Organização das abas

O comportamento atual mantém uma aba por tabela.

A implementação planejada acrescentará:

```text
Uma aba por tabela — padrão atual
Todas as tabelas em uma única aba — opção adicional
```

O modo de uma única aba será implementado somente na camada de exportação. Ele não modificará a extração, a matriz das tabelas ou a lógica de continuidade.

## Saídas

### XLSX

Cada tabela é atualmente gravada em uma aba:

```text
Dados_T001
Dados_T002
Dados_T003
```

Quando disponíveis, são preservados:

- cabeçalho;
- largura de coluna;
- altura de linha;
- quebra de texto;
- tipos numéricos e datas;
- células mescladas;
- bordas e preenchimentos.

### XLSM

Exige um modelo `.xlsm` real. O projeto VBA do modelo é preservado e as abas de extração são adicionadas ou substituídas.

### ZIP

Inclui:

```text
arquivo.xlsx
tabelas/*.csv
diagnostico/resultado.json
diagnostico/configuracoes.json
diagnostico/alteracoes_manuais.json
diagnostico/avisos.txt
```

## Arquitetura resumida

```text
PDF
  ↓
pdf.js: texto e coordenadas
  ↓
texto, OCR ou híbrido
  ↓
agrupamento em linhas
  ↓
detecção de blocos tabulares
  ↓
inferência de colunas
  ↓
classificação das células
  ↓
continuação entre páginas
  ↓
validação e auditoria
  ↓
XLSX, XLSM ou ZIP
```

## Estrutura principal

```text
conversor-pdf-excel-estrutural/
├── index.html                 # entrada modular de desenvolvimento
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
├── docs/
└── package.json
```

## Desenvolvimento e testes

```bash
npm test
npm run check:syntax
```

O build não é necessário para testar pelo Live Preview. Ele deve ser executado antes de distribuir o HTML consolidado.

## Documentação técnica

- [`Arquitetura, precisão e desempenho`](./docs/ARQUITETURA_E_PRECISAO.md)
- [`Plano incremental para implementação pelo Codex`](./docs/PLANO_IMPLEMENTACAO_CODEX.md)

## Regras de qualidade

A evolução do projeto deve obedecer aos seguintes princípios:

- não alterar o comportamento padrão sem teste de regressão;
- não substituir uma extração válida por estratégia de menor confiança;
- manter o extrator atual como fallback durante a evolução;
- não executar OCR ou renderização quando o caminho textual rápido for suficiente;
- não perder conteúdo silenciosamente;
- registrar itens rejeitados ou não associados;
- medir precisão e desempenho antes de ativar uma estratégia por padrão;
- implementar recursos novos de forma incremental e reversível.

## Limitações

PDFs descrevem a aparência da página e nem sempre a estrutura lógica da tabela. Os principais casos de risco são:

- números alinhados à direita;
- tabelas sem bordas;
- células mescladas;
- cabeçalhos em várias linhas;
- linhas divididas entre páginas;
- rodapés próximos da última linha;
- camada textual incorreta;
- páginas escaneadas;
- colunas esparsas;
- várias tabelas na mesma página.

A meta é reduzir a revisão manual sem tratar resultados incertos como corretos.

## Privacidade

O PDF é processado localmente. O HTML consolidado de distribuição deve funcionar com as dependências necessárias incorporadas ou disponíveis localmente, evitando CDN em documentos sensíveis.