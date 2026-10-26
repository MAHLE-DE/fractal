# Banco JSON 2.0 — referência para edição manual / IA

O caminho efetivo é `dataRoot` em `config/appsettings.json`, também exibido em Settings. Padrão: `C:\Users\Public\Documents\MAHLE\StandardsWorkspaceData`. **Não edite a pasta data/ do repositório esperando alterar a aplicação.**

## Protocolo obrigatório

1. Settings → **Pause saves for JSON editing**. Aguarde a confirmação. Qualquer usuário pode coordenar essa pausa; combine com a equipe.
2. Faça um backup **integral** de dataRoot. Não edite `.transactions/`, `backups/` ou `.write.lock`.
3. Modifique os arquivos operacionais abaixo. Use UTF-8, JSON estrito: sem comentários, chaves repetidas ou vírgulas finais.
4. **Validate & resume saves**. Em erro, corrija ou restaure seu backup. A pausa continua ativa até validar.
5. Refresh nas outras instalações. Um formulário aberto antes da manutenção permanece desatualizado; deve ser reaberto para editar a versão nova.

Não faça substituições externas durante uma gravação normal. O app usa fingerprint e transações, mas um editor externo que ignora o lock pode causar conflitos de recuperação. Se houver transação pendente, preserve todos os arquivos e resolva essa recuperação antes de editar.

## Identidades

- Cada norma e subgrupo: UUID lowercase, formato `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`.
- O nome do arquivo é **exatamente o UUID interno + .json**.
- UUID não muda quando código, título, revisão ou caminho muda. Relações usam UUID, nunca Document No.
- UUID de relação também é único. Um par origem→destino só pode existir uma vez. Uma norma pode ser destino de muitas outras.
- `revision_no` é sempre **string**, inclusive `"1"`, `"01.0"` ou `"2026"`.
- Não copie `_etag`, `image_url`, `group` ou `preview_only` de uma resposta da interface para os JSONs; são campos transitórios.

## standards/<UUID>.json

Exemplo de norma interna (troque IDs/caminho pelos reais):

```json
{
  "schema_version": "2.0",
  "id": "11111111-1111-4111-8111-111111111111",
  "identification": {
    "document_no": "TEST-001",
    "revision_no": "1.0",
    "title": "Performance requirements",
    "previous_document_numbers": []
  },
  "classification": {
    "origin": "internal",
    "internal_category": "test",
    "organization": "MAHLE",
    "customer_id": null
  },
  "applicability": {
    "product_group_ids": ["FLUID-SYSTEMS-LIQUID"],
    "product_subgroup_ids": ["22222222-2222-4222-8222-222222222222"],
    "is_general": false
  },
  "tree_entry": {"family": "test", "strength_level": 3},
  "document_location": {
    "file_path": "\\\\SERVIDOR\\Normas\\TEST-001.pdf",
    "file_name": "TEST-001.pdf",
    "online_url": "https://example.org/standard"
  },
  "record_control": {
    "revision": 1,
    "created_at": "2026-10-22T12:00:00Z",
    "updated_at": "2026-10-22T12:00:00Z",
    "updated_by": "DOMAIN\\user",
    "status": "active"
  }
}
```

Categorias/famílias aceitas: `test`, `material`, `design`, `measurement`, `manufacturing`. Na norma internacional: `origin: "international"`, `internal_category: null`, organização preenchida; `file_path`/`file_name` podem ser null. `tree_entry.family` continua definindo um setor de apresentação.

Uma norma pode selecionar vários `product_subgroup_ids`. `is_general: true` inclui a norma automaticamente em todos os subgrupos; isso não muda sua família. Os arrays devem existir mesmo quando vazios. As referências citadas são expandidas mesmo se a aplicabilidade delas for diferente da norma de origem.

Internas exigem caminho absoluto local/UNC para PDF, DOC ou DOCX. O app confere existência ao cadastrar ou mudar o caminho; uma leitura/validação do banco não exige que todos os PDFs estejam online. `online_url` pode ficar vazio, ou usar http/https. O app abre somente os documentos/links registrados.

## subgroups/<UUID>.json

```json
{
  "schema_version": "2.0",
  "id": "22222222-2222-4222-8222-222222222222",
  "name": "Oil filter elements",
  "description": "Oil filtration and sealing references",
  "product_group_ids": ["FLUID-SYSTEMS-LIQUID"],
  "image_path": "",
  "record_control": {
    "revision": 1,
    "created_at": "2026-10-22T12:00:00Z",
    "updated_at": "2026-10-22T12:00:00Z",
    "updated_by": "DOMAIN\\user",
    "status": "active"
  }
}
```

Nome único. Não existe Product Type. Cadastre fotos pelo aplicativo: ele gera o caminho relativo `images/<UUID>/<SHA256>.jpg|png` e grava imagem/metadados juntos. Não coloque base64 nem caminho absoluto de foto no JSON.

## groups.json

```json
{
  "schema_version": "2.0",
  "groups": [
    {"id": "FLUID-SYSTEMS-LIQUID", "name": "Fluid Systems Liquid"},
    {"id": "FLUID-SYSTEMS-AIR", "name": "Fluid Systems Air"}
  ]
}
```

Grupos novos criados no app recebem UUID. IDs existentes não devem ser alterados sem atualizar as referências. Nomes e IDs únicos.

## relations.json — principal arquivo para seu preenchimento com IA

```json
{
  "schema_version": "2.0",
  "subgroup_standard_relations": [],
  "standard_standard_relations": [
    {
      "id": "33333333-3333-4333-8333-333333333333",
      "source_standard_id": "11111111-1111-4111-8111-111111111111",
      "target_standard_id": "44444444-4444-4444-8444-444444444444",
      "strength_level": 3
    }
  ]
}
```

Esse exemplo de relação só valida se **as duas normas já existirem**. `source_standard_id` **cita** `target_standard_id`. `strength_level` inteiro 1/2/3 controla prioridade visual local; não é tipo semântico de relação. Ciclos entre normas diferentes são permitidos e interrompidos na expansão. Autorreferência direta e pares duplicados não são permitidos.

Para IA, entregue a lista `{id, document_no, title}` extraída de todos os arquivos standards/ e peça somente ligações entre esses UUIDs. Antes de gravar, confira os códigos associados para evitar citações inventadas. O validador confirma estrutura e referências existentes, não se o texto técnico realmente cita outra norma.

`subgroup_standard_relations` é compatibilidade para vínculos explícitos de entrada antigos. Em novos cadastros, mantenha `[]`: aplicabilidade + citações já determinam a cobertura mínima **dentro de cada família**. Um vínculo antigo também adiciona a norma ao contexto do subgrupo, mas **não obriga** que ela fique no primeiro nível quando outra entrada da mesma família a cobre. O peso pode servir de indicação para o representante escolhido; o setor nativo de uma norma interna vem de `classification.internal_category` (internacionais usam `tree_entry.family`). Uma citação cruzada cria uma aparição adicional sem remover a nativa. Não use esse array para incluir todas as normas na raiz.

## Arquivos técnicos e restauração

`.write.lock` é um arquivo normal de coordenação; existir não significa que alguém está editando. O bloqueio é mantido pelo Windows enquanto a operação está aberta.

`.transactions/<UUID>/` contém manifesto, hashes, before/, after/ e marcadores. Commits interrompidos confirmados são concluídos antes da próxima leitura; arquivos alterados externamente de forma incompatível não são sobrescritos. Commits concluídos vão a `backups/<UUID>/`. Esses backups técnicos não são uma interface de revisões antigas das normas e não têm limpeza automática.

Em recuperação conflitante, pare o uso e preserve a pasta inteira. Não apague transações nem escolha arquivos individuais por tentativa. Prefira restaurar uma cópia integral coerente com todas as instâncias fechadas, após identificar o que precisa ser preservado.
