# Projetos

Repositório de utilitários locais para processamento de documentos, extração de dados e automações.

## Processador de Tabelas de Processos Trabalhistas

Aplicação em HTML e JavaScript para converter dados estruturados de PDFs em tabelas Excel, com foco em velocidade, confiabilidade e rastreabilidade.

Local:

```text
conversor-pdf-excel-estrutural/
```

Principais recursos:

- leitura estrutural com `pdf.js`;
- seleção de páginas;
- modos texto, OCR, híbrido e automático;
- reconstrução de linhas, colunas e blocos;
- continuação de tabelas entre páginas;
- exportação XLSX, XLSM e ZIP;
- auditoria de itens ausentes, duplicados ou não associados.

## Como executar

### Durante o desenvolvimento

1. Abra a pasta no VS Code.
2. Abra `conversor-pdf-excel-estrutural/index.html`.
3. Execute com **Live Preview**.

Não é necessário fazer o build durante os testes no VS Code.

### Uso final

1. Execute o build do processador.
2. Abra diretamente no navegador o HTML consolidado gerado.

O uso final não depende de `server.py`, servidor Python ou `ABRIR_APP_WINDOWS.bat`.

O comando e o destino do build serão padronizados conforme o plano de implementação. O nome e o caminho do HTML consolidado já utilizado devem ser preservados.

## Desenvolvimento

```bash
cd conversor-pdf-excel-estrutural
npm test
npm run check:syntax
```

## Documentação

- [`README do processador`](./conversor-pdf-excel-estrutural/README.md)
- [`Arquitetura, precisão e desempenho`](./conversor-pdf-excel-estrutural/docs/ARQUITETURA_E_PRECISAO.md)
- [`Plano incremental para implementação pelo Codex`](./conversor-pdf-excel-estrutural/docs/PLANO_IMPLEMENTACAO_CODEX.md)

## Direção técnica

A evolução deve preservar o comportamento atual por padrão e acrescentar recursos de maneira incremental:

1. build do HTML consolidado;
2. opção de todas as tabelas em uma única aba;
3. caminho rápido para PDF textual confiável;
4. OCR somente quando necessário;
5. reconstrução por limites e alinhamentos;
6. detecção visual de grades;
7. validação por esquema e confiança.