# Correções futuras — Fractal Workspace

## Identificar e copiar o ID de uma norma

- Registrado em: 23/10/2026.
- Status: planejado; não implementado.
- Solicitação: facilitar a localização dos JSONs no banco sem precisar abrir cada arquivo.

Os arquivos `standards/<UUID>.json` usam o identificador permanente da norma. Embora chamado de “hash” na solicitação, esse identificador é um UUID, não um hash do conteúdo.

### Correção prevista

Exibir o UUID completo na área de detalhes da norma, identificada pelo código e título, com um botão para copiá-lo. Manter a interface em inglês, por exemplo `Standard ID` e `Copy ID`, e confirmar a cópia discretamente.

### Critérios de aceite

- Localizar uma norma no aplicativo e consultar seu UUID completo sem abrir o JSON.
- Copiar exatamente o UUID usado no nome do arquivo `standards/<UUID>.json`.
- Não renomear arquivos, regenerar identificadores nem modificar as relações existentes.
- Manter o identificador como informação secundária para não poluir a interface.
