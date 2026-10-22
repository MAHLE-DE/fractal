# Fractal 0.2.0 no PC comercial

## Execução

Extraia o repositório inteiro e abra **Abrir Fractal.cmd**. Se scripts forem bloqueados pela política da empresa, extraia `distribution/0.2.0/Fractal-Workspace-0.2.0-win-x64.zip` por inteiro e execute `Fractal.Preview.exe`.

Windows x64 + WebView2 Runtime. Não precisa .NET SDK, Python ou Node. O pacote inclui seu próprio runtime .NET. Não é assinado digitalmente; se necessário, solicite liberação à TI sem desativar proteções corporativas.

## O que configurar

No fluxo do iniciador, edite `config/appsettings.json` da raiz baixada. Na extração manual do pacote, edite o arquivo homônimo ao lado do executável. É a **mesma configuração lógica**, mas cada fluxo lê sua própria cópia.

- `mode: "production"` para cadastro real persistente.
- `dataRoot` é a pasta do banco. Por padrão: `C:\Users\Public\Documents\MAHLE\StandardsWorkspaceData`.
- Para equipe: preencha a mesma UNC em todos os PCs, com leitura e escrita. Exemplo JSON: `"dataRoot": "\\\\SERVIDOR\\Equipe\\StandardsWorkspaceData"`.
- Feche e reabra depois de mudar a configuração.

A tela Settings mostra o caminho efetivamente usado e oferece **Open data folder**. O banco começa vazio; os dois grupos iniciais podem receber novos subgrupos.

`mode: "demo"` é apenas apresentação com dados fictícios em memória. Não confunda a demonstração com produção.

## Primeiros passos

1. Em Product subgroups, crie subgrupos com nome, descrição e grupo.
2. Clique em Photo para selecionar JPG/PNG; recomendação visual 16:9, por exemplo 1280×720. Outras proporções são recortadas no quadro.
3. Em New standard, selecione subgrupos ou General standard, informe código/revisão/título e o arquivo real da norma. Internacionais podem não ter arquivo.
4. Cadastre também o link online opcional. Nos detalhes, arquivo e link têm botões separados.
5. Em Connections, informe a norma de origem que cita e a norma referenciada. O app escolhe entradas da árvore automaticamente.

Código e revisão podem ser atualizados sem trocar o UUID. Relocate file altera apenas o caminho. Fotos são copiadas para o banco; PDFs/Word ficam no local original e precisam estar acessíveis aos demais computadores.

## Validar compartilhamento antes da equipe usar

Em dois PCs apontados à mesma pasta UNC:

1. Cadastre um subgrupo/norma de teste; aguarde a atualização automática ou clique Refresh no outro PC.
2. Abra o mesmo cadastro nos dois, salve no primeiro e tente salvar no segundo. Deve haver conflito visível, sem perder o texto digitado.
3. Edite registros diferentes: ambos devem salvar.
4. Verifique abertura de arquivo e foto no segundo PC.
5. Teste interrupção de rede apenas com uma cópia de testes, não com produção.

A atualização automática ocorre aproximadamente a cada 8 segundos, sem substituir formulários abertos. Não há modo offline de gravação: rede indisponível gera erro; não cria um banco local substituto.

## JSON e manutenção com IA

Em Settings, use **Pause saves for JSON editing** antes de mudar arquivos diretamente. Todos continuam lendo, mas não conseguem salvar. Faça cópia integral do banco. Edite `relations.json` e/ou cadastros respeitando UUIDs e [o esquema](data-format.md). Depois use **Validate & resume saves**.

Se a validação falhar, o app mantém a pausa; corrija os arquivos ou restaure sua cópia. Não remova `maintenance.json` como solução. Manutenção é coordenação, não uma permissão administrativa.

## Atualização do aplicativo

Feche a versão antiga; extraia a nova versão em outra pasta e configure o **mesmo dataRoot**. Não copie um banco vazio sobre o existente. Os dados não ficam dentro do pacote nem no cache do executável. Preserve sempre uma cópia de segurança antes de atualizar.

Se a aplicação não abrir, confirme extração completa e WebView2. Se abrir, mas o banco não carregar, veja o caminho em Settings, acesso à UNC e a mensagem de validação. O app não substitui arquivos corrompidos por dados vazios.
