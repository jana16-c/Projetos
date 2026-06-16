# Projetos

Repositório de utilitários locais para processamento de documentos e automações.

## Projetos disponíveis

### Conversor PDF → Excel Estrutural

Aplicativo local em HTML/JavaScript para converter páginas específicas de PDFs textuais em Excel, com foco em preservar tabulação e estrutura de tabelas.

Local do app:

```text
conversor-pdf-excel-estrutural/
```

Principais recursos:

- leitura estrutural com **pdf.js**;
- extração por coordenadas reais do PDF, não por simples cópia de texto;
- seleção de páginas, como `1-3, 5, 8-10`;
- modo estrutural inteligente e modo grade visual;
- exportação `.xlsx` com **ExcelJS**;
- exportação de pacote `.zip` com **zip.js**;
- diagnóstico técnico por página para conferência.

## Como abrir no Windows

```text
conversor-pdf-excel-estrutural/ABRIR_APP_WINDOWS.bat
```

O app abrirá em:

```text
http://localhost:8787
```

## Desenvolvimento local

```bash
cd conversor-pdf-excel-estrutural
python server.py
```

Depois acesse `http://localhost:8787`.

## Observação sobre precisão

Este app trabalha com PDFs textuais/nativos. PDFs escaneados ou compostos apenas por imagem precisam de OCR antes da conversão.
