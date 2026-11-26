# LOOM · Standards Loom

Mapa interativo das normas da BU2: cada norma é uma célula num anel, e cada
citação entre normas é um fio. Mostra o que cada norma exige e quem depende
dela. Interface em inglês, somente leitura.

Dados: 596 normas internas (as 595 vigentes do Valid-Documents de 2026-11-23
mais a W-B-0718, norma final sem código novo), 952 citações internas e as 421
normas públicas/regulatórias citadas (1.513 citações). Fonte: Link-Normas,
rodada 3.

## Abrir

1. Baixe o repositório inteiro (Code → Download ZIP, ou `git clone`) e extraia.
2. Dê dois cliques em **`Abrir LOOM.cmd`**.

Na primeira vez, o LOOM confere o pacote (SHA-256) e prepara uma cópia local
em `%LOCALAPPDATA%\BU2Loom`; as próximas aberturas são imediatas. Não precisa
instalar nada nem de internet: o executável já traz o .NET, a interface, as
fontes e os dados. Usa o Microsoft Edge WebView2 Runtime, que já vem no Windows
10/11 atualizado.

O pacote fica em `distribution/1.0.0/` (`LOOM-1.0.0-win-x64.zip` e o `.sha256`).

## Configurar a pasta dos documentos (PC comercial)

Edite **`config/loom.config.json`** (Bloco de Notas serve):

```json
{
  "documentsFolder": "C:\\Normas\\05_DOCUMENTS",
  "searchSubfolders": true
}
```

- `documentsFolder`: qualquer pasta com os PDF/DOCX das normas, inclusive de
  rede (`\\servidor\pasta`). No JSON, cada barra invertida é escrita dupla: `\\\\servidor\\pasta`.
  Caminho relativo é contado a partir da pasta `config`; o padrão procura o
  `link_normas\05_DOCUMENTS` ao lado da pasta do LOOM.
- `searchSubfolders`: procura também nas subpastas.

Salve e reabra o LOOM. Ao abrir, ele indexa a pasta; para cada norma o botão
**Open document** encontra o arquivo pelo nome do cadastro, pelo código antigo
(ex.: `S-G-DN-5000`), pelo código novo (ex.: `DSGN-347`) ou pelo código legado,
em qualquer subpasta, e abre no programa padrão do Windows. Se não achar, a
caixa lateral mostra "Document not found" e a pasta procurada.

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

## Desenvolvimento

Node e Python são necessários só na máquina de desenvolvimento:

```
npm ci
python tools/build-data.py --source ../link_normas
npm run build
npm test
powershell -File build.ps1 -Dotnet <caminho do dotnet.exe>
```

`build.ps1` roda a interface e os testes, publica o executável (.NET 10
WinForms + WebView2, self-contained), testa o executável publicado (interface,
dados e busca de documentos) e gera o ZIP com SHA-256 em `distribution/`.
`html-preview/` é a interface embutida; abrir `html-preview/index.html` no
navegador continua funcionando para desenvolvimento.

`npm test` valida os dados, a geometria e um roteiro visual completo no Edge
(1600×1000, rede bloqueada), incluindo FPS mínimo de 55. Capturas em
`docs/media/review/`.

Estrutura: `host/` é o executável Windows; `src/model.ts` monta o anel e a hierarquia; `src/renderer.ts`
desenha células e fios em WebGL2 (spline cúbica com bundling beta 0,85,
calculada na GPU); `src/main.ts` cuida da interface; `tools/build-data.py`
gera `data/cascade-data.json` a partir do Link-Normas.
