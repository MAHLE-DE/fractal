# Prova de desempenho — etapa 1

Edge 158.0.4370.33, 1600 × 1000, aceleração ANGLE Direct3D11 em Intel UHD 610.
Sessão com janela visível, prévia aberta por file://, todas as requisições
externas bloqueadas pelo Playwright. Aquecimento de três segundos; janelas
de aproximadamente 4,4 segundos por estado. Movimento vivo ligado.

| Estado | FPS médio | p95 do intervalo entre quadros |
|---|---:|---:|
| Ocioso | 60,00 | 16,8 ms |
| Ring roll, quatro destinos | 60,00 | 16,8 ms |
| Zoom 2,6× | 57,25 | 17,0 ms |

O resultado bruto está em media/benchmark.json. Não houve erros JavaScript.
O padrão de prefers-reduced-motion foi testado por recarga com a preferência
emulada: Live motion iniciou desligado. Três capturas foram inspecionadas:
media/idle.png, media/roll.png e media/zoom.png. media/ring-roll.gif mostra
a transição e o estado vivo (35 quadros reduzidos para 960 × 600).

FPS vem dos intervalos requestAnimationFrame e inclui trabalho da interface;
não é tempo de execução isolado do shader. Capturas/GIF ocorrem fora da janela
de medição. O refresh do monitor limita o resultado perto de 60 FPS. Esta
medição não substitui o teste no PC de destino nem mede a pior GPU possível.

## Arquitetura

595 pontos e 943 instâncias de curva. Os controles polares são calculados no
snapshot por categoria/grupo. O vertex shader avalia a curva e a tangente,
extruda uma faixa, soma a oscilação de cada extremidade e aplica rotação/zoom.
O fragment shader adiciona respiração e pulsos em um subconjunto determinístico
das fibras. Não há atualização de vértices/controles pela CPU durante o loop.

PixiJS v8 ofereceria cena/filtros e regl facilitaria o estado WebGL; nesta
prova há apenas dois programas e três chamadas de desenho por quadro. WebGL2
puro evita adaptar essas abstrações à geometria específica, sem sugerir que
uma comparação A/B de velocidade entre bibliotecas tenha sido feita.
