# Processador de Tabelas de Processos Trabalhistas

Aplicativo local para ler paginas especificas de PDFs textuais, separar blocos tabulares, revisar o resultado antes da exportacao e gerar XLSX, XLSM por modelo e ZIP de auditoria sem enviar o PDF para servidores externos.

## Fluxo principal

1. Carregue um PDF textual.
2. Informe as paginas desejadas em formatos como `1-3, 5, 8-10`.
3. Escolha o modo de extracao, margens ignoradas e organizacao do Excel.
4. Processe as paginas.
5. Revise as tabelas detectadas na previa editavel.
6. Exporte em:
   - `.xlsx` como formato padrao;
   - `.xlsm` somente com modelo macro-habilitado valido;
   - `.zip` para auditoria tecnica.

## Recursos implementados

- leitura local com `pdf.js`;
- blocos tabulares por pagina;
- deteccao de repeticao de cabecalho e rodape;
- uniao opcional de continuacao entre paginas consecutivas;
- tipagem conservadora para CPF, CNPJ, matricula, processo, competencia, datas, percentuais e valores monetarios;
- editor em memoria com undo por tabela;
- exportacao `.xlsx` com abas tecnicas `_diagnostico` e `_origem`;
- exportacao `.xlsm` preservando `vbaraw` de um modelo existente;
- pacote ZIP com planilha, CSVs e artefatos de auditoria;
- fallback por CDN para bibliotecas publicas, sem enviar o conteudo do PDF.

## Execucao

```text
BAIXAR_BIBLIOTECAS_WINDOWS.bat
ABRIR_APP_WINDOWS.bat
```

Ou:

```text
npm test
npm run check:syntax
python server.py
```

## Limites desta versao

- processa apenas PDFs com camada de texto;
- nao faz OCR;
- o modo XLSM depende de um modelo real com VBA;
- o editor prioriza correcoes diretas em memoria, sem gravar alteracoes de volta no PDF.
