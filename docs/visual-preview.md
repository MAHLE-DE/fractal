# Standards Workspace — prévia visual 0.1.0

## Objetivo deste marco

Validar primeiro a apresentação completa: árvore, navegação, painéis, pesquisa, catálogo, produtos e formulários. Não é uma versão de produção, nem uma implementação de concorrência.

- Grafo escuro, como uma constelação técnica, sem brilho neon.
- Interface, formulários e identidade visual próximos do MAHLE BU2 Workspace.
- Normas e relações inteiramente fictícias, com UUIDs demonstrativos estáveis.
- Referências internacionais, repetições por caminho e retorno de ciclo.
- Ilhas MEAS/MNFG sem linhas para a raiz ou para cópias dentro da árvore.
- Seleção, caminho ancestral, filhos imediatos, zoom no cursor, arraste e reenquadramento.
- Cadastros e alterações podem ser simulados na memória da sessão; recarregar/fechar restaura os dados fictícios.
- Os arquivos em `data/` permanecem intocados. Não há gravação em rede, abertura de documentos fictícios, importação de normas nem alteração do app MAHLE.

## Executar

Abra `frontend/index.html` diretamente no Edge, ou o executável `Fractal.Preview.exe` do pacote gerado. O HTML funciona offline sem servidor, Node ou Python. O executável inclui .NET e precisa apenas do WebView2 Runtime. Extraia o pacote inteiro, não somente o EXE.

O seletor de documentos no executável é nativo do Windows. No navegador, usa-se o seletor do navegador, que não fornece o caminho completo por segurança. Nenhum dos modos copia o documento ou grava seu cadastro.

## Separação para integração futura

1. `demo-data.js`: fixtures isoladas; não são o banco real.
2. `graph-model.js`: cadastro lógico → instâncias por caminho, com interrupção de ciclos.
3. `organic-layout.js`: geometria transitória, sem persistência de coordenadas.
4. `workspace-renderer.js`: câmera e desenho no Canvas 2D.
5. `workspace.js`: apresentação e estado da sessão.
6. `desktop/`: hospedeiro C#/WebView2 mínimo, com API controlada somente para escolher documento.

O frontend não depende de Python. O hospedeiro pywebview e o código visual MVP antigo foram retirados dos arquivos atuais durante a preparação do pacote comercial; permanecem no histórico do Git. O repositório distribui somente o protótipo visual atual e seu código-fonte de manutenção.

O contrato funcional continua sendo a referência. A seção 18, que fixava Python, é substituída nesta direção técnica pela autorização do usuário para C#/WebView2; não há modificação das regras de identidade, relações ou arquivos.

## Próxima fase: várias pessoas editando simultaneamente

O requisito é edição simultânea, não bloqueio exclusivo do aplicativo inteiro. A implementação futura deve oferecer:

- banco isolado de normas, com `dataRoot` configurável para teste local e posterior UNC;
- `revision`/ETag por registro e conferência da revisão lida antes de salvar;
- exclusão mútua breve apenas no commit dos registros/índices afetados, liberada mesmo em falha;
- escrita temporária + substituição atômica e manifesto de transação para alterações entre múltiplos JSONs;
- rejeição de sobrescrita silenciosa: conflito apresenta valores locais/remotos e permite recarregar ou resolver;
- UUIDs permanentes, índices reconstruíveis e validação de referências;
- backup, recuperação e testes reais com múltiplos processos e pasta SMB.

Esse protocolo ainda não foi implementado ou validado. Não usar os formulários desta prévia como cadastro operacional. Cadastro completo, taxonomia, validações, persistência e concorrência serão construídos depois da aprovação visual.
