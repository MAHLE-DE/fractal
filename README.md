# LOOM · Standards Loom

Mapa interativo das normas da BU2: cada norma é uma célula num anel, e cada
citação entre normas é um fio. Mostra o que cada norma exige e quem depende
dela. Interface em inglês, somente leitura.

Dados: 596 normas internas (as 595 vigentes do Valid-Documents de 2026-11-23
mais a W-B-0718, norma final sem código novo), 952 citações internas e as 421
normas públicas/regulatórias citadas (1.513 citações). Fonte: Link-Normas,
rodada 3.

## Abrir

Baixe o repositório inteiro e abra **html-preview/index.html** no Edge ou no
Chrome. Não precisa instalar nada nem de internet: fontes, bibliotecas e dados
já estão no pacote. Requer WebGL2 (qualquer GPU integrada recente).

O executável Windows (.NET WebView2, no padrão do Fractal) é a próxima etapa;
o ícone já está em `assets/app.ico`.

## Usar

- **Pesquisa**: código, nome antigo, código legado, palavras do título ou norma
  pública. Os resultados aparecem enquanto digita; ↑/↓ navegam, Enter ou
  clique seleciona, Esc fecha, `/` vai para a pesquisa.
- **Foco**: ao escolher uma norma, o anel aproxima até mostrar cerca de 10
  normas, com código e título abaixo de cada célula. Dourado = *Requires*
  (o que a norma cita); ciano = *Required by* (quem a cita). O mini-mapa mostra
  o anel inteiro e as ligações da norma em foco.
- **Caixa lateral**: lista as ligações com evidência e páginas. Passar o mouse
  realça o fio; clicar segue para a outra norma.
- **Transição**: com citação direta, a câmera percorre o fio até a outra norma;
  sem citação direta, o anel rola pelo caminho mais curto.
- **Back** (ou Backspace) volta pela cascata percorrida, até a primeira norma.
- **Arrastar** com o botão esquerdo gira a roda; ao soltar, ela desliza com
  inércia. A **roda do mouse** aproxima e afasta. **Overview** ou Esc volta ao
  conjunto. A legenda isola uma categoria.
- **Anel externo**: todas as normas públicas, agrupadas por família (ISO, DIN,
  ASTM, EN, VDA...). Os fios públicos aparecem só para a norma em foco.

## Abrir documentos

*Open PDF* abre o arquivo da norma. Configure a pasta dos documentos em
`html-preview/config.js` (`documentsRoot`: pasta relativa ou URL `file:///`,
com barras `/`). O padrão procura `05_DOCUMENTS` do Link-Normas numa pasta
irmã. Os PDFs não estão incluídos no repositório.

## Desenvolvimento

Node e Python são necessários só na máquina de desenvolvimento:

```
npm ci
python tools/build-data.py --source ../link_normas
npm run build
npm test
```

`npm test` valida os dados, a geometria e um roteiro visual completo no Edge
(1600×1000, rede bloqueada), incluindo FPS mínimo de 55. Capturas em
`docs/media/review/`.

Estrutura: `src/model.ts` monta o anel e a hierarquia; `src/renderer.ts`
desenha células e fios em WebGL2 (spline cúbica com bundling beta 0,85,
calculada na GPU); `src/main.ts` cuida da interface; `tools/build-data.py`
gera `data/cascade-data.json` a partir do Link-Normas.
