"""
Flask app: simplified coaching homework API.
Backend for Willab — deploy to Railway.
"""
import os
from flask import Flask
from flask_cors import CORS
from config import Config
from routes.homework_v2 import bp as homework_bp
from routes.admin_v2 import bp as admin_bp

app = Flask(__name__)
app.config.from_object(Config)
CORS(app, origins=os.environ.get("CORS_ORIGINS", "").split(",") or ["*"])

app.register_blueprint(homework_bp)
app.register_blueprint(admin_bp)


@app.route("/health")
def health():
    return {"status": "ok"}


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.environ.get("PORT", 5000)))
