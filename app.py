from pathlib import Path
import webview
from backend.api import ApplicationApi

BASE_DIR = Path(__file__).resolve().parent
FRONTEND = BASE_DIR / "frontend" / "index.html"

if __name__ == "__main__":
    api = ApplicationApi(BASE_DIR)

    webview.create_window(
        title="Normas Graph",
        url=FRONTEND.as_uri(),
        js_api=api,
        width=1440,
        height=900,
        min_size=(1000, 650),
        background_color="#050816",
        resizable=True,
    )

    webview.start(gui="edgechromium", debug=True)
