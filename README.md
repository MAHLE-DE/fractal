# MAHLE Standards Workspace — Fractal

## Testar a nova árvore no PC comercial — HTML

1. Baixe o ZIP do repositório e **extraia tudo**.
2. Abra **Abrir teste HTML.html**, na raiz, ou **html-preview/Abrir teste.html** no Edge ou Chrome.
3. Use **Canopy** para ver o motor novo. O seletor superior também permite comparar Original, Growth e Envelope.

A pasta [html-preview](html-preview/LEIA-ME.md) contém tudo para o teste e pode ser copiada sozinha para outro computador. Funciona offline, **sem EXE próprio, Python, Node, .NET, instalação ou PDFs**. Arraste para mover a árvore, use a roda para aproximar e duplo clique para enquadrar.

A prévia é **somente leitura** e usa um snapshot com 692 normas, sete subgrupos e 558 relações. Não acessa o banco comercial nem salva cadastros. A pasta operacional `StandardsWorkspaceData1` foi retirada da versão atual do repositório; seus backups e transações não fazem parte do teste. O snapshot visual fica em `html-preview/data/workspace-snapshot.js`.

O motor novo mantém os ramos orientados para fora, reserva espaço por subárvore e permite que setores maiores se abram na copa. Foram validadas 36 combinações com o banco real, sem sobreposições de células ou perda de cobertura. Veja o [relatório de testes](docs/testes-motores-copa-2026-10-26.md).

**Os iniciadores `.cmd` abaixo continuam abrindo o pacote Windows 0.2.1 já publicado. Para avaliar estas mudanças visuais, use o HTML acima.**

## Aplicativo Windows operacional — 0.2.1

Módulo independente de normas para futura integração ao MAHLE BU2 Workspace. Interface em inglês, documentação em português. Agora possui cadastro operacional, documentos reais e persistência em JSON; o modo demonstrativo continua disponível.

## Abrir no Windows comercial

1. Extraia o **repositório completo** em uma pasta local.
2. Edite `config/appsettings.json` conforme a seção abaixo.
3. Abra **Abrir Fractal.cmd**. O antigo `Abrir prototipo.cmd` também abre esta versão.

O pacote pronto fica em `distribution/0.2.1/Fractal-Workspace-0.2.1-win-x64.zip`. O iniciador valida seu SHA-256, extrai uma cópia por versão em `%LOCALAPPDATA%\MAHLE\FractalWorkspace\packages` e passa a configuração da **raiz do repositório** ao programa. Não edite a configuração dentro desse cache.

Alternativa sem scripts: extraia esse pacote por inteiro, edite `config/appsettings.json` **da extração** e abra `Fractal.Preview.exe`. Esse nome interno foi mantido por compatibilidade; a interface identifica a versão 0.2.1.

Requer Windows x64 e WebView2 Runtime. Não precisa Python, Node, .NET SDK nem runtime .NET separado: o pacote é self-contained. Não mova apenas o EXE; mantenha bibliotecas, `frontend/` e `config/`.

## Configuração e localização dos JSON

```json
{
  "schemaVersion": 2,
  "mode": "production",
  "dataRoot": "%PUBLIC%\\Documents\\MAHLE\\StandardsWorkspaceData"
}
```

- O caminho padrão normalmente resulta em **C:\Users\Public\Documents\MAHLE\StandardsWorkspaceData**. É um banco **local**, útil para testar.
- Para compartilhar, todos os computadores devem configurar a **mesma pasta UNC**. Exemplo de valor no JSON: `"\\\\SERVIDOR\\Compartilhamento\\StandardsWorkspaceData"`.
- `production`: banco novo vazio, com dois grupos iniciais genéricos. Cadastros são reais e persistentes.
- `demo`: 104 normas fictícias somente em memória. Nenhum cadastro é gravado no banco. Abrir `frontend/index.html` no navegador também usa essa demonstração.
- Alterar a configuração exige reiniciar o app, **não recompilar**.
- A pasta dos documentos pode ser diferente da pasta do banco. PDF/DOC/DOCX são referenciados, não copiados. Fotos de subgrupos são copiadas para o banco.
- Não há migração de normas fictícias para produção nem acesso ao banco do aplicativo de auditorias.

Estrutura operacional:

```text
<dataRoot>/
  groups.json
  relations.json
  standards/<UUID>.json
  subgroups/<UUID>.json
  images/<UUID-do-subgrupo>/<hash>.png|jpg
  maintenance.json
  .write.lock
  .transactions/
  backups/
```

**Ligações entre normas estão em `relations.json → standard_standard_relations`.** Cada cadastro está em `standards/<UUID>.json`; cada subgrupo, em `subgroups/<UUID>.json`. A pasta `data/` deste repositório **não é o banco**.

Para preencher muitas relações com IA, leia [Formato do banco e edição externa](docs/data-format.md) antes. Ative **Settings → Pause saves for JSON editing**, faça um backup integral, edite e use **Validate & resume saves**. Não edite enquanto outras pessoas gravam normalmente.

## Organização das árvores

Product Group → Product Subgroup. Não existe mais Product Type. Uma norma pode pertencer a vários subgrupos. **General standard** aplica-se a todos, inclusive futuros; **All standards** reúne a biblioteca inteira sem duplicar cadastros.

As raízes são automáticas e minimizadas **dentro de cada família**. TEST, MATL e DSGN preservam suas árvores próprias: uma citação entre famílias acrescenta uma aparição no galho do pai, sem eliminar a aparição nativa da norma. Caminhos diretos e indiretos reduzem as entradas dentro do setor; ciclos são tratados como componentes. Normas sem ligações flutuam no setor correspondente, com cor discretamente diferenciada e sem aresta artificial. MEAS/MNFG mantêm aparições independentes em ilhas; selecionar uma ilha realça seus caminhos presentes na árvore.

À direita, Reference families seleciona **somente** a família clicada; All restaura as três. A seleção aparece destacada e identificada em texto. A legenda sobre o mapa continua permitindo combinar famílias. Clique diretamente na área de foto para escolher uma imagem; quadros em **4:3**, sem botão sobreposto de alteração.

Os filtros podem ocultar famílias/profundidades intencionalmente. Referências citadas aparecem mesmo quando sua aplicabilidade é diferente. Grafos com muitas repetições limitam a expansão de caminhos já vistos, sem perder a cobertura de normas únicas; todas as ligações continuam disponíveis nos detalhes.

## Edição simultânea

Qualquer usuário pode cadastrar e editar. As gravações usam um bloqueio curto de arquivo compartilhado, impressão digital por registro e transações recuperáveis. Duas pessoas podem editar registros diferentes; ao salvar o mesmo registro desatualizado, o app bloqueia a sobrescrita e mantém o formulário para comparação com o salvo. Não existe login.

Os testes cobrem processos concorrentes locais, conflitos, JSON inválido e recuperação de gravação interrompida. **A rede SMB e suas permissões devem ser validadas em dois computadores da empresa antes da adoção pela equipe.** Não use pastas sincronizadas por OneDrive/SharePoint como substituto de um compartilhamento de arquivos. Todos precisam de leitura e escrita na pasta compartilhada.

Backups técnicos não substituem o backup corporativo. Não edite `.transactions/` ou `backups/` manualmente; não apague uma transação pendente para “destravar” o banco.

## Desenvolvimento e verificações

```powershell
.\build.ps1 -Version 0.2.1
.\Start-Preview.ps1 -SmokeTest
```

Build: .NET SDK 10 e pacote WebView2 via NuGet/cache, somente no computador de desenvolvimento. O script reconhece o SDK local utilizado pelo projeto MAHLE e gera pacote self-contained em `artifacts/`. Não modifica o outro repositório.

Verificações adicionais com Node e Playwright/Edge no desenvolvimento:

```powershell
node --test tests/graph.test.cjs
dotnet run --project tests/data/Fractal.Data.Tests.csproj -c Release
node tests/preview.e2e.cjs
node tests/production.e2e.cjs
```

O último teste usa o repositório JSON real com transporte de teste e seletor de arquivo simulado. Abertura nativa é verificada separadamente pelo smoke test WebView2. Fixtures ficam em pastas temporárias exclusivas, nunca no banco da empresa.

Veja [PC comercial](docs/pc-comercial.md), [arquitetura](docs/visual-preview.md) e o contrato original preservado. As decisões posteriores do usuário — subgrupos como contexto e raízes automáticas — prevalecem sobre o contrato original.

### Verificar a prévia HTML no desenvolvimento

Estes comandos usam o snapshot incluído em `html-preview`, sem precisar da pasta operacional retirada do Git:

```powershell
node --test tests/graph.test.cjs tests/canopy-layout.test.cjs
node tests/canopy.e2e.cjs html-preview
node tests/layout-preview.e2e.cjs html-preview
```

Requerem Node e Playwright/Edge somente no computador de desenvolvimento. No PC comercial basta abrir o HTML.
