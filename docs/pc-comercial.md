# Rodar a prévia visual no PC comercial

## Opção mais simples: repositório completo

1. Baixe **Code → Download ZIP** do repositório `MAHLE-DE/fractal`.
2. Extraia o ZIP inteiro para uma pasta local. Não abra arquivos de dentro do ZIP.
3. Abra **Abrir prototipo.cmd**, na raiz da pasta extraída.

O iniciador usa o PowerShell que acompanha o Windows, valida o SHA-256 do pacote e o extrai para uma pasta própria em `%LOCALAPPDATA%\MAHLE\FractalPreview\packages`. Depois inicia o executável. Não baixa dependências nem precisa de internet. O cache do WebView2 também é separado do aplicativo MAHLE.

## Alternativa: extrair o programa manualmente

1. Localize `distribution/0.1.0/Fractal-VisualPreview-0.1.0-win-x64.zip` no repositório extraído.
2. Extraia esse segundo ZIP por inteiro em uma pasta permanente.
3. Abra `Fractal.Preview.exe`.

Essa alternativa não usa scripts. É útil se as políticas corporativas bloquearem o iniciador. O pacote não é assinado digitalmente; se a política da empresa exigir aprovação, solicite-a à TI, sem desativar proteções.

## Requisitos

- Windows x64 compatível com .NET 10 e WebView2.
- Microsoft Edge WebView2 Runtime disponível, como no app MAHLE.
- Não é necessário instalar Python, Node, .NET SDK ou runtime .NET separado.
- Não é necessário configurar fontes, caminhos de rede, credenciais ou banco de dados.

## O que vai funcionar neste marco

Árvore, zoom, arraste, seleção, pesquisa, filtros, catálogo, produtos, conexões e formulários para simular alterações. São 104 normas fictícias iniciais. Alterações ficam apenas na memória da sessão e somem ao fechar/recarregar.

Não há cadastro operacional, gravação na rede, abertura dos documentos fictícios nem edição simultânea implementados. Não utilize o protótipo como banco real. Nenhuma configuração ou dado do aplicativo MAHLE é modificado.

## Se não abrir

- Confira se o ZIP inteiro foi extraído e se `frontend/` está ao lado do EXE na extração manual.
- Se faltar WebView2 Runtime ou houver bloqueio corporativo de execução, solicite verificação à TI.
- Para validar somente o visual, abra `frontend/index.html` da raiz do repositório no Edge, sem servidor ou instalação.
- Não rode `build.ps1` no computador comercial: ele serve apenas para gerar novos pacotes no computador de desenvolvimento com SDK.
