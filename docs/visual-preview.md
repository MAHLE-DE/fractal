# Arquitetura — Fractal Workspace 0.2.0

A prévia 0.1.0 era somente visual. A 0.2.0 preserva a aparência e separa interface, domínio persistente e hospedeiro Windows.

- `frontend/`: HTML/CSS/JS sem Node em execução; Canvas 2D, pesquisa, formulários e seletores próprios. Abrir index.html diretamente usa demonstração em memória.
- `frontend/js/graph/graph-model.js`: grafo lógico → instâncias por caminho, cobertura mínima por componentes fortemente conexos, ciclos terminais e normas isoladas flutuantes.
- `organic-layout.js`: posições calculadas, setores, copa fractal e separação de células. Não grava coordenadas no banco.
- `workspace-renderer.js`: câmera, desenho, seleção e realce das aparições relacionadas a ilhas.
- `core/`: biblioteca .NET sem dependências de UI, leitura/validação, revisão/fingerprint e transações JSON. Pode ser integrada ao backend do app MAHLE.
- `desktop/`: WinForms/WebView2, ponte de mensagens restrita à origem local, seletor Windows, abertura de documentos/links registrados e entrega de imagens do banco.
- `config/appsettings.json`: instalação, modo e pasta de dados.
- `tests/`: regressões de grafo, dados e interface.
- `distribution/`: pacotes gerados; não é banco operacional.

## Concorrência e durabilidade

Um FileStream com FileShare.None em `.write.lock` serializa operações curtas para escritores cooperativos. A edição de um formulário não mantém o banco bloqueado.

Cadastros possuem fingerprint SHA-256; ligações e grupos têm fingerprint por registro. O cliente envia a revisão lida; conflito impede sobrescrita, inclusive após edição externa que não mudou o número de revisão. Adições de relações diferentes são mescladas sobre o arquivo mais recente sob lock.

Uma transação prepara arquivos novos e cópias anteriores, manifesta os hashes, grava marcador de commit durável, aplica substituições de arquivo e marca conclusão. Antes de ler, uma transação confirmada e incompleta é concluída. Se um arquivo foi alterado externamente de forma incompatível com uma recuperação pendente, a recuperação recusa sobrescrever. As cópias concluídas são movidas para backups/.

Isso fornece recuperação coordenada entre arquivos, não atomicidade de pasta garantida para leitores externos que ignoram o protocolo. Toda edição direta deve usar manutenção e todo leitor externo deve evitar arquivos durante gravações. Garantias de flush, exclusão e rename dependem do sistema de arquivos/servidor; validar SMB real é obrigatório.

## Cobertura mínima

Para o subgrupo, entram normas aplicáveis, normas gerais e referências de entrada legadas; depois se inclui o fechamento por citações. A decomposição de Tarjan condensa ciclos. Cada componente sem entrada de outro componente precisa de um ponto inicial. Escolher um representante de cada um é um mínimo exato de cobertura por alcance.

Dentro de um ciclo, prioriza-se quem tem mais citações diretas; empate por código/UUID, de forma determinística. Normas completamente isoladas são flutuantes sem aresta para o produto. O número mínimo não pode ser reduzido criando citações artificiais. MEAS/MNFG conservam ilhas próprias e cópias quando citadas em galhos.

A expansão por caminho termina nos ciclos. Depois do orçamento de repetições, caminhos já expandidos deixam de ser repetidos recursivamente; primeiras ocorrências continuam sendo expandidas para preservar a cobertura única. Filtros do usuário são uma ocultação intencional e a lista de conexões continua integral.

## Escopo de validação

Testes de processos concorrentes em disco local, recuperação interrompida, referências, JSON inválido, ETags e interface integrada com o repositório real. O transporte automatizado de UI simula seleção de arquivo e abertura de programas; smoke test valida a inicialização nativa WebView2. Nenhum teste automatizado usa a rede corporativa ou o banco de auditorias.

Sem login, servidor, Firebase, serviço Python ou Node em produção. Permissões do compartilhamento ficam sob a política Windows da empresa. Todas as pessoas com acesso ao app podem editar e ativar a manutenção.
