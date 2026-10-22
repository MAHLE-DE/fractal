# CONTRATO TÉCNICO DE ARQUITETURA E ESPECIFICAÇÃO FUNCIONAL

Aplicativo de navegação radial para normas técnicas

*Documento de continuidade para agentes de desenvolvimento*

Versão do contrato: 2.0  
Data-base: 21 de outubro de 2026  
Status: arquitetura funcional e tecnológica consolidada até o MVP 04  
Responsável pelo conceito: Cauã Ferrari

---

# Controle do documento

| **Campo** | **Definição** |
|----|----|
| Finalidade | Registrar as decisões funcionais, conceituais e de dados já consolidadas para permitir continuidade imediata por qualquer agente programador. |
| Natureza | Contrato técnico de arquitetura e comportamento. Não é contrato jurídico nem especificação fechada de tecnologia. |
| Escopo atual | Cadastro de normas internas e internacionais, tipos de produto, ligações, visualização radial, ilhas MEAS/MNFG e atualização de arquivos. |
| Fora do escopo atual | Grafo de normas de cliente, autenticação, permissões, implantação, tecnologia de frontend/backend e algoritmo geométrico definitivo. |
| Autoridade das decisões | Os requisitos marcados como “deve” são obrigatórios; itens marcados como “poderá” são extensões possíveis. |

# Resumo executivo

O aplicativo organizará aproximadamente 530 normas em grafos hierárquicos direcionados, visualizados como enraizamentos radiais. Cada visualização parte de um tipo de produto fixado no centro. Ao redor da raiz surgem três ramificações principais para normas de teste, material e design. Normas de medição e manufatura ocupam ilhas periféricas independentes. Normas internacionais podem aparecer em qualquer ramificação, mesmo sem arquivo local.

A identidade de cada norma é garantida por um UUID gerado automaticamente no primeiro cadastro. O UUID nunca muda e é a referência usada nas ligações. O nome oficial, a revisão, o título e o caminho do arquivo podem ser atualizados sem quebrar o grafo. As instâncias visuais podem se repetir em árvores diferentes, porém todas apontam para o mesmo cadastro lógico.

Cada ligação possui força discreta 1, 2 ou 3. A força não altera o tamanho dos nós e não representa importância absoluta da norma. Ela expressa a relevância do destino no contexto da origem e orienta o algoritmo a construir galhos periféricos, intermediários ou principais.

# Princípios incontornáveis

- Um tipo de produto é sempre a raiz central da visualização principal.
- Cadastro da norma, ligação lógica e instância visual são entidades diferentes.
- O UUID da norma é permanente, automático e invisível à operação cotidiana.
- O caminho do arquivo é atualizável e não compõe a identidade da norma.
- Normas internas exigem arquivo local PDF, DOC ou DOCX no cadastro.
- Normas internacionais podem existir sem arquivo local.
- O mesmo cadastro pode gerar várias aparições visuais independentes.
- Não haverá relação semântica: toda aresta tem o mesmo significado estrutural de chamada/citação.
- A força da ligação é local à relação e assume apenas 1, 2 ou 3.
- Ciclos podem existir, mas nunca podem causar expansão infinita.
- Normas de cliente não participam do grafo desta versão.

# 1. Visão do produto

## 1.1 Objetivo

Criar uma ferramenta de consulta e exploração de normas técnicas que substitua buscas lineares em pastas por uma navegação contextual. O usuário seleciona um tipo de produto, visualiza as normas de primeiro nível aplicáveis e percorre as dependências em ramificações sucessivas.

## 1.2 Metáfora visual

A metáfora não é uma constelação livre. Trata-se de uma árvore direcionada desenhada radialmente em todas as direções, com raiz central fixa e setores funcionais. Cada nó pode originar novos galhos, repetindo localmente a mesma lógica de prioridade.

TIPO DE PRODUTO (raiz)  
├── setor TEST → normas de primeiro nível → descendentes  
├── setor MATL → normas de primeiro nível → descendentes  
├── setor DSGN → normas de primeiro nível → descendentes  
├── ilha MEAS → conjunto periférico independente  
└── ilha MNFG → conjunto periférico independente

## 1.3 Escopo funcional atual

- Cadastro, consulta, edição e atualização de normas.
- Cadastro e seleção de tipos de produto.
- Associação entre produto e normas de primeiro nível.
- Criação, edição e remoção de ligações entre normas.
- Renderização radial com forças 1, 2 e 3.
- Exibição de ilhas MEAS e MNFG.
- Repetição controlada de normas no desenho.
- Abertura do arquivo local vigente quando disponível.
- Cadastro simplificado de normas internacionais sem arquivo.
- Pesquisa por código atual, título e códigos anteriores.

## 1.4 Fora do escopo atual

- Normas de cliente no mesmo grafo. Elas serão tratadas futuramente em outro grafo.
- Histórico completo de revisões e armazenamento de arquivos obsoletos.
- Inferência automática de relações por IA ou similaridade textual.
- Permissões por usuário, workflow de aprovação e auditoria regulatória.
- Definição obrigatória de framework, banco de dados ou linguagem.

# 2. Modelo conceitual

| **Entidade** | **Responsabilidade** | **Identidade** |
|----|----|----|
| Tipo de produto | Raiz de uma visualização radial e agregador das normas de primeiro nível. | product_id |
| Norma | Cadastro único dos metadados vigentes e, quando aplicável, do arquivo local. | standard.id (UUID) |
| Ligação produto-norma | Define entrada, setor/ilha e força de uma norma de primeiro nível. | relation.id (UUID) |
| Ligação norma-norma | Define que uma norma chama outra e qual é a força local. | relation.id (UUID) |
| Instância visual | Aparição temporária de uma norma em um caminho específico. Pode repetir-se. | instance_id temporário |
| Taxonomia de produto | Catálogo normalizado de grupos, subgrupos e tipos. | IDs textuais estáveis |

## 2.1 Separação de responsabilidades

Cadastro da norma → descreve o indivíduo  
Ligação → descreve quem chama quem  
Instância visual → descreve uma aparição naquele caminho  
Layout → decide onde desenhar a aparição

O cadastro não deve guardar nível radial, coordenadas, tamanho do círculo ou posição angular. Essas propriedades dependem da visualização e serão calculadas durante a renderização.

# 3. Categorias de normas

| **Prefixo/categoria** | **Nome** | **Origem** | **Papel visual** |
|----|----|----|----|
| TEST | Test Standard | Interna | Ramificação radial principal |
| MATL | Material Standard | Interna | Ramificação radial principal |
| DSGN | Design Standard | Interna | Ramificação radial principal |
| MEAS | Measurement Standard | Interna | Ilha periférica |
| MNFG | Manufacturing Standard | Interna | Ilha periférica |
| Internacional | ISO, ASTM, DIN, SAE etc. | Internacional | Descendente da norma que a chama; sem setor próprio |
| Cliente | Norma específica de cliente | Cliente | Fora do grafo atual |

O prefixo observado no código atual ajuda a interface, mas não deve ser a única fonte de classificação. A categoria deve ser armazenada explicitamente, pois o campo document_no é deliberadamente flexível.

# 4. Cadastro de normas

## 4.1 Identidade permanente

No primeiro cadastro, o aplicativo deve gerar automaticamente um UUID. O usuário não digita, escolhe nem altera esse valor. Toda relação do grafo referencia esse UUID. Atualizações posteriores preservam o mesmo UUID.

Exemplo: 6ebea18d-7eb3-4ca7-814d-87f1cf988d24

## 4.2 Campos do cadastro

| **Campo de interface** | **Propriedade sugerida** | **Regra** |
|----|----|----|
| Document No | identification.document_no | Obrigatório; texto livre não vazio; código oficial atual. |
| Revision No | identification.revision_no | Obrigatório; armazenado como string para preservar valores como 12.0. |
| Title | identification.title | Obrigatório; título integral, potencialmente extenso. |
| Prev Document No | identification.previous_document_numbers\[\] | Lista opcional de códigos antigos; aceita espaços, parênteses e hífens. |
| Product Group | applicability.product_group_ids\[\] | Um ou mais IDs controlados pelo catálogo. |
| Product Subgroup | applicability.product_subgroup_ids\[\] | Um ou mais IDs; pode relacionar a norma a vários tipos de produto. |
| Link | document_location.online_url | URL opcional mantida para uso futuro. |
| Arquivo local | document_location.file_path | Obrigatório para normas internas; opcional para internacionais. |
| Categoria | classification.internal_category | test, material, design, measurement ou manufacturing. |
| Origem | classification.origin | internal, international ou customer. |
| Organização | classification.organization | MAHLE ou organismo internacional aplicável. |

## 4.3 Regras de arquivo

- Normas internas só podem ser salvas após seleção de arquivo local.
- Extensões aceitas inicialmente: .pdf, .doc e .docx.
- O seletor de arquivos grava o caminho escolhido; o nome físico não precisa seguir convenção específica.
- O campo file_name pode ser derivado automaticamente do caminho para exibição e diagnóstico.
- Normas internacionais podem ter file_path e file_name nulos.
- O sistema deve validar a existência do arquivo ao tentar abri-lo, não apenas no momento do cadastro.

## 4.4 Atualização de norma

1.  O usuário seleciona uma aparição da norma no grafo e aciona “Atualizar norma”.

2.  O formulário abre com os metadados vigentes.

3.  O usuário seleciona o novo arquivo e atualiza revisão, código, título ou demais campos quando necessário.

1.  O sistema substitui o caminho vigente e mantém o UUID.
1.  As ligações e todas as aparições visuais continuam apontando para o mesmo cadastro.
1.  O sistema atualiza updated_at, sem criar um novo indivíduo.

Não será mantido histórico de revisões nem caminho de arquivos obsoletos. O aplicativo representa apenas a versão vigente.

## 4.5 Mudança de Document No

Se o Document No for alterado durante uma atualização, a interface deve exibir uma caixa opcional para acrescentar o código anterior em previous_document_numbers. Se a caixa estiver desmarcada, o código anterior não é preservado. Duplicatas devem ser evitadas.

Document No foi alterado:  
☑ Adicionar "DSGN-372" aos nomes anteriores

## 4.6 Relocalização de arquivo

Deve existir uma operação separada para corrigir apenas o caminho quando o arquivo foi movido. Relocalizar não altera revisão, código ou quaisquer ligações. Se o caminho não for encontrado, a interface deve informar o endereço registrado e oferecer “Localizar arquivo”.

## 4.7 Exemplo de cadastro

{  
"schema_version": "1.0",  
"standard": {  
"id": "6ebea18d-7eb3-4ca7-814d-87f1cf988d24",  
"identification": {  
"document_no": "DSGN-372",  
"revision_no": "12.0",  
"title": "Design requirements for metallic components used in fluid filtration systems",  
"previous_document_numbers": \["MMS-123 (EN)"\]  
},  
"classification": {  
"origin": "internal",  
"internal_category": "design",  
"organization": "MAHLE",  
"customer_id": null  
},  
"applicability": {  
"product_group_ids": \["FLUID-SYSTEMS-AIR", "FLUID-SYSTEMS-LIQUID"\],  
"product_subgroup_ids": \["OIL-FILTER-ELEMENTS", "FUEL-FILTER-ELEMENTS"\]  
},  
"document_location": {  
"online_url": "https://example.company/standards/DSGN-372",  
"file_path": "\\server\standards\design\DSGN-372.pdf",  
"file_name": "DSGN-372.pdf"  
},  
"record_control": {  
"created_at": "2026-10-21T08:30:00-03:00",  
"updated_at": "2026-10-21T08:30:00-03:00",  
"status": "active"  
}  
}  
}

# 5. Taxonomia de produtos

O projeto terá um nível hierárquico acima das normas: o tipo de produto. Grupos e subgrupos descrevem aplicabilidade; o tipo de produto é a raiz visível. Uma norma pode possuir vários grupos e subgrupos e pode participar de mais de um produto.

Product Group → Product Subgroup → Product Type → normas de primeiro nível

O vínculo visual de primeiro nível não deve ser inferido exclusivamente de Product Group ou Product Subgroup. Ele deve ser cadastrado explicitamente em product_standard_relations. A taxonomia informa aplicabilidade; a relação informa a entrada concreta da árvore.

## 5.1 Estrutura sugerida da taxonomia

{  
"product_groups": \[  
{"id": "FLUID-SYSTEMS-AIR", "name": "Fluid Systems Air"}  
\],  
"product_subgroups": \[  
{  
"id": "AIR-FILTER-ELEMENTS",  
"name": "Air filter elements",  
"product_group_ids": \["FLUID-SYSTEMS-AIR"\],  
"product_type_ids": \["PRODUCT-AIR-FILTER-ELEMENT"\]  
}  
\]  
}

# 6. Ligações

## 6.1 Significado único

Todas as ligações norma-norma têm o mesmo significado estrutural: a norma de origem chama, cita ou contém referência à norma de destino. Não devem existir tipos semânticos como references, requires ou complements.

source_standard_id → target_standard_id

## 6.2 Força da ligação

| **Força** | **Interpretação local** | **Efeito visual esperado** |
|----|----|----|
| 3 | Alta importância do destino dentro da origem. | Galho principal; maior centralidade dentro do setor; prioridade de espaço e expansão. |
| 2 | Importância intermediária. | Galho intermediário; posição e destaque moderados. |
| 1 | Baixa importância relativa. | Galho periférico; deslocado para cantos/extremidades; menor prioridade visual. |

A força pertence à ligação, não à norma. A mesma norma pode ser força 3 em uma origem e força 1 em outra. A força é discreta, limitada aos inteiros 1, 2 e 3, e não modifica o tamanho do nó.

## 6.3 Profundidade radial versus força

| **Conceito** | **Origem** | **Controla** |
|----|----|----|
| Profundidade radial | Calculada pelo caminho desde o produto. | Anel/distância radial e, se desejado, tamanho padronizado do nível. |
| Força da ligação | Definida manualmente em cada aresta. | Centralidade angular, prioridade de espaço, destaque da aresta e expansão. |

## 6.4 Relações produto-norma

As relações de entrada definem quais normas aparecem diretamente no produto e como entram na visualização. TEST, MATL e DSGN entram em radial_branch; MEAS e MNFG entram em island.

{  
"id": "7f586718-3d7d-40a3-982e-ce16378d3c2d",  
"product_id": "PRODUCT-OIL-FILTER-ELEMENT",  
"standard_id": "id-DSGN-372",  
"placement": "radial_branch",  
"branch": "design",  
"strength_level": 3,  
"display_order": 1  
}

## 6.5 Relações norma-norma

{  
"id": "26554bb3-d557-4d93-85b1-566b115f9b80",  
"source_standard_id": "id-DSGN-372",  
"target_standard_id": "id-TEST-55",  
"strength_level": 3  
}

## 6.6 IDs das ligações

Cada ligação recebe UUID próprio gerado automaticamente. Isso permite editar ou excluir uma ligação específica sem depender de nomes. Alterar a força edita a ligação existente; não se cria uma segunda aresta para o mesmo par origem-destino.

## 6.7 Validações

- Origem e destino devem existir no catálogo.
- Origem e destino não podem ser o mesmo cadastro.
- Força deve ser 1, 2 ou 3.
- A combinação origem-destino não pode ser duplicada.
- Em placement = radial_branch, branch é obrigatório.
- Em placement = island, island é obrigatório.
- Remover uma ligação nunca remove o cadastro da norma.
- Remover uma norma de um produto remove apenas a relação de entrada.

# 7. Renderização radial

## 7.1 Composição principal

- O tipo de produto permanece fixo no centro.
- TEST, MATL e DSGN ocupam setores radiais distintos.
- Normas de primeiro nível são obtidas das relações produto-norma.
- Descendentes são obtidos recursivamente das relações norma-norma.
- Todos os círculos de uma mesma profundidade devem ter o mesmo tamanho.
- O tamanho expressa profundidade, nunca importância.
- A força organiza o posicionamento local em galhos principais e menores.

## 7.2 Algoritmo conceitual

1.  Carregar o produto selecionado e criar a raiz central.
1.  Carregar suas relações produto-norma.
1.  Separar entradas entre setores TEST/MATL/DSGN e ilhas MEAS/MNFG.
1. Em cada origem, agrupar filhos por força 3, 2 e 1.
1. Reservar a faixa principal do galho aos filhos de força 3.
1. Distribuir força 2 em regiões intermediárias.
1. Deslocar força 1 para extremidades e cantos disponíveis.
1. Repetir a mesma lógica para cada filho expandido.
1. Aplicar prevenção de colisão sem alterar o significado das forças.
1. Criar instâncias visuais repetidas quando o mesmo standard_id surgir em caminhos diferentes.

## 7.3 Repetição visual obrigatória

Não deve existir a regra de um único círculo por standard_id. Com centenas de normas, convergir todas as referências para um único nó geraria arestas longas, cruzamentos e perda de legibilidade. Cada caminho pode criar uma nova instância visual da mesma norma.

DSGN-372 → TEST-55 → ISO 9227  
MATL-123 → TEST-55 → ISO 9227  
TEST-81 → ISO 9227

As três aparições de ISO 9227 compartilham o mesmo cadastro, mas possuem instance_id, pai, profundidade e força locais distintos.

## 7.4 Instâncias visuais

{  
"instance_id": "node-instance-000145",  
"standard_id": "std-iso-9227",  
"parent_instance_id": "node-instance-000122",  
"depth": 3,  
"strength_level": 3  
}

Instâncias visuais são transitórias e podem ser geradas em memória. Não devem duplicar os metadados do cadastro nem ser tratadas como novas normas.

## 7.5 Ciclos

Ciclos são permitidos por poderem representar dependências reais. A prevenção de expansão infinita deve considerar os IDs já presentes no caminho atual, não no grafo inteiro.

Se target_standard_id já apareceu no caminho atual:  
1. desenhar a instância terminal e a aresta;  
2. não expandir seus filhos novamente;  
3. opcionalmente marcar a instância como retorno/ciclo.

Ao cadastrar uma ligação que cria ciclo, a interface deve alertar e permitir manter ou cancelar.

# 8. Ilhas MEAS e MNFG

MEAS e MNFG devem aparecer em ilhas periféricas independentes. As ilhas não possuem linhas diretas ligando-as às ramificações principais, mesmo quando uma norma de ilha é chamada por uma norma do grafo radial.

## 8.1 Duplicação entre ilha e ramificação

Quando uma norma MEAS ou MNFG é chamada dentro de uma ramificação, ela deve aparecer como uma nova instância dentro daquele galho. A cópia da ilha permanece no lugar e não recebe linha de conexão com essa instância.

Ilha MEAS: MEAS-120 (instância independente)  
Ramificação DSGN: DSGN-372 → MEAS-120 (nova instância)

A instância dentro do galho mantém identificação visual própria de MEAS ou MNFG, por cor, forma, ícone, borda ou combinação desses recursos.

## 8.2 Força dentro das ilhas

A força das relações produto-ilha pode orientar a centralidade dentro da própria ilha. Relações norma-norma continuam usando força 1, 2 ou 3 quando uma norma de ilha aparece em uma ramificação.

# 9. Normas internacionais

Normas internacionais são entidades completas do grafo, porém não fazem parte do banco local de documentos. Seu cadastro deve aceitar ausência de arquivo e seu nó deve aparecer normalmente como descendente da norma que a cita.

| **Regra** | **Norma interna** | **Norma internacional** |
|----|----|----|
| Arquivo local | Obrigatório | Opcional |
| Extensões | PDF, DOC, DOCX | PDF, DOC, DOCX se houver |
| Abertura | Habilitada quando o caminho existe | Desabilitada quando não houver caminho |
| Metadados mínimos | Document No, Revision No, Title, categoria, aplicabilidade e arquivo | Document No, Revision No, Title e organização |
| Posição | Setor ou ilha conforme categoria | Descendente da norma que a chama |

## 9.1 Cadastro rápido

Ao criar uma ligação para uma norma internacional ainda inexistente, a interface poderá oferecer um formulário reduzido. Após salvar, o UUID é gerado, a entidade passa ao catálogo e pode ser reutilizada por outras relações.

- Document No
- Revision No
- Title
- Organization
- Link online opcional

# 10. Normas de cliente

Normas de cliente não aparecerão no grafo atual e não participarão do dataset de ligações desta versão. A propriedade origin = customer pode ser reservada no modelo, mas a implementação visual e suas regras serão definidas posteriormente em outro grafo.

# 11. Organização dos arquivos JSON

/data  
├── catalog.json  
├── product_types.json  
├── product_taxonomy.json  
├── relations.json  
├── layout.json  
├── products/  
│ ├── OIL-FILTER-ELEMENT.json  
│ └── AIR-FILTER-ELEMENT.json  
├── standards/  
│ ├── \<uuid-1\>.json  
│ ├── \<uuid-2\>.json  
│ └── \<uuid-3\>.json  
└── customers/  
└── reservado para implementação futura

| **Arquivo** | **Responsabilidade** |
|----|----|
| catalog.json | Índice leve para pesquisa e carregamento dos cadastros. |
| product_types.json | Índice das raízes de produto disponíveis. |
| product_taxonomy.json | Grupos, subgrupos e correlações com tipos de produto. |
| relations.json | Relações produto-norma e norma-norma. |
| layout.json | Regras visuais, cores, formas, setores, tamanhos por profundidade e parâmetros de espaçamento. |
| products/\*.json | Metadados específicos de cada tipo de produto, se necessários. |
| standards/\*.json | Cadastro completo e vigente de cada norma, preferencialmente nomeado pelo UUID. |

## 11.1 Dataset consolidado de relações

{  
"schema_version": "1.0",  
"product_standard_relations": \[  
{  
"id": "rel-product-1",  
"product_id": "PRODUCT-OIL-FILTER-ELEMENT",  
"standard_id": "id-DSGN-372",  
"placement": "radial_branch",  
"branch": "design",  
"strength_level": 3,  
"display_order": 1  
},  
{  
"id": "rel-product-2",  
"product_id": "PRODUCT-OIL-FILTER-ELEMENT",  
"standard_id": "id-MEAS-120",  
"placement": "island",  
"island": "measurement",  
"strength_level": 2,  
"display_order": 1  
}  
\],  
"standard_standard_relations": \[  
{  
"id": "rel-standard-1",  
"source_standard_id": "id-DSGN-372",  
"target_standard_id": "id-TEST-55",  
"strength_level": 3  
},  
{  
"id": "rel-standard-2",  
"source_standard_id": "id-TEST-55",  
"target_standard_id": "id-ISO-9227",  
"strength_level": 3  
}  
\]  
}

# 12. Funcionalidades de interface

## 12.1 Cadastro de nova norma

1. Acionar “Cadastrar norma”.
1. Gerar UUID automaticamente.
1. Preencher os campos obrigatórios.
1. Exigir arquivo para origem internal; permitir ausência para international.
1. Validar unicidade e consistência.
1. Salvar o cadastro e atualizar o catálogo.
1. Disponibilizar a norma para associação a produtos e ligações.

## 12.2 Ações a partir do nó

- Abrir norma: abre o arquivo vigente quando disponível.
- Ver detalhes: mostra metadados independentemente de arquivo.
- Atualizar norma: substitui arquivo vigente e permite editar metadados, preservando UUID.
- Relocalizar arquivo: altera somente o caminho.
- Adicionar ligação: cria destino e força a partir da norma selecionada.
- Editar ligações: altera força ou destino conforme validações.
- Remover ligação: exclui a aresta sem excluir a norma.

## 12.3 Pesquisa e seleção

A pesquisa de normas deve considerar Document No atual, Title e previous_document_numbers. A seleção de destino deve mostrar informações suficientes para evitar duplicidade, especialmente entre normas internacionais recorrentes.

# 13. Regras de integridade

| **Regra** | **Comportamento obrigatório** |
|----|----|
| UUID da norma | Gerado uma vez; imutável. |
| UUID da ligação | Gerado automaticamente; usado para edição/exclusão precisa. |
| Document No | Texto livre não vazio; pode mudar. |
| Revision No | String não vazia; não converter para número. |
| Arquivo interno | Obrigatório no cadastro; validar ao abrir. |
| Arquivo internacional | Opcional. |
| Ligação duplicada | Bloquear mesma origem e destino. |
| Autorrelação | Bloquear origem igual ao destino. |
| Força | Aceitar apenas 1, 2 ou 3. |
| Ciclo | Alertar; permitir; interromper expansão no caminho. |
| Exclusão de relação | Nunca excluir cadastro ou arquivo. |
| Repetição visual | Permitir por caminho; compartilhar standard_id. |
| Versões anteriores | Não manter histórico de arquivos/revisões. |
| Nome anterior | Manter somente quando usuário optar na atualização. |

# 14. Critérios de aceite da primeira versão

- É possível cadastrar uma norma interna somente após selecionar PDF, DOC ou DOCX.
- É possível cadastrar uma norma internacional sem arquivo.
- O sistema gera UUID automaticamente e o preserva em atualizações.
- É possível atualizar arquivo, revisão e código sem quebrar relações.
- A caixa de preservação do código anterior funciona sem duplicar valores.
- É possível cadastrar tipos de produto e associar normas de primeiro nível.
- O grafo mantém o produto no centro e separa TEST, MATL e DSGN em setores.
- MEAS e MNFG aparecem em ilhas sem linhas para as ramificações.
- Uma norma de ilha citada em um galho ganha uma instância no galho e permanece na ilha.
- As ligações aceitam forças 1, 2 e 3 e o layout reflete a centralidade relativa.
- Uma mesma norma pode aparecer repetidamente em diferentes caminhos.
- Clicar em qualquer aparição abre o mesmo cadastro lógico.
- Ciclos são desenhados sem expansão infinita.
- Remover uma aresta não exclui a norma.
- Normas de cliente não aparecem no grafo.

# 15. Decisões deliberadamente abertas

Os pontos abaixo ainda não foram fixados e devem ser tratados como decisões futuras, sem contrariar os princípios deste contrato:

- Paleta final, ícones e tipografia institucional.
- Política de expansão e recolhimento por clique quando o grafo real estiver carregado.
- Número máximo de níveis simultaneamente visíveis antes de aplicar carregamento progressivo.
- Estratégia final de backup, concorrência e recuperação dos JSONs em pasta de rede.
- Implementação do grafo separado para normas de cliente.
- Importação em lote e leitura automática de metadados dos documentos.
- Eventual migração futura do Canvas 2D para WebGL, somente caso medições reais de desempenho indiquem necessidade.

# 16. Convenções para implementação

- Usar snake_case nas propriedades JSON.
- Armazenar datas em ISO 8601 com fuso quando houver horário.
- Armazenar revisões como string.
- Não usar Document No, título, arquivo ou caminho como chave estrangeira.
- Resolver todas as relações por UUID.
- Não persistir coordenadas de instâncias visuais como verdade de negócio.
- Manter schema_version nos arquivos para futuras migrações.
- Evitar dados derivados duplicados quando puderem ser calculados com segurança.
- Validar referências quebradas ao carregar o dataset e produzir diagnóstico claro.

# 17. Glossário

| **Termo** | **Definição** |
|----|----|
| Norma | Entidade cadastrada uma única vez, identificada por UUID. |
| Document No | Código oficial vigente; livre e alterável. |
| Prev Document No | Código anterior preservado opcionalmente. |
| Raiz | Tipo de produto posicionado no centro. |
| Setor | Área radial de TEST, MATL ou DSGN. |
| Ilha | Área periférica independente de MEAS ou MNFG. |
| Ligação | Aresta direcionada entre produto e norma ou entre duas normas. |
| Força | Nível local 1, 2 ou 3 que orienta centralidade do galho. |
| Profundidade | Número de arestas desde o produto até a instância. |
| Instância visual | Aparição temporária de uma norma em um caminho específico. |
| Ciclo | Caminho que retorna a uma norma já presente no mesmo percurso. |
| Cadastro vigente | Única representação mantida da revisão atualmente válida. |

# 18. Arquitetura tecnológica oficial da primeira versão

## 18.1 Stack definida

A primeira versão será uma aplicação desktop híbrida baseada em:

```text
Python 3.12
+
pywebview
+
Microsoft Edge WebView2
+
HTML
+
CSS
+
JavaScript puro
+
Canvas 2D
+
JSON
+
PyInstaller
```

Não haverá dependência de Node.js, npm, React, Electron, Tauri, Rust, Cargo, C# ou compilador JavaScript. O JavaScript será interpretado diretamente pelo WebView2.

## 18.2 Responsabilidades

### Backend Python

- gerar e preservar UUIDs;
- validar e persistir cadastros;
- ler e gravar os arquivos JSON;
- abrir os documentos vigentes;
- fornecer seletor nativo de arquivos;
- validar caminhos e extensões;
- criar, atualizar e remover relações;
- realizar backups e diagnóstico de integridade;
- expor somente operações controladas para o frontend.

### pywebview

- criar a janela desktop;
- hospedar o frontend local;
- expor a API Python em `window.pywebview.api`;
- transportar dados simples entre JavaScript e Python;
- utilizar o WebView2 como mecanismo de renderização.

### Frontend HTML, CSS e JavaScript

- construir a interface e os formulários;
- gerenciar o estado visual da sessão;
- desenhar o grafo no Canvas 2D;
- executar zoom, pan, hover, seleção e animações;
- gerar instâncias visuais repetíveis sem duplicar cadastros;
- solicitar operações ao backend sem editar diretamente os JSONs.

## 18.3 Regras da ponte Python-JavaScript

A API deve expor métodos específicos, como:

```text
get_products()
get_product_graph(product_id)
get_standard(standard_id)
create_standard(payload)
update_standard(standard_id, payload)
select_standard_file()
open_standard_file(standard_id)
create_relation(payload)
update_relation(relation_id, payload)
delete_relation(relation_id)
validate_database()
```

São proibidos métodos genéricos que permitam executar comandos, avaliar código ou acessar arquivos arbitrários.

## 18.4 Ambiente do projeto

O projeto utiliza um ambiente virtual Python 3.12 localizado em `.venv`. A execução recomendada não depende da ativação do PowerShell:

```powershell
cd C:\Users\M0242198\NormasGraph\NormasGraph
.\.venv\Scripts\python.exe .\app.py
```

## 18.5 Empacotamento

A distribuição será feita inicialmente com PyInstaller em modo `onedir`, incluindo frontend, dados, configurações e recursos visuais. O modo `onefile` só deverá ser avaliado após estabilização do aplicativo.

# 19. Especificação visual da fractal tree

## 19.1 Pilar estético

A estética é um pilar funcional do produto. O grafo não deve parecer um organograma, uma árvore radial rígida ou um leque formado por anéis concêntricos. A referência formal é uma árvore fractal com tronco comum, bifurcações locais sucessivas e copa contínua aproximadamente semicircular.

A visualização deve combinar:

- clareza técnica;
- aparência orgânica;
- animações suaves;
- profundidade visual;
- identidade cromática por família;
- leitura possível mesmo em regiões densas;
- zoom amplo sem perda de nitidez.

## 19.2 Terminologia visual

Cada representação circular de uma norma será denominada **célula**.

```text
Cadastro lógico da norma → entidade única identificada por UUID
Célula                   → instância visual daquela norma em um caminho
Galho                    → aresta entre duas células
Família                  → TEST, MATL ou DSGN a partir da raiz do produto
Copa                     → conjunto dos níveis externos das três famílias
```

## 19.3 Estrutura da copa

- O tipo de produto permanece como raiz.
- TEST, MATL e DSGN partem da raiz com cores distintas.
- As três famílias devem formar visualmente uma copa única e contínua.
- Pode haver corredores discretos entre as famílias, mas não três árvores isoladas.
- Cada célula descende geometricamente da célula-pai, não de um anel global.
- A direção do filho deriva majoritariamente da direção do galho-pai.
- A abertura das bifurcações diminui progressivamente com a profundidade.
- A distância entre níveis deve decrescer, sem saltos grandes em níveis externos.

## 19.4 Cores

As famílias mantêm as seguintes bases cromáticas iniciais:

```text
TEST  → magenta/coral
MATL  → verde/turquesa
DSGN  → azul/índigo
```

A cor-base representa a família visual de origem. A profundidade deve aplicar um gradiente sutil dentro da própria família. Níveis externos podem ficar levemente mais claros e menos saturados, sem perder reconhecimento cromático.

A categoria real de uma norma que aparece dentro de outra família poderá ser indicada futuramente por forma, ícone ou marcador secundário.

## 19.5 Tamanho adaptativo das células

O tamanho de uma célula depende de:

```text
profundidade
+
quantidade de células naquele nível dentro da família
```

Regras:

- células externas devem ser progressivamente menores;
- níveis mais densos devem reduzir levemente todas as células daquele nível;
- células do mesmo nível e da mesma família seguem a mesma função de tamanho;
- deve existir raio mínimo para seleção;
- o zoom amplo permite células externas pequenas;
- força da ligação não altera o tamanho da célula.

Modelo funcional conceitual:

```text
raio = raio_base × decaimento_profundidade × ajuste_densidade
```

## 19.6 Comprimento dos galhos

O comprimento de cada novo galho deve diminuir conforme a profundidade:

```text
comprimento = comprimento_inicial × decaimento elevado à profundidade
```

A densidade pode aplicar somente uma correção moderada. A correção nunca deve criar uma distância entre níveis externos maior que a dos níveis internos.

## 19.7 Força e abertura angular

A força permanece local à ligação:

```text
Força 3 → eixo principal, menor desvio angular, maior espessura
Força 2 → faixa intermediária
Força 1 → periferia do conjunto de filhos, maior desvio angular, menor espessura
```

A abertura deve ser derivativa:

```text
abertura_nível = abertura_base × fator_decaimento elevado à profundidade
```

Assim, cada bifurcação é uma versão menor da anterior e preserva o caráter fractal.

## 19.8 Resolução de colisões

Nenhuma célula pode se sobrepor ou encostar em outra. A verificação deve considerar todas as células, inclusive células de famílias diferentes.

O algoritmo deve:

1. calcular o raio ocupado pelas duas células;
2. incluir uma margem mínima de segurança;
3. afastar as células quando houver invasão;
4. mover mais facilmente células profundas e ligações fracas;
5. preservar melhor ligações fortes e células próximas à raiz;
6. restaurar suavemente comprimento e direção da árvore após cada iteração;
7. manter cada família dentro de seu corredor cromático;
8. reduzir células por função de densidade antes de expandir exageradamente a árvore.

A correção de colisões não pode transformar a árvore em anéis, colunas, leques rígidos ou longos feixes paralelos.

## 19.9 Legibilidade das arestas

Para evitar que o grafo vire um emaranhado:

- arestas devem ser curvas de Bézier próximas ao percurso pai-filho;
- uma borda ou halo escuro deve ser desenhado sob cada aresta;
- ligações fortes devem ser visualmente superiores às fracas;
- a aresta deve surgir do centro ou da borda da célula-pai e terminar claramente na célula-filho;
- cruzamentos devem ser minimizados pelo layout antes de serem tratados graficamente;
- arestas não relacionadas podem reduzir opacidade durante seleção;
- o caminho selecionado deve ganhar contraste superior.

## 19.10 Seleção de células

Ao selecionar uma célula:

- a célula selecionada recebe borda branca;
- todos os filhos do nível imediatamente seguinte recebem aro externo de destaque;
- a cor inicial do aro dos filhos será amarelo-dourado;
- as arestas entre a célula selecionada e os filhos ficam brancas e mais espessas;
- demais arestas permanecem em segundo plano;
- o painel de detalhes deverá refletir o `standard_id` da célula selecionada.

O destaque não se propaga automaticamente aos netos.

## 19.11 Zoom e navegação

- zoom centralizado no cursor;
- movimentação por arraste;
- limite de aproximação suficientemente alto para ler células externas;
- limite atual de referência: `80x`;
- duplo clique restaura o enquadramento completo;
- o Canvas deve manter nitidez considerando `devicePixelRatio`;
- zoom e pan alteram a câmera, nunca as coordenadas lógicas do grafo.

## 19.12 Camadas de renderização

A ordem recomendada é:

```text
1. Fundo com gradiente escuro
2. Halos escuros das arestas
3. Arestas fracas
4. Arestas intermediárias
5. Arestas fortes
6. Células
7. Aros de filhos imediatos
8. Borda da célula selecionada
9. Textos
10. Tooltip e interface fixa
```

## 19.13 Regras para nomes

- todas as células devem conter o `Document No` atual;
- nenhum nível pode ocultar nomes por regra fixa;
- a fonte pode diminuir conforme o raio;
- o texto deve permanecer dentro da célula;
- o nome completo e demais metadados serão exibidos no tooltip e no painel lateral;
- em zoom distante, a legibilidade física pode reduzir, mas o conteúdo permanece desenhado e torna-se legível ao aproximar.

## 19.14 Ilhas MEAS e MNFG

As ilhas permanecem fora da copa principal. Uma norma MEAS ou MNFG citada em uma ramificação recebe uma instância própria dentro daquela ramificação, mantendo simultaneamente a instância independente da ilha. Não existe linha entre a instância da ilha e a cópia do galho.

## 19.15 Estado atual do protótipo

O protótipo alcançou o marco MVP 04, com:

- janela desktop pywebview/WebView2 funcional;
- comunicação JavaScript-Python validada;
- Canvas 2D funcional;
- zoom, pan, hover e seleção;
- dados demonstrativos TEST, MATL e DSGN;
- tamanho adaptativo por profundidade e densidade;
- bifurcações derivativas;
- prevenção iterativa de colisões;
- halo sob as arestas;
- gradiente cromático por profundidade;
- destaque da célula selecionada e dos filhos imediatos.

A geometria ainda deve continuar sendo refinada com dados reais, especialmente para minimizar cruzamentos e controlar densidade quando relações reais produzirem árvores assimétricas.

# 20. Síntese para continuidade

Um agente programador que assumir o projeto deve iniciar pelo modelo de domínio, não pelo desenho. Primeiro, implementar a identidade permanente das normas, os cadastros vigentes, a taxonomia e os dois datasets de ligações. Em seguida, gerar uma estrutura de instâncias visuais a partir de um produto, respeitando repetição por caminho e bloqueio de ciclos. Somente depois deve acoplar o algoritmo radial e as regras de ilhas.

A invariável central é: o cadastro representa a norma; a relação representa a dependência; a instância representa uma aparição. Se essa separação for preservada, nomes, revisões, arquivos e layouts poderão evoluir sem romper a integridade do grafo.

# Anexo A — Fluxo de dados

Seleção do produto  
↓  
product_standard_relations  
↓  
instâncias de nível 1 por setor/ilha  
↓  
standard_standard_relations  
↓  
instâncias descendentes repetíveis  
↓  
controle de ciclo por caminho  
↓  
layout radial orientado por força  
↓  
clique na instância → standard_id → cadastro → arquivo vigente

# Anexo B — Prioridade de implementação

1. Modelos e validações de Standard, Product e Relation.
1. Persistência dos JSONs e geração de UUIDs.
1. Telas de cadastro, edição, atualização e relocalização.
1. Pesquisa e seleção de normas.
1. Associação produto-norma e norma-norma.
1. Expansor de grafo com repetição por caminho e detecção de ciclos.
1. Layout radial dos setores principais.
1. Ilhas MEAS e MNFG e identificação visual de categorias.
1. Abertura de documentos e tratamento de caminho ausente.
1. Ferramentas de diagnóstico, consistência e backup.
