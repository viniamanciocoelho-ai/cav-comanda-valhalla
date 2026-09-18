"""Descoberta portatil do navegador usado pelas suites Playwright."""

import os
import shutil
from pathlib import Path


def launch_options() -> dict[str, object]:
    candidatos = [
        os.environ.get("PLAYWRIGHT_BROWSER_PATH"),
        shutil.which("google-chrome"),
        shutil.which("google-chrome-stable"),
        shutil.which("chromium"),
        shutil.which("chromium-browser"),
        shutil.which("msedge"),
        r"C:\Program Files\Google\Chrome\Application\chrome.exe",
        r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
        r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
        "/usr/bin/google-chrome",
        "/usr/bin/google-chrome-stable",
        "/usr/bin/chromium",
        "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
        "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
    ]
    executavel = next(
        (str(Path(candidato)) for candidato in candidatos if candidato and Path(candidato).is_file()),
        None,
    )
    opcoes: dict[str, object] = {
        "args": ["--no-sandbox", "--disable-dev-shm-usage"],
    }
    if executavel:
        opcoes["executable_path"] = executavel
    return opcoes
