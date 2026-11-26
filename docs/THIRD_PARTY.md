# Bibliotecas distribuídas

A prévia inclui GSAP 3.15.1, copyright GreenSock, sob a licença indicada
pelo pacote oficial: https://gsap.com/standard-license.
O código de desenho usa diretamente a API WebGL2 do navegador.
Vite, TypeScript e Playwright são ferramentas de desenvolvimento e não
precisam ser instalados no computador que abre a prévia.

D3 hierarchy é distribuído sob BSD-3-Clause; cópia em `licenses/D3-hierarchy-BSD.txt`.
Bricolage Grotesque, IBM Plex Sans e IBM Plex Mono são embutidos como WOFF2;
as três licenças OFL estão em `licenses/`. Não há carregamento de Google Fonts.

Cormorant Garamond (abertura "Loom.") é embutida como WOFF2, licença OFL em
`licenses/Cormorant-Garamond-OFL.txt`.
O executável inclui o runtime .NET 10 (MIT) e o Microsoft.Web.WebView2 SDK
(licença Microsoft do pacote NuGet); usa o WebView2 Runtime já presente no Windows.
