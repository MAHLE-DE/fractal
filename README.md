# Standards Cascade — prova de desempenho

Abra `html-preview/index.html` no Edge ou Chrome, depois de extrair a pasta.
Funciona diretamente por `file://`, offline, sem servidor, CDN, Node ou instalação.
O snapshot e o GSAP estão embutidos no JS distribuído. Requer navegador com WebGL2.

Escolha uma norma pelo código na caixa superior. O anel aproxima e rola pelo menor
caminho até o foco inferior, sem soltar as fibras. Roda do mouse ajusta o zoom;
Esc/Overview retorna; F mostra FPS. Live motion pode ser desligado e começa
desligado com prefers-reduced-motion.

## Desenvolvimento

Node e Python são usados somente no desenvolvimento:

```
npm ci
python tools/build-data.py --source ../link_normas
npm run build
npx tsc
npm test
```

O teste usa Edge instalado na máquina de desenvolvimento e Playwright. Mede
três modos por cerca de 4,4 segundos cada, após aquecimento, e bloqueia qualquer
requisição de rede. Resultados e capturas ficam em `docs/media/`.

Dados: 595 normas, 943 arestas internas entre vigentes e 1.513 citações públicas/
regulatórias da rodada 3. Evidências, páginas, hierarquia, controles polares e
afinidades estão no snapshot `data/cascade-data.json`. Afinidades são relações
de proximidade, **não citações**; não são desenhadas nesta etapa.

## Decisões da etapa 1

WebGL2 puro foi escolhido em vez de PixiJS v8 ou regl. Ambos oferecem abstrações
úteis; aqui seriam camadas adicionais sobre o mesmo shader instanciado. Curvas
de grau 6 são montadas por de Casteljau na GPU, misturadas com a corda reta com
beta 0,85. Há duas passagens aditivas e 64 segmentos por fibra. Somente uniforms
de tempo, zoom e rotação mudam por quadro; nenhum buffer é refeito na CPU.
O GSAP anima os uniforms do ring roll (0,6–1,4 s). Fases/frequências individuais
e deslocamento angular máximo de 0,0019 rad não permitem inversão entre vizinhas.

A menção a 3.000 fibras no conceito é um orçamento de etapa, não a contagem real:
esta prova usa todas as 943 citações internas disponíveis, sem inventar arestas.
Grupo/tipo vêm do código anterior, como na análise de referência; tipo de produto
é fase 2. O conceito foi copiado com o caminho de checkout substituído por um
placeholder para não versionar informação da máquina de desenvolvimento.

Caixa lateral completa, busca por título/legado/públicas, corrida pelo fio,
introdução, filtros e modos de públicas ficam para etapa 2. Host .NET 10 /
WebView2, ZIP e iniciador ficam para etapa 3, seguindo a distribuição do Fractal.
O Fractal não foi alterado. Nesta etapa a entrega executável é a prévia HTML.

O remoto privado solicitado não pôde ser criado: o GitHub recusou a conta ativa
por falta de permissão para criar em MAHLE-DE. Não houve tentativa alternativa
nem publicação de dados em outro destino. Os commits estão preservados localmente.
