# Conversor PDF → Excel Estrutural

Aplicativo local para converter páginas específicas de PDFs textuais em Excel, preservando tabulação por análise geométrica do PDF.

## Objetivo

Este processador foi feito para casos como processos judiciais, relatórios, demonstrativos, contracheques, guias e PDFs grandes em que você precisa converter apenas algumas páginas para Excel sem perder a estrutura da tabela.

Ele usa:

- **pdf.js** para ler o PDF e acessar as posições reais do texto;
- **Extração estrutural própria** para reconstruir linhas, colunas e blocos tabulares;
- **ExcelJS** para gerar `.xlsx` com formatação;
- **zip.js** para empacotar Excel, CSVs por página e JSON técnico de diagnóstico.

## Layout

A interface foi construída com:

- fonte Inter, quando disponível no sistema;
- paleta em azul petróleo;
- bordas e divisórias finas;
- navegação por abas;
- aba **Utilização** explicando cada campo e cada botão.

## Bibliotecas locais necessárias

O `index.html` foi configurado para carregar bibliotecas locais na pasta:

```text
assets/js/vendor/
```

Essa pasta deve conter:

```text
pdf.min.js
pdf.worker.min.js
exceljs.min.js
zip-full.min.js
```

Para baixar automaticamente no Windows, execute:

```text
BAIXAR_BIBLIOTECAS_WINDOWS.bat
```

Depois execute:

```text
ABRIR_APP_WINDOWS.bat
```

## Como abrir no Windows

1. Clone ou atualize o repositório `Projetos`.
2. Entre em `Projetos/conversor-pdf-excel-estrutural`.
3. Execute `BAIXAR_BIBLIOTECAS_WINDOWS.bat` na primeira vez.
4. Execute `ABRIR_APP_WINDOWS.bat`.
5. O app abre em:

```text
http://localhost:8787
```

## Como usar

1. Abra a aba **Utilização** para ver a função de cada campo.
2. Volte para a aba **Processador**.
3. Selecione ou arraste o PDF.
4. Informe as páginas desejadas, por exemplo:

```text
1-3, 5, 8-10
```

5. Ajuste o modo de extração:
   - **Estrutural inteligente**: melhor para tabelas reais e demonstrativos.
   - **Grade visual por posição**: melhor quando a tabela não tem colunas consistentes, mas o alinhamento visual importa.
6. Clique em **Processar páginas**.
7. Confira a prévia.
8. Exporte em Excel ou ZIP completo.

## Precisão

O app foi desenhado para ser conservador: ele prefere preservar a tabulação e deixar diagnóstico do que “inventar” uma tabela bonita e errada.

Pontos de precisão implementados:

- agrupamento de texto por coordenadas reais do PDF;
- tolerância adaptativa por tamanho de fonte;
- reconstrução de linhas por baseline;
- detecção de colunas por âncoras de alinhamento;
- identificação de linhas de título/cabeçalho;
- mesclagem opcional de títulos longos;
- diagnóstico por página com quantidade de itens, linhas, colunas e avisos;
- exportação de JSON técnico para auditoria.

## Limitações honestas

- PDF escaneado/imagem precisa de OCR. Este app lê PDFs textuais/nativos.
- Cores, bordas e fundos nem sempre ficam disponíveis pela camada textual do PDF. O app preserva a estrutura textual e aplica formatação funcional no Excel.
- PDFs com texto desenhado letra por letra podem exigir ajuste da tolerância de linha/coluna.

## Arquitetura

O código está separado em módulos:

```text
assets/js/
├── config/
├── extraction/
├── export/
├── pdf/
├── ui/
└── utils/
```

Detalhes técnicos em [`ESTRUTURA_TECNICA.md`](./ESTRUTURA_TECNICA.md).
