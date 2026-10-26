# Fractal — testes de motores e copa adaptativa

## Resultado

O motor escolhido é **Canopy**, por silhuetas de ramos com abertura adaptativa. Foi aplicado ao código local em `frontend/js/graph/organic-layout.js`, acompanhado das correções de curvas, seleção e desenho em `workspace-renderer.js`.

O banco `StandardsWorkspaceData1`, seus UUIDs, cadastros, referências, arquivos de configuração e pacotes publicados não foram alterados. Não foi feito commit/push nem substituído o ZIP comercial 0.2.1. Esta etapa entrega código local validado e uma prévia visual isolada para avaliação.

**Entrega posterior solicitada:** a prévia completa foi incluída em `html-preview/`, com o iniciador `Abrir teste HTML.html` na raiz e instruções no README. A pasta operacional `StandardsWorkspaceData1` foi retirada do controle de versão e adicionada ao `.gitignore`, preservando sua cópia local. A prévia contém apenas seu snapshot de leitura, sem backups ou transações. O pacote Windows 0.2.1 permanece o já publicado; o teste novo deve ser aberto pelo HTML.

## Comparação com o banco real

Mesmo snapshot validado pelo backend, mesmo Edge, viewport 1600×1000, profundidade completa e todas as famílias. Resultados da visão **All standards**, com 692 normas únicas e 1.371 aparições visuais:

| Motor | Pares de células sobrepostos | Arestas voltando em direção à raiz | Mudanças de direção acima de 90° | Distância mediana entre células ligadas¹ | Percentil 95 da distância¹ | Reconstrução da tela² |
|---|---:|---:|---:|---:|---:|---:|
| Original 0.2.1 | 1.481 | 116 | 370 | 291 | 568 | 1.902 ms |
| Crescimento com setores fixos | 0 | 0 | 0 | 257 | 720 | 529 ms |
| Crescimento com setores flexíveis | 0 | 0 | 0 | 239 | 657 | 1.094 ms |
| Primeira alternativa por silhuetas | 0 | 0 | 0 | 235 | 600 | 213 ms |
| **Canopy escolhido** | **0** | **0** | **0** | **172** | **418** | **306 ms** |

¹ Unidades do grafo, sem incluir as conexões iniciais da raiz aos documentos de entrada. Aparições repetidas em caminhos distintos continuam sendo consideradas. A distância mediana caiu aproximadamente **41%**, e o percentil 95 caiu **26%**, em relação ao original.

² Tempo de modelo/layout e montagem da interface no computador de desenvolvimento, em uma execução comparativa. Não é uma medição de desempenho do PC comercial. Na aceitação completa, All standards levou 278 ms e Oil filter 268 ms. O ganho observado no cenário completo é aproximadamente seis vezes.

Todos os motores na comparação usam o **renderer atualizado**, inclusive o Original. Portanto os problemas geométricos antigos continuam reproduzidos pelo Original, mas seu clique já recebe a correção de seleção. A reprodução do clique incorreto com o renderer antigo permanece documentada no diagnóstico anterior.

Além desses motores, foram experimentadas variantes intermediárias de abertura e compactação. As alternativas de crescimento célula a célula foram descartadas porque, apesar de não colidirem, ainda produziam uma massa regular em leque, com algumas conexões mais longas que no original. A primeira silhueta preservava os galhos, mas espalhava excessivamente a copa.

## Como o motor escolhido organiza a árvore

- Calcula a quantidade de descendentes antes de distribuir os ramos. Um setor ou galho maior recebe mais espaço.
- Reserva a **silhueta inteira de cada ramo**, incluindo suas células, em vez de repeli-las individualmente. Assim os descendentes não são desmontados por uma força global.
- Usa setores como orientação inicial dos troncos, não como paredes. As extremidades podem ocupar áreas além deles, mantendo espaço livre entre silhuetas.
- Testa pequenas variações de direção e escolhe posições próximas que preservem a orientação de crescimento. Os vetores dos galhos permanecem em um cone voltado para fora; não há retornos abruptos.
- Resolve a distância livre por intervalos de interseção de polígonos, sem simulação de forças ou milhares de passos de relaxamento.
- Encaminha as conexões iniciais por uma guia compartilhada por família, desenhada uma única vez. Essas guias são curvas visuais: **não são novas normas nem citações artificiais**.
- Mantém as normas sem ligação em pequenos conjuntos flutuantes, com a coloração diferenciada existente e sem inventar arestas.
- Mantém MEAS/MNFG em grupos periféricos compactos. O número de colunas acompanha a quantidade de referências, evitando a antiga cauda de duas colunas.
- Preserva integralmente a seleção de raízes por família, os ciclos finitos, as aparições repetidas e o realce de ilhas. `graph-model.js` não foi alterado.

## Seleção, curvas e legibilidade

O clique prioriza a célula cujo círculo contém o cursor, escolhendo a mais próxima proporcionalmente ao seu raio. A tolerância externa é limitada, inclusive no zoom afastado. Foi removida a preferência pela última célula desenhada.

As conexões usam curvas Bézier com tangentes limitadas e progressão radial. Todas as curvas das 36 visões de aceitação foram amostradas em 50 trechos: nenhum recuo radial foi observado.

O enquadramento reserva espaço para o cabeçalho e os controles do mapa. No panorama de centenas de normas, textos que seriam ilegíveis são ocultados; o mouse continua mostrando código/título completos, e o zoom revela os códigos dentro das células. Os códigos longos podem usar duas linhas. Isso evita o ruído dos antigos rótulos de 1–3 pixels sem prometer que 1.371 rótulos possam ser lidos simultaneamente em uma tela.

O cache de rótulos e o descarte de desenhos fora da tela evitam refazer trabalho desnecessário durante zoom/arraste.

## Aceitação executada

- Banco validado novamente pelo repositório C# real sobre **cópia isolada**, sem nenhum PDF. SHA-256 dos arquivos originais conferidos antes/depois, sem diferenças.
- **36 visões**: sete subgrupos, All standards e General standards; para cada um, todas as famílias e TEST/MATL/DSGN individuais.
- Nenhuma norma esperada ausente, nenhuma cobertura nativa perdida e nenhuma ligação esperada omitida nas visões completas.
- Zero sobreposições, zero cliques geométricos no centro retornando outra identidade, zero arestas para dentro e zero inversões acima de 90°.
- Folga mínima entre círculos superior a **10 unidades** nas nove visões completas.
- Maior mudança de direção entre segmentos conectados: aproximadamente **56,6°**, contra aproximadamente **179,4°** no original em All standards.
- Cliques de mouse reais nos antigos casos problemáticos: `ISO 554` em Oil filter e `DIN EN 20187` em All standards abriram os detalhes corretos.
- Arraste, busca, seleção exclusiva de famílias, retorno a All, profundidades 0/2/3, ilhas ligadas/desligadas e realce de aparições associadas passaram.
- Verificação em 1366×768 e 1600×1000, sem overflow horizontal da página.
- Os 15 testes anteriores de modelo/layout, quatro novos testes de geometria e as suítes de prévia e backend/interface passaram. Os novos casos incluem escopo vazio, norma isolada, ramo com 72 filhos, famílias assimétricas, 180 flutuantes, 80 referências periféricas e reordenação dos JSONs.
- Nenhuma exceção JavaScript não tratada ou diálogo nativo de navegador nos testes de aceitação.

Essas medidas tratam de círculos, continuidade radial e seleção; não equivalem a uma prova de ausência de todo cruzamento de linhas em qualquer banco possível. A avaliação estética final continua sendo feita pela prévia visual, incluindo os casos reais de alta ramificação.

## Prévia comparativa entregue

Arquivo local: `artifacts/Fractal-Canopy-Visual-Test.zip`.

Extraia tudo e abra **Abrir teste.html** no Edge ou Chrome. A prévia contém o snapshot validado e os arquivos visuais; não requer executável próprio, Python, Node, .NET, servidor, internet ou PDFs. Não é a migração do produto operacional para navegador: o transporte é somente leitura e não acessa o banco comercial.

O seletor superior permite comparar Canopy, Original, Growth e Envelope no mesmo banco. Nenhum deles salva cadastros. Os metadados reais foram copiados para o snapshot; os caminhos continuam apenas como informação, sem abrir os documentos. A foto não enviada aparece como placeholder.

O ZIP foi aberto como HTML local no teste automatizado, alternando os quatro motores e tentando uma gravação proibida. Não houve requisição externa, erro de página ou alteração de dados.

## Evidências e reprodução

- Backend/cópia imutável: `artifacts/qa/real-data-2026-10-26T15-52-20-200Z/`.
- Comparação dos cinco motores: `artifacts/qa/layout-engines-2026-10-26T15-55-18.932Z/report.json` e capturas correspondentes.
- Aceitação completa: `artifacts/qa/canopy-2026-10-26T15-52-29.353Z/report.json`, nove panoramas, cliques reais e captura em 1366px.
- Prévia portátil validada: `artifacts/layout-preview-2026-10-26T15-59-43.211Z/`.

Para repetir, com as dependências de desenvolvimento disponíveis:

```powershell
node --test tests/graph.test.cjs tests/canopy-layout.test.cjs
$env:BU2_REAL_BROWSER_ONLY='1'
$env:BU2_REAL_BROWSER='0'
node tests/real-data-audit.cjs
node tests/layout-engines.e2e.cjs
node tests/canopy.e2e.cjs
node tests/preview.e2e.cjs
node tests/production.e2e.cjs
node tools/export-layout-preview.cjs
node tests/layout-preview.e2e.cjs
```

Os roteiros de comparação/aceitação aceitam como argumento uma pasta de snapshot validado; sem argumento usam o diagnóstico mais recente. `artifacts/` é ignorado pelo Git. O roteiro `real-data-interaction.cjs` pertence à reprodução histórica do defeito 0.2.1; a aceitação corrigida é `canopy.e2e.cjs`.

Para testar a partir de um clone novo, que não contém a pasta operacional, use `node tests/canopy.e2e.cjs html-preview` e `node tests/layout-preview.e2e.cjs html-preview`. O leitor de snapshots não executa o JavaScript dos dados: extrai e valida o conteúdo JSON. Sem snapshots locais de diagnóstico, a comparação também usa a cópia publicada em `html-preview`.
