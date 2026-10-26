# Diagnóstico do Fractal 0.2.1 com banco real — 26/10/2026

Este documento registra o diagnóstico anterior à correção. A etapa seguinte de testes de motores e alterações locais está em [testes-motores-copa-2026-10-26.md](testes-motores-copa-2026-10-26.md).

## Conclusão

**A integridade estrutural do banco passou, mas a visualização e a seleção de normas não estão adequadas para esse volume real.** Os principais defeitos são sobreposição de células, mistura geométrica dos setores e seleção de uma norma diferente da clicada. A falta dos PDFs não é a causa.

Nenhuma correção foi aplicada ao código de produção. O banco enviado não foi alterado. Não foi gerada/publicada uma nova versão.

## Ambiente e preservação

- Repositório sincronizado por fast-forward até `f808ec6`, que contém `StandardsWorkspaceData1`.
- Fonte: `C:\PC\site\fractal\StandardsWorkspaceData1`.
- Testes sobre cópias novas em `artifacts/qa/real-data-*`; hashes SHA-256 dos arquivos originais conferidos antes/depois, sem diferenças.
- Backend C# real validou o banco. A interface real foi carregada no Edge/Playwright, com transporte de teste somente leitura. Gravação e abertura de documentos foram proibidas nesse transporte.
- Os 523 caminhos de documentos foram preservados nos metadados, mas nenhum PDF corporativo foi necessário ou aberto. Não foi desativada a validação de produção.
- Capturas em 1600×1000 e 1366×768; resultados medidos no computador de desenvolvimento, não na rede/PC comercial.

## Banco recebido

| Item | Quantidade |
|---|---:|
| Normas | 692 |
| Internas / internacionais | 523 / 169 |
| Subgrupos | 7 |
| Ligações entre normas | 558 |
| Normas gerais | 293 |
| Normas sem nenhuma ligação de entrada ou saída | 345 |
| TEST / MATL / DSGN / MEAS / MNFG | 284 / 167 / 201 / 4 / 36 |

Não foram encontrados códigos duplicados, pares de ligação duplicados, autorreferências diretas, UUIDs de destino/origem inexistentes ou divergências entre família interna e `tree_entry.family`. A validação efetiva de `WorkspaceRepository` também passou.

Há um ciclo entre `MNFG-468` e `MNFG-488`. O aplicativo interrompe corretamente a expansão no retorno; não houve recursão infinita. Isso é permitido pelo modelo e não explica o congestionamento geral. A veracidade técnica das citações não foi auditada, pois os documentos não foram fornecidos.

## Cobertura e comportamento funcional

Foram avaliadas 36 combinações: os sete subgrupos, All standards e General standards, cada um com todas as famílias e com TEST/MATL/DSGN isoladas. A profundidade foi aberta por completo; o maior caminho encontrado chegou ao nível 6.

- Todas as normas previstas pelo escopo aparecem no modelo nas nove visões completas.
- Todas as ligações esperadas nesses escopos têm representação; não houve corte pelo orçamento de repetição.
- A cobertura nativa de TEST, MATL e DSGN foi preservada: nenhum setor foi logicamente eliminado por citações cruzadas.
- Seletores de família/All, pesquisa, arraste e limites de profundidade 2/3 funcionaram nos testes adicionais de Oil filter e All standards.
- O realce de ilhas funcionou: selecionar `MEAS-509` realçou suas seis aparições no grafo.
- Não houve erro JavaScript não tratado nos testes automatizados.

Os 15 testes de regressão existentes também passaram. Isso não constitui aprovação da usabilidade: o conjunto real revelou problemas que as fixtures menores não capturavam.

## Defeitos reproduzidos no navegador

### P1 — Sobreposição e setores visualmente misturados

Contagem de **pares de círculos que se sobrepõem**, não de normas distintas:

| Visão completa | Normas únicas | Aparições visuais | Pares sobrepostos |
|---|---:|---:|---:|
| Oil filter | 572 | 1.172 | 1.084 |
| All standards | 692 | 1.371 | 1.481 |

Em All standards, 400 pares sobrepostos envolvem setores diferentes. Portanto, as famílias estão preservadas nos dados, mas sua separação visual não está preservada pelo posicionamento final.

As medidas do navegador são as de referência. A análise separada em Node/VM encontrou números ligeiramente diferentes devido ao ambiente numérico/execução, mas reproduziu o mesmo defeito em todas as visões completas.

### P1 — O clique pode abrir a norma errada, mesmo com zoom

Dois cliques de mouse reais, com zoom de 120%, confirmaram:

| Centro da célula clicada | Detalhes realmente abertos |
|---|---|
| ISO 554, em Oil filter | TEST-183 |
| DIN EN 20187, em All standards | DIN EN ISO 9073-2 |

No teste geométrico de centros de todas as células em All standards, 600 de 1.371 apontavam para outra identidade no enquadramento inicial. Ainda havia 116 casos a 100% e 72 a 280%. Isso não significa que toda área de cada uma dessas células seja inacessível, mas demonstra que aumentar o zoom, sozinho, não resolve todas as ambiguidades.

`CanvasRenderer.pick()` escolhe a última célula atingida na ordem de desenho, não a mais próxima do cursor. Sua tolerância cresce no espaço do grafo quando o zoom diminui. A combinação desse comportamento com as sobreposições gera a seleção incorreta.

### P2 — Enquadramento torna os rótulos ilegíveis

Em All standards, a visão inicial usou aproximadamente 20,7% de zoom em 1600×1000. O tamanho mediano calculado do texto das células foi cerca de 1,28 pixel; todos os rótulos ficaram abaixo de 6 pixels. Em Oil filter, a mediana ficou em cerca de 1,51 pixel.

As ilhas MNFG usam duas colunas fixas. Com 36 normas, formam uma cauda vertical comprida. As centenas de normas flutuantes também se estendem em faixas longas. O Fit inclui essas extensões e reduz demais o conjunto.

Desligar ilhas melhora parcialmente o enquadramento, mas não resolve: All standards foi de aproximadamente 20,7% para 29,3%. Limitar profundidade também não resolve a extensão das normas flutuantes.

### P2 — Layout bloqueia a interface durante o recálculo

No navegador, reconstruir a visão completa levou aproximadamente 1,3–1,6 segundo em Oil filter e 1,8–2,0 segundos em All standards, em execuções desta análise. O cálculo acontece no thread da interface. Dez redesenhos de zoom somaram cerca de 309 ms em uma medição; não é uma garantia de desempenho no PC comercial.

O carregamento JSON aquecido do backend ficou em aproximadamente 144–170 ms. Portanto, o gargalo visual principal observado não foi a ausência dos documentos nem a leitura de seus conteúdos.

## Causas no layout atual

Arquivo principal: `frontend/js/graph/organic-layout.js`.

1. Todas as entradas nativas de uma família começam aproximadamente na mesma distância fixa da raiz (`181`), mesmo quando há dezenas delas.
2. A faixa angular é dividida igualmente entre entradas, sem reservar mais espaço para uma entrada com muitos descendentes.
3. Galhos convergem para uma região de alcance fixo (`550`), e o comprimento diminui por nível. Muitos descendentes se concentram na mesma área.
4. O relaxamento encerra depois de 180 iterações, mesmo se ainda houver colisões. Não há uma pós-condição que impeça entregar um resultado sobreposto.
5. Normas sem ligação e ilhas usam distribuições fixas que alongam a figura e prejudicam o enquadramento.

Exemplos reais de alta ramificação: `MATL-568` tem 42 citações diretas e `DSGN-348` tem 40. Esse volume não cabe adequadamente nas mesmas faixas usadas pela prévia pequena.

## Dados que aumentam a densidade, sem serem necessariamente erros

- As 293 normas marcadas como gerais entram em todos os subgrupos. Isso é a regra configurada, não um defeito na filtragem. Convém confirmar se todas deveriam realmente ser gerais; nenhuma foi reclassificada neste teste.
- As 345 normas sem relações precisam continuar visíveis, mas sua distribuição visual atual não é adequada.
- Repetir a mesma norma em caminhos distintos é intencional. `TEST-278`, por exemplo, aparece 50 vezes na visão completa. Não são 50 cadastros duplicados.
- O conjunto atual exige 108 entradas conectadas na minimização por família em All standards. Não é correto reduzir esse número arbitrariamente omitindo normas ou inventando citações. Uma raiz visual mais fina precisa de uma solução de apresentação/agrupamento que preserve a semântica.
- Uma foto de subgrupo é referenciada, mas sua imagem não veio no banco enviado. A falha visual da foto era esperada e não impede o teste do grafo.

## Próxima correção recomendada — ainda não implementada

1. Reestruturar o posicionamento com espaço adaptativo por subárvore, alta ramificação e limites reais de cada setor; a separação TEST/MATL/DSGN deve continuar garantida.
2. Tratar ausência de sobreposição e seleção inequívoca como critérios de aceite, validando com este banco de 692 normas e não apenas com fixtures pequenas.
3. Corrigir a seleção do alvo do clique e a tolerância por zoom, além de corrigir o layout. Só escolher a célula mais próxima não elimina o problema visual.
4. Tornar o posicionamento de normas flutuantes e ilhas adaptativo/compacto; avaliar expansão progressiva e agrupamento puramente visual sem criar citações artificiais.
5. Rever legibilidade por escala e evitar que um conjunto periférico determine sozinho o enquadramento de toda a árvore.
6. Separar os cálculos mais caros do thread de interação e limitar redesenhos desnecessários.

## Evidências e reprodução local

Evidências não publicadas, disponíveis apenas nesta máquina:

- Métricas completas Node/VM: `artifacts/qa/real-data-2026-10-26T14-25-38-914Z/report.json`.
- Métricas do navegador, snapshot validado e 37 capturas: `artifacts/qa/real-data-2026-10-26T14-28-51-836Z/`.
- Cliques reais, contagem de colisões no navegador e testes de interação: `interaction.json` na segunda pasta.
- `29-all-all.png`: All standards em 1600×1000.
- `38-wrong-selection-at-120-percent.png`: seleção incorreta em Oil filter.
- `40-matl-568-high-degree.png`: referência com 42 descendentes diretos.

Roteiros locais adicionados para a análise: `tests/real-data-audit.cjs` e `tests/real-data-interaction.cjs`. Eles não alteram o código de produção. Não foi feito commit/push dos roteiros nem do relatório.
