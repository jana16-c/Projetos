# Processador de Tabelas de Processos Trabalhistas

Aplicativo local para converter PDFs em planilhas estruturadas, mantendo processamento e exportacao 100% no navegador.

## Arquitetura

- `index.html` + `assets/js/*`: interface local, selecao de paginas, processamento no navegador e exportacao XLSX/XLSM/ZIP.
- `server.py`: servidor estatico simples para abrir o app em `127.0.0.1:8787`.

## Como instalar

```text
BAIXAR_BIBLIOTECAS_WINDOWS.bat
```

Node nao e necessario para executar o aplicativo. Ele permanece apenas para testes e verificacao de sintaxe.

## Como abrir

```text
ABRIR_APP_WINDOWS.bat
```

Ou manualmente:

```text
py -3 server.py
```

## Fluxo

1. Carregue um PDF.
2. Informe as paginas.
3. Se precisar, ajuste `Origem` e `Saida` em `Opcoes avancadas`.
4. Processe.
5. Exporte em `.xlsx`, `.xlsm` ou `.zip`.

## Saidas

- `.xlsx`: abas visuais por pagina, abas editaveis por tabela, `_auditoria`, `_itens_nao_associados` e `_origem`.
- `.xlsm`: reaproveita um modelo com VBA e injeta as tabelas extraidas e auditorias textuais.
- `.zip`: agrupa a planilha, CSVs por tabela e os artefatos de auditoria.

## Testes

```text
npm test
npm run check:syntax
```
