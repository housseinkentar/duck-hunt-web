from flask import Flask, send_from_directory

app = Flask(__name__, static_folder="public", static_url_path="")

@app.get("/")
def home():
    return send_from_directory("public", "index.html")

@app.get("/<path:path>")
def static_files(path):
    return send_from_directory("public", path)
