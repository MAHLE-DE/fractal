# Standards Cascade — Especificação do conceito v0.1 (para aprovação)

Nome provisório. A interface é em inglês e a documentação em português.

## 1. Propósito
App somente leitura para explorar a cascata de citações entre as normas vigentes, com base no resultado da última rodada do `link_normas`. A pergunta central que ele responde: **"o que esta norma exige, e quem depende dela?"**. A primeira impressão deve encantar; o uso diário deve ser rápido.

## 2. Dados (entrada)
- `resultado_05_DOCUMENTS.json` (correlações, descartes, ignorados, avisos), vindo do `link_normas/10_EXTRATOR/saida/`.
- `cadastro_canonico_v3_SEM_URL_SHAREPOINT.json`: títulos, nome anterior, idioma e arquivo local.
- `mapa_base/mapa_normas_v1.json` (ou o versionado): status das cadeias e afinidades.
- Um script de build no repositório do app converte esses arquivos num **pacote de dados do app** (`data/cascade-data.json`), com feixes e posições pré-calculados. O app não lê o banco bruto em tempo de execução.
- PDFs: abertos a partir da pasta `05_DOCUMENTS`, configurada no `config/appsettings.json`.
- Tipo de produto: **fase 2**, depois de a planilha Valid-Documents original chegar.

## 3. Tela e composição
- Tela cheia, fundo escuro profundo como padrão (também há tema claro).
- **Anel de feixes** no centro: 595 normas no anel, agrupadas por **categoria → grupo de produto do código antigo → norma**. Cada citação é uma fibra curva que passa pelo interior do anel (edge bundling hierárquico).
- **Canto superior esquerdo:** a data do Valid-Documents usado (ex.: `Valid-Documents · 2026-11-23`), pequena e discreta, sem destaque. Ela vem do campo `sources.valid_documents` do cadastro.
- **Topo:** barra de pesquisa e trilha de navegação (breadcrumb).
- **Canto superior direito:** chave das normas públicas (Ring / Mixed), chave Afinidades e tema.
- **Canto inferior esquerdo:** legenda de categorias, clicável para isolar uma categoria.
- **Lateral direita:** caixa de detalhes, que aparece quando há uma norma em foco.

## 4. Estados e animações (roteiro)

### 4.1 Abertura (≈ 3 s, com opção de pular)
1. Os pontos das normas surgem em sequência ao redor do anel, categoria por categoria.
2. As fibras se desenham do centro para fora, formando os cabos.
3. Ao terminar, entra o estado ocioso: os cabos "respiram", com brilho variando levemente, e pulsos de luz percorrem aleatoriamente os fluxos maiores (MATL → MEAS-579 e o núcleo do DSGN).

### 4.2 Pesquisa
- Uma caixa única. Encontra por código atual, nome anterior, legado (WNA/WNF/…), palavras do título (inglês e alemão) e normas públicas (ex.: "ISO 554", que lista quem a cita).
- Os resultados aparecem em lista, com teclado (↑ ↓ Enter). Cada item mostra o código, o título e a categoria.

### 4.3 Foco ("o anel vem até a tela")
- O anel **cresce em direção à tela e gira**, até a célula escolhida chegar à **parte inferior central**, grande. Quem se move é o anel, não a câmera.
- As vizinhas no trecho ampliado ganham rótulo legível.
- As fibras da norma acendem, com cores diferentes para "exige" (saída) e "depende dela" (entrada). As demais fibras ficam em ≈ 6% de opacidade.
- Duração ≈ 900 ms, com easing suave.

### 4.4 Caixa lateral (dinâmica)
- **Cartão:** código, título, nome anterior, categoria, idioma, link **Open PDF**.
- **Requires (N):** normas citadas, agrupadas por categoria. Cada item tem o trecho da citação e a página (vindos do extrator) e o status da cadeia quando o código citado era legado.
- **Required by (N):** quem cita esta norma.
- **Public standards (N):** normas ISO/DIN/EN… citadas.
- **Affinities:** aparece só nas normas sem citação, com o aviso "not a citation".
- Passar o mouse sobre um item acende a fibra correspondente no anel.

### 4.5 Corrida pelo fio
- Ao clicar numa ramificação, um pulso de luz sai da célula atual e percorre a curva do feixe até a célula destino (≈ 1,2 s).
- Ao mesmo tempo, o anel gira para trazer o destino à posição de foco, embaixo.
- Na chegada, um pequeno flash; a caixa lateral troca de conteúdo; a trilha ganha um elo: `DSGN-347 → DSGN-348 → MEAS-509`.
- Clicar num elo da trilha faz a corrida de volta.

### 4.5b Rolagem no anel (segundo modo de troca entre normas)
- Uma chave **Transition: Fiber run / Ring roll** escolhe como a troca acontece.
- **Ring roll:** o zoom NÃO sai. As células **rolam ao longo do anel** pelo sentido de menor caminho angular (horário ou anti-horário, o que for mais curto) até a norma destino chegar à posição de foco, embaixo.
- Durante o movimento, **as conexões acompanham as células** a cada quadro: as fibras continuam presas às suas células enquanto o anel gira. Duração proporcional ao ângulo (≈ 0,6–1,4 s), com easing suave.
- O pulso de luz é opcional neste modo; o protagonista é o movimento do anel.

### 4.5c Movimento vivo (sempre ligado, com opção de desligar)
- O app nunca fica parado. Cada célula oscila **muito pouco** ao longo do anel, para a esquerda e a direita, de forma muito suave e com fase e frequência próprias, como átomos presos num campo. A amplitude é uma fração do espaço entre células vizinhas, sem nunca trocar de lugar.
- As fibras acompanham esse movimento continuamente, porque os pontos finais das curvas seguem as células.
- Também em foco e durante as transições, somado ao movimento principal.
- Chave **Live motion: on/off** no canto, para comparar. Com `prefers-reduced-motion`, começa desligada.

### 4.6 Normas públicas (dois modos, para você decidir vendo)
- **Ring:** um anel externo fino com as normas públicas mais citadas. As fibras até elas só aparecem quando há foco.
- **Mixed:** as normas públicas entram no anel principal como uma categoria a mais.
- A troca entre os modos é animada: o anel se reorganiza.

### 4.7 Saída do foco
- Esc ou clique no vazio: o anel volta ao tamanho original e ao estado ocioso.

## 5. Tecnologia (proposta)
- **Desenho:** WebGL2. Cada fibra é definida pelos ângulos das suas duas células mais os pontos de controle do feixe, e o shader monta a curva a cada quadro a partir dos ângulos atuais. É isso que permite que rolagem e movimento vivo arrastem as fibras sem recalcular nada na CPU. A geometria é instanciada, brilho por mistura aditiva e pulsos animados no shader. Biblioteca prevista: **PixiJS v8** ou **regl**, a decidir no protótipo de desempenho.
- **Animações:** **GSAP**, para as linhas do tempo e o easing da abertura, do foco e da corrida.
- **Código:** TypeScript, empacotado com **Vite** num conjunto de arquivos estáticos. No PC de destino não há Node, nem build, nem instalação.
- **Distribuição (mesmo modelo do Fractal):**
  - um **host Windows .NET 10 + WebView2 self-contained**, com o ícone `app.ico` do Fractal, gerado como ZIP com SHA-256 e um iniciador `Abrir Standards Cascade.cmd`;
  - uma **prévia HTML offline** (`html-preview/`), que abre direto no Edge ou no Chrome;
  - tudo já vem na pasta `dist/` do repositório: bibliotecas JS empacotadas e .NET self-contained.
- **Requisito de máquina:** Windows x64 com **WebView2 Runtime**. Ele já vem com o Windows 10/11 e é o mesmo requisito do Fractal. A prévia HTML não tem nem esse requisito.

## 6. Desempenho (critérios de aceite)
- 60 fps no estado ocioso e nas transições, num notebook comum com GPU integrada, e ≥ 30 fps no pior caso no PC antigo.
- Abertura pronta em menos de 2 s depois de os dados carregarem.
- Pesquisa responde em menos de 50 ms.

## 7. Fora do escopo do conceito (fases seguintes)
- Filtro por tipo de produto (fase 2, com a planilha Valid-Documents).
- Edição de dados: o app só lê.
- Ampulheta e rio em níveis como vistas auxiliares, a avaliar depois.

## 8. Repositório e etapas
- Repositório novo **`MAHLE-DE/standards-cascade`** (privado), com cópia local em `<pasta-local>/standards-cascade`.
- **Etapa 1:** prova de desempenho, com o anel completo e as 3.000 fibras em WebGL no navegador.
- **Etapa 2:** a prévia HTML com abertura, pesquisa, foco, caixa lateral, corrida e os dois modos de públicas. **Você avalia aqui.**
- **Etapa 3:** host WebView2, ZIP e iniciador. Teste no PC antigo.

