# Algoritmo de extração estrutural

## 1. Leitura da camada textual

O pdf.js retorna fragmentos textuais com matriz de transformação. O processador guarda:

- texto limpo;
- coordenadas X/Y;
- largura e altura;
- fonte;
- tamanho aproximado da fonte;
- página de origem.

## 2. Reconstrução de linhas

Fragmentos são ordenados por Y e agrupados por baseline. A tolerância é proporcional ao tamanho mediano de fonte. Isso evita que pequenas diferenças de renderização quebrem uma linha em duas.

## 3. Reconstrução de células

Dentro de cada linha, os fragmentos são ordenados por X. Pequenos espaçamentos são tratados como palavras da mesma célula; grandes espaçamentos indicam separação de célula/coluna.

## 4. Detecção de colunas

O modo estrutural identifica clusters de X que se repetem em várias linhas. Esses clusters viram âncoras de colunas. Depois, cada célula é atribuída à âncora mais próxima.

## 5. Formatação no Excel

O Excel recebe:

- cabeçalhos em azul marinho;
- títulos mesclados quando possível;
- números convertidos para número real;
- alinhamento à direita para valores numéricos;
- quebra de texto;
- autoajuste de largura;
- aba de diagnóstico.

## 6. Diagnóstico

A confiança não é uma garantia matemática. Ela é uma estimativa baseada em quantidade de texto, linhas, colunas e repetição de âncoras.
