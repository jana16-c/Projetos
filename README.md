# Projetos

Repositório de utilitários locais para processamento de documentos, extração de dados e automações.

## Projetos disponíveis

### Processador de Tabelas de Processos Trabalhistas

Aplicativo local em HTML e JavaScript para converter dados estruturados de PDFs em tabelas Excel, com foco em velocidade, confiabilidade e rastreabilidade do resultado.

Local do projeto:

```text
conversor-pdf-excel-estrutural/
```

Principais recursos:

- leitura estrutural com **pdf.js**;
- extração por coordenadas da camada textual;
- seleção de páginas e intervalos;
- modos texto, OCR, híbrido e automático;
- reconstrução de linhas, colunas e blocos tabulares;
- continuação de tabelas entre páginas;
- exportação `.xlsx` com **ExcelJS**;
- exportação `.xlsm` baseada em modelo com **SheetJS**;
- pacote `.zip` com CSVs e diagnóstico técnico;
- auditoria de itens associados, não associados, ausentes ou duplicados.

Documentação:

- [`README do processador`](./conversor-pdf-excel-estrutural/README.md)
- [`Arquitetura, precisão e desempenho`](./conversor-pdf-excel-estrutural/docs/ARQUITETURA_E_PRECISAO.md)

## Como abrir no Windows

Na primeira utilização, para instalar as bibliotecas locais:

```text
conversor-pdf-excel-estrutural/BAIXAR_BIBLIOTECAS_WINDOWS.bat
```

Para iniciar o aplicativo:

```text
conversor-pdf-excel-estrutural/ABRIR_APP_WINDOWS.bat
```

O aplicativo abrirá em:

```text
http://127.0.0.1:8787
```

## Desenvolvimento local

```bash
cd conversor-pdf-excel-estrutural
npm test
npm run check:syntax
python server.py
```

## Observação sobre precisão

O processador combina extração textual, OCR opcional, reconstrução geométrica e validação de conservação de conteúdo. Como PDFs descrevem a aparência da página e nem sempre preservam a estrutura lógica da tabela, resultados de baixa confiança devem ser sinalizados para revisão em vez de tratados como automaticamente corretos.