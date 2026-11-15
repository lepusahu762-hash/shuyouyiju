"""Start the existing local app with already installed dependencies (no downloads)."""

import argparse
import json
import os
from pathlib import Path
import shutil
import socket
import subprocess
import sys
import time
import urllib.error
import urllib.request
import webbrowser


ROOT = Path(__file__).resolve().parents[1]
WEB_URL = "http://127.0.0.1:5173/"
API_URL = "http://127.0.0.1:8000/openapi.json"
OPENER = urllib.request.build_opener(urllib.request.ProxyHandler({}))


def occupied(port):
    with socket.socket() as connection:
        connection.settimeout(1)
        return connection.connect_ex(("127.0.0.1", port)) == 0


def ready(url, backend=False):
    try:
        with OPENER.open(url, timeout=2) as response:
            body = response.read().decode("utf-8")
        if backend:
            return json.loads(body).get("info", {}).get("title") == "数有依据 API"
        return "数有依据" in body and 'id="root"' in body
    except (OSError, ValueError, urllib.error.URLError):
        return False


def start(name, command, directory, url, backend=False):
    if ready(url, backend):
        print(f"{name}: already running.")
        return
    port = 8000 if backend else 5173
    if occupied(port):
        raise RuntimeError(f"Port {port} is occupied but {name} is not responding. "
                           "Check the existing service; no process was stopped.")
    logs = ROOT / "artifacts" / "local-server"
    logs.mkdir(parents=True, exist_ok=True)
    environment = os.environ.copy()
    if not backend:
        environment["SYJ_API_TARGET"] = "http://127.0.0.1:8000"
    with (logs / f"{name}-launcher.log").open("ab") as log:
        process = subprocess.Popen(
            command, cwd=directory, env=environment, stdin=subprocess.DEVNULL,
            stdout=log, stderr=subprocess.STDOUT,
            creationflags=subprocess.CREATE_NO_WINDOW if os.name == "nt" else 0,
        )
    for _ in range(30):
        if process.poll() is not None:
            raise RuntimeError(f"{name} stopped. See {logs / (name + '-launcher.log')}")
        if ready(url, backend):
            print(f"{name}: ready.")
            return
        time.sleep(1)
    raise RuntimeError(f"{name} did not become ready in time. See {logs}")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--node", default=shutil.which("node"), help="Installed node executable")
    parser.add_argument("--no-browser", action="store_true")
    args = parser.parse_args()
    if not args.node or not Path(args.node).is_file():
        raise RuntimeError("Node.js not found. Specify --node with its executable path.")
    vite = ROOT / "frontend" / "node_modules" / "vite" / "bin" / "vite.js"
    if not vite.is_file():
        raise RuntimeError("Frontend dependencies missing. Follow NEW_MACHINE_SETUP.md first.")
    start("backend", [sys.executable, "-m", "uvicorn", "app.main:app", "--host",
                      "127.0.0.1", "--port", "8000"], ROOT / "backend", API_URL, True)
    start("frontend", [args.node, str(vite), "--host", "127.0.0.1", "--port",
                       "5173", "--strictPort"], ROOT / "frontend", WEB_URL)
    print(f"Ready: {WEB_URL}")
    if not args.no_browser and not webbrowser.open(WEB_URL):
        print("Open the URL above in your browser.")


if __name__ == "__main__":
    try:
        main()
    except (OSError, RuntimeError) as error:
        print(f"Startup failed: {error}", file=sys.stderr)
        sys.exit(1)
