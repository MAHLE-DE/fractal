let applicationStarted = false;

async function startApplication() {
    if (applicationStarted) return;

    const status = document.getElementById("status");

    if (!window.pywebview || !window.pywebview.api) {
        status.textContent = "Aguardando API Python...";
        return;
    }

    applicationStarted = true;

    try {
        status.textContent = "Carregando dados do Python...";

        const env = await window.pywebview.api.environment_status();
        const graph = await window.pywebview.api.get_demo_graph();

        if (typeof FractalLayout !== "function") {
            throw new Error("FractalLayout não foi carregado.");
        }

        if (typeof CanvasRenderer !== "function") {
            throw new Error("CanvasRenderer não foi carregado.");
        }

        const layout = new FractalLayout();
        const renderer = new CanvasRenderer(
            document.getElementById("graphCanvas"),
            document.getElementById("tooltip")
        );

        renderer.setTree(layout.build(graph));
        renderer.start();

        window.normasGraphRenderer = renderer;
        status.textContent = `${env.backend} · ${env.frontend} · conectado`;
    } catch (error) {
        applicationStarted = false;
        status.textContent = `Erro: ${error.message || error}`;
        console.error("Falha ao iniciar aplicação:", error);
    }
}

window.addEventListener("pywebviewready", startApplication);
document.addEventListener("DOMContentLoaded", startApplication);

const apiWaitTimer = setInterval(() => {
    if (window.pywebview && window.pywebview.api) {
        clearInterval(apiWaitTimer);
        startApplication();
    }
}, 100);

setTimeout(() => {
    clearInterval(apiWaitTimer);

    if (!applicationStarted) {
        const status = document.getElementById("status");
        status.textContent = "API Python indisponível";
        console.error("window.pywebview.api não ficou disponível em 10 segundos.");
    }
}, 10000);
