# MAHLE Standards Workspace — prévia visual 0.1.0

Organizador de normas com árvore fractal, desenvolvido separadamente para futura integração ao MAHLE BU2 Workspace.

## Baixar e rodar no PC comercial

1. No GitHub, use **Code → Download ZIP** e extraia **todo o repositório** em uma pasta local.
2. Dê dois cliques em **`Abrir prototipo.cmd`**, na raiz da pasta extraída.
3. Na primeira abertura, ele confere e extrai automaticamente o pacote pronto e inicia o aplicativo. Não execute de dentro do ZIP.

Não precisa Python, Node, .NET SDK, NuGet nem recompilação. O runtime .NET já está incluído. Requer Windows x64 e WebView2 Runtime, como o aplicativo MAHLE.

**Alternativa sem o iniciador:** extraia `distribution/0.1.0/Fractal-VisualPreview-0.1.0-win-x64.zip` por inteiro e execute `Fractal.Preview.exe` dentro dessa extração. Não copie somente o EXE: bibliotecas e `frontend/` são necessários.

A primeira abertura usa `%LOCALAPPDATA%\MAHLE\FractalPreview\packages`. Não grava no banco da empresa. O pacote é validado por SHA-256; uma atualização usa uma pasta separada para evitar carregar arquivos antigos.

Para testar apenas a interface no navegador, abra `frontend/index.html` no Edge. Também funciona offline e sem servidor.

Leia [as instruções e verificações do PC comercial](docs/pc-comercial.md). Caso a política corporativa bloqueie o script, use a extração manual do pacote; não é necessário alterar as políticas da empresa.

**Esta etapa é somente uma prévia visual.** Os 104 cadastros iniciais são fictícios. Alterações podem ser simuladas na sessão, mas não são salvas no disco e desaparecem ao recarregar/fechar. Nenhum banco MAHLE é acessado.

## O que experimentar

Seleção de produto, pesquisa por código/título/código antigo, seleção de células e ligações, zoom no cursor, arraste, reenquadramento, filtros de família/profundidade e ilhas independentes. Explore também catálogo, produtos, conexões, atualização, relocalização e os formulários de cadastro.

Interface em inglês para manter compatibilidade com o app MAHLE. Documentação em português.

## Build no computador de desenvolvimento

```powershell
.\build.ps1
```

Requer .NET SDK 10 e restauração do pacote WebView2 via NuGet/cache. O script também reconhece o SDK local usado pelo projeto MAHLE. Gera executável e ZIP em `artifacts/`; não modifica o outro repositório. Não é preciso compilar no computador comercial.

## Arquitetura e limites

Leia [a descrição da prévia e o plano de concorrência](docs/visual-preview.md) e o contrato técnico original. A edição simultânea é requisito confirmado para a próxima fase, mas ainda não está implementada nesta prévia.

O executável atual usa C#/WebView2 e poderá compartilhar o módulo visual com o app existente sem iniciar um serviço Python. O protótipo Python e o renderizador MVP anteriores foram retirados dos arquivos atuais para evitar confusão; continuam recuperáveis no histórico do Git. O contrato original foi preservado.
