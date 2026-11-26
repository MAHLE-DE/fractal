# Standards Cascade

T20 interrompida a pedido do usuário: ajustes de foco estão em WIP.
O build foi verificado; a validação visual e de desempenho final da T20
não foi concluída. Veja a nota no fim de `docs/REVISAO_VISUAL.md`.

Explore o que cada norma exige e quem depende dela. Interface em inglês,
somente leitura, com as 595 normas vigentes do snapshot do Link-Normas.

Extraia a pasta inteira e abra **html-preview/index.html** no Edge ou Chrome.
Não requer servidor, CDN, Node, Python ou instalação no computador de destino.
Fontes, bibliotecas e dados já estão no pacote. Requer WebGL2 com suporte a
render target float (`EXT_color_buffer_float`), disponível na GPU medida.

## Usar a prévia

- Digite na pesquisa: código, nome anterior, legado, palavras do título ou uma
  norma pública. Os resultados aparecem enquanto digita. ↑/↓ navegam, clique
  ou Enter selecionam, Esc fecha, `/` leva à pesquisa.
- Ao focar, o anel aproxima até o trecho inferior mostrar cerca de 30 células
  com rótulos radiais. Dourado-claro indica Requires; ciano indica Required by.
  Um mini-mapa de 220 px mantém o anel inteiro e as ligações do foco visíveis.
  Destinos fora da tela aparecem na faixa de borda, com cor da categoria;
  passar o mouse destaca a fibra, o destino e o respectivo rótulo.
- **Fiber run** percorre uma citação real com pulso e rastro: abre brevemente
  o enquadramento para enxergar o percurso e retorna ao foco na chegada.
  **Ring roll** mantém o zoom e gira pelo menor caminho. Sem citação direta,
  a navegação usa Ring roll e informa isso, sem inventar uma fibra.
- As listas laterais mostram evidência, página e a cadeia resolvida quando
  houve código legado. Passe o mouse para realçar a fibra e clique para seguir.
  A trilha superior permite voltar.
- **Public Ring** usa as 40 públicas mais citadas num anel externo. **Mixed**
  insere todas as 421 públicas/regulatórias do snapshot na categoria PUB.
  As fibras públicas aparecem apenas no foco em Ring.
- Roda do mouse aproxima/afasta. Esc ou Overview volta ao conjunto.
  A legenda isola categorias. Há tema claro, abertura pulável, movimento vivo
  opcional e medidor de FPS pela tecla F. Reduced motion inicia o movimento
  vivo desligado. Afinidades são explicitamente **not a citation**.

## Abrir documentos

Edite `html-preview/config.js`: `documentsRoot` aceita uma pasta relativa
ou uma URL `file:///` para a pasta dos documentos, com barras `/`.
O padrão procura o Link-Normas numa pasta irmã. PDFs/DOCX não estão incluídos.
Open PDF solicita a abertura e disponibiliza o caminho para copiar caso o
navegador bloqueie o arquivo. A integração nativa será feita no host da etapa 3.

## Desenvolvimento e verificação

Node e Python são necessários somente na máquina de desenvolvimento:

```
npm ci
python tools/build-data.py --source ../link_normas
npm run build
npx tsc
npm test
python tools/review-images.py
```

O último comando exige Pillow (`pip install Pillow`) e apenas monta as
comparações das capturas, preservando os originais. O teste de vídeo usa
Playwright/FFmpeg no desenvolvimento (`npx playwright install ffmpeg`).

`npm test` valida o snapshot, a geometria e o roteiro visual completo no Edge
1600×1000 por `file://`, com rede bloqueada. O teste usa Edge headless com
GPU Intel real, sem SwiftShader, para eliminar o throttling de janelas
ocluídas do Windows. Capturas e vídeo ficam em `docs/media/review/`.
Veja `docs/REVISAO_VISUAL.md` para a inspeção e os resultados medidos.

Dados publicados: 595 normas, 943 citações internas entre vigentes e 1.513
citações públicas/regulatórias. Fonte: rodada 3, commit 2ced4c1 do Link-Normas;
Valid-Documents de 2026-11-23. O snapshot preserva códigos brutos, evidências,
páginas, status das cadeias, metadados e afinidades. Não acessa a base operacional
em tempo de execução nem modifica documentos ou cadastros.

`src/model.ts` monta as duas hierarquias uma vez. O renderer usa spline cúbica
com bundling beta 0,85 e caminho pelo ancestral comum. GPU calcula controles,
curvas, tangentes, brilho e pulsos; células/fibras acompanham todos os quadros.
Rótulos são rasterizados em cache e atualizam continuamente durante transições;
no estado estável, acompanham a oscilação lenta a 15 Hz. A tesselação usa 48
segmentos no conjunto, 32 na corrida e 24 no foco ampliado.

A distribuição .NET 10/WinForms/WebView2, ZIP com SHA-256 e iniciador é a etapa 3.
O Fractal foi usado apenas como referência e não foi alterado. O remoto privado
continua pendente de permissão do usuário; esta etapa foi feita somente local,
sem push. O relatório anterior `docs/DESEMPENHO.md` descreve a T18 histórica;
as medições atuais estão em `docs/media/review/metrics.json`.
