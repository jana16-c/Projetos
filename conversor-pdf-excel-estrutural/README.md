# Conversor PDF → Excel Estrutural

Aplicativo local para converter páginas específicas de PDFs textuais em Excel, preservando tabulação por análise geométrica do PDF.

## Objetivo

Este processador foi feito para casos como processos judiciais, relatórios, demonstrativos, contracheques, guias e PDFs grandes em que você precisa converter apenas algumas páginas para Excel sem perder a estrutura da tabela.

Ele usa:

- **pdf.js** para ler o PDF e acessar as posições reais do texto;
- **Extração estrutural própria** para reconstruir linhas, colunas e blocos tabulares;
- **ExcelJS** para gerar `.xlsx` com formatação;
- **zip.js** para empacotar Excel, CSVs por página e JSON técnico de diagnóstico.

## Como abrir no Windows

1. Extraia a pasta `Projetos`.
2. Entre em `Projetos/conversor-pdf-excel-estrutural`.
3. Dê dois cliques em:

```text
ABRIR_APP_WINDOWS.bat
```

4. O app abre em:

```text
http://localhost:8787
```

## Como usar

1. Selecione ou arraste o PDF.
2. Informe as páginas desejadas, por exemplo:

```text
1-3, 5, 8-10
```

3. Ajuste o modo de extração:
   - **Estrutural inteligente**: melhor para tabelas reais e demonstrativos.
   - **Grade visual por posição**: melhor quando a tabela não tem colunas consistentes, mas o alinhamento visual importa.
4. Clique em **Processar páginas**.
5. Confira a prévia.
6. Exporte em Excel ou ZIP completo.

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
