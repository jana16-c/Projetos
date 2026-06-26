# Processador de Tabelas de Processos Trabalhistas

Aplicativo local para converter PDFs em planilhas estruturadas, com modo textual, OCR opcional e exportacao visual mais fiel quando a rota backend esta ativa.

## Arquitetura

- `index.html` + `assets/js/*`: interface local, selecao de paginas, disparo do processamento e exportacao XLSX/XLSM/ZIP.
- `backend/src/*`: backend Fastify que recebe o PDF, cria jobs, executa OCR quando necessario e devolve `document-result` e `table-ir`.
- `ocr/*`: sidecar Python local para renderizacao de pagina, OCR Tesseract, deteccao de grade e estilos visuais.

## Como instalar

### Frontend local

```text
BAIXAR_BIBLIOTECAS_WINDOWS.bat
```

### Backend Node

```text
cd backend
npm install
```

### OCR local

Opcional, mas necessario para `Origem = Hibrido` ou `Origem = OCR`.

```text
INSTALAR_OCR_WINDOWS.bat
```

Tambem e necessario ter o Tesseract OCR instalado no Windows e acessivel no `PATH`.

## Como abrir

```text
ABRIR_APP_WINDOWS.bat
```

Ou manualmente:

```text
npm run start
```

Aplicacao:

```text
http://127.0.0.1:8787
```

## Fluxo

1. Carregue um PDF.
2. Informe as paginas.
3. Se precisar, ajuste `Origem` e `Saida` em `Opcoes avancadas`.
4. Processe.
5. Exporte em `.xlsx`, `.xlsm` ou `.zip`.

## Saidas

- `.xlsx`: uma aba por tabela, mantendo larguras, alturas, mesclagens e estilos quando disponiveis.
- `.xlsm`: reaproveita um modelo com VBA e injeta as tabelas extraidas.
- `.zip`: agrupa a planilha, CSVs por tabela e os artefatos de auditoria.

As planilhas tecnicas incluem:

- `_ocr_auditoria`: por pagina, mostrando se houve texto PDF, OCR aplicado e avisos.
- `_origem`: itens textuais de origem usados na reconciliacao.

## Testes

```text
npm test
npm run check:syntax
python -m pytest ocr/tests -q
```
