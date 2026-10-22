from datetime import datetime

class ApplicationApi:
    def __init__(self, base_dir):
        self.base_dir = base_dir

    def environment_status(self):
        return {
            "success": True,
            "backend": "Python 3.12",
            "frontend": "WebView2",
            "timestamp": datetime.now().isoformat(timespec="seconds")
        }

    def get_demo_graph(self):
        return {
            "product": {"id": "PRODUCT-DEMO", "name": "Product Type"},
            "branches": [
                {"category": "test", "color": "#ef4f8b"},
                {"category": "material", "color": "#25c6a1"},
                {"category": "design", "color": "#6677ff"}
            ]
        }
