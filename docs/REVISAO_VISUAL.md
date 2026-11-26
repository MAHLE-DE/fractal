# Revisão visual — T19

Roteiro executado no Edge 158, viewport 1600 × 1000, abrindo o pacote por
`file://`, sem servidor. Pedidos externos bloqueados: zero tentativas; erros
de console: zero. As imagens abaixo foram abertas e inspecionadas, assim
como quadros do vídeo. As comparações preservam as capturas originais.

## Resultado por cena

| Arquivo em `media/review/` | Inspeção |
| --- | --- |
| `01-overview.png` | Paleta viva do Atlas, fundo escuro e fibras aditivas visíveis; MEAS-579 se destaca pelo tamanho e halo. PROD e TEST têm rótulos separados. |
| `01-compare.png` | Atlas Feixes à esquerda, nova vista à direita. O Atlas filtra células sem ligação interna; o Cascade mantém as 595, portanto as contagens e a distribuição angular diferem. |
| `02-search-typing.png` | “pleat” mostra resultados sem Enter, com título, código, nome anterior, cor e realce do texto encontrado. |
| `03-search-public.png` | ISO 554 encontra a norma pública e normas que a citam, com grupos identificados. |
| `04-focus-DSGN-347.png` | Trecho inferior próximo, aproximadamente 30 células, códigos radiais legíveis e foco central maior. Requires verde e Required by rosa. |
| `05-sidepanel.png` | Cartão com hierarquia tipográfica; evidência expansível inclui página e cadeia resolvida. |
| `06-hover-fiber.png` | Hover do item destaca a ligação correspondente; não altera a seleção. |
| `07-fiber-run-mid.png` | Pulso dourado e rastro seguem a spline real; afastamento temporário permite ver o trajeto. |
| `08-fiber-run-arrive.png` | Chegada retorna ao zoom próximo, troca o cartão e atualiza a trilha. |
| `09-ring-roll-mid.png` | Rotação conserva o zoom e percorre o caminho angular curto. |
| `10-public-ring.png` | Anel externo fino, com as 40 públicas mais citadas; ligações públicas aparecem no foco. |
| `11-public-mixed.png` | Públicas inseridas como categoria PUB, com transição de posições e fibras presas às células. |
| `12-opening-mid.png` | Categorias surgem progressivamente e as fibras se desenham do centro para as pontas; clique pula a abertura. |
| `13-cut-paths-before-after.png` | Antes/depois completo: curvas deixam de formar pontas artificiais no interior do anel. |
| `14-light-theme.png` | Texto e botão Open PDF mantêm contraste no tema claro; cores das fibras são ajustadas para fundo claro. |
| `16-public-details.png` | ISO 554 mostra 73 normas em Required by, em acordo com o snapshot; lista inclui evidência e página. |
| `15-full-flow.webm` | Abertura → busca digitada → foco → Fiber run → Ring roll → Mixed, em 14,52 segundos. |

A referência original está em `media/ref-atlas-feixes.png`. O arquivo
`review/before.png` preserva o estado da T18. O conjunto usa 595 normas,
943 fibras internas e 1.513 citações públicas/regulatórias; Mixed tem
1.016 células e 2.456 fibras. As cores básicas das fibras vêm de quem cita.
No foco, as não relacionadas ficam em aproximadamente 6% de opacidade.

## Causa das curvas que pareciam cortadas

A T18 usava uma única Bézier de grau 6 com passagem forçada pela raiz,
inclusive entre normas do mesmo grupo. Essa geometria não reproduz
`curveBundle`: formava retornos achatados e pontas no interior que pareciam
interrupções. Não encontrei evidência de perda de arestas ou recorte de
clip-space na visão geral; os controles daquela vista estão dentro da tela.

O renderer agora usa spline cúbica com bundling beta 0,85 sobre o caminho
hierárquico pelo ancestral comum. As 344 ligações do mesmo grupo não são
forçadas pela raiz. Os testes verificam extremos coincidentes com as células
(erro máximo aproximado de 3,14 × 10⁻¹⁶), valores finitos e zero erro WebGL.
A tangente analítica com proteção para comprimento quase zero também evita
uma possível instabilidade numérica; não atribuo o defeito anterior a NaN
sem evidência. A GPU recalcula os controles com os ângulos atuais.

## Acabamentos corrigidos durante a revisão

Fibras apagadas, zoom distante e pesquisa passiva foram substituídos. Corrigi
também contraste do tema claro, contagem de citações na ficha pública e
sobreposição de códigos durante o afastamento do Fiber run: rótulos de
células só entram quando o zoom oferece espaço de leitura. Busca vazia fecha
a lista; ausência de resultado tem mensagem própria. Fontes e licenças OFL
estão no pacote, sem download em tempo de execução.

O painel usa vidro translúcido em gradiente. Blur real fica no painel de
resultados da pesquisa: aplicar backdrop-filter permanentemente sobre o
canvas animado derrubava o FPS na GPU medida. O foco e o hover continuam
visíveis, sem sacrificar a fluidez.

## Desempenho e verificação

Medições reproduzíveis em `media/review/metrics.json`, Edge headless com
GPU física Intel UHD Graphics 610 / ANGLE Direct3D11. O modo headless evita
throttling de janelas ocluídas pelo Windows; o teste rejeita renderização
SwiftShader/llvmpipe. Vídeo é gravado separadamente da medição de FPS.

O renderer usa pré-cálculo de controles na GPU, tangente analítica,
tesselação adaptativa, cache de uniforms e de rótulos; listas não são
reconstruídas a cada quadro. Células e fibras continuam animadas por quadro.

`npm run build`, `npx tsc` e `npm test` verificam snapshot, geometria,
pesquisa, teclado, seleção, evidências, modos públicos, PDF/fallback,
reduced motion e o roteiro visual. O teste exige pelo menos 55 FPS em cada
um dos quatro estados. As medidas finais estão registradas abaixo.

| Estado | FPS | P95 do intervalo entre quadros |
| --- | ---: | ---: |
| Ocioso | 59,49 | 16,8 ms |
| Foco | 60,00 | 16,8 ms |
| Fiber run | 57,32 | 17,2 ms |
| Ring roll | 58,01 | 16,8 ms |

Zero erros de console/WebGL e zero pedidos externos na execução final.

## Limites que permanecem

- Desempenho foi medido nesta GPU; ainda não foi medido no PC antigo.
- Mixed reúne 421 públicas e é denso por natureza. A visão geral mostra
  categorias; códigos ficam legíveis no foco e nas listas, não todos de uma vez.
- Open PDF teve URL relativa e fallback de cópia verificados. Não há a pasta
  operacional de documentos neste ambiente para confirmar a abertura dos
  arquivos reais; o navegador pode bloquear URLs locais. O host nativo é etapa 3.
- Sem ligação direta, a navegação informa e usa Ring roll; não fabrica uma
  fibra. Afinidades estão marcadas como “not a citation”.
- Esta inspeção documenta o resultado observado; não substitui a aprovação
  estética do usuário. Nada foi publicado no remoto nesta etapa.

## T20 — WIP interrompido por instrução do usuário

A T20 foi interrompida antes da validação final. O relatório e as métricas
acima descrevem a T19. As capturas 17–22 são registros parciais da T20,
não uma aprovação visual final. O build do WIP foi verificado.

Implementado: mini-mapa de foco de 220 px; destinos fora da tela agrupados
na borda; saídas dourado-claro e entradas ciano; legenda junto ao foco;
hover com fibra mais grossa/pulso, halo e código em negrito no destino;
destino marcado desde o início do Ring roll; públicas ocultas no Overview
Ring; afastamento dos rótulos TEST/W; área de desenho reservada ao painel.
O mini-mapa usa cache de curvas e atualiza a 15 Hz; a cena principal segue RAF.

Pendente: concluir a revisão de todas as cenas e a medição final ≥ 55 FPS.
Rodadas anteriores ficaram abaixo do limiar no ocioso, mesmo com foco e
transições próximos de 60 FPS. Foi identificada e corrigida a interrupção
da troca Mixed→Ring ao abrir Overview, mas essa correção final ainda não
teve o roteiro completo reexecutado. O teste passou a exigir estado Ring
assentado antes de medir. A tentativa de resolução reduzida foi retirada;
o canvas mantém a resolução normal.

A faixa de destinos é densa para normas muito conectadas; os rótulos são
localizadores agrupados, sem linhas de chamada até cada ponto de saída.
As capturas intermediárias pausam a timeline apenas para fotografar o meio
da transição. Capturas/vídeo/métricas anteriores da T19 foram preservados,
em vez de substituídos por uma rodada parcial ou reprovada da T20.
