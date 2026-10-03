# HealthHUD

HealthHUD is a comprehensive, locally-hosted dashboard for aggregating, visualizing, and gamifying your personal health data. It supports automated data ingestion from Apple Health (via Health Auto Export) and Withings smart scales.

## 🚀 One-Line Installation (CasaOS / Ubuntu)

The absolute easiest way to install HealthHUD on a fresh server or CasaOS environment is via our automated install script.

Open your server's Terminal and run:
```bash
curl -sSL https://raw.githubusercontent.com/ProdeaGG/HealthHUD/main/install.sh | bash
```

**What this script does:**
1. Automatically creates the `/DATA/AppData/HealthHUD` folder.
2. Clones the latest version of the repository from GitHub.
3. Automatically builds and launches the Docker container in the background.

*Once installed, the app will appear on your CasaOS dashboard. (If clicking the icon doesn't open the page, click the 3 dots on the app > Settings > and set the Web UI port to `3000`).*

## 🔄 How to Update
To update to the latest version of HealthHUD without losing any of your data, simply run the exact same `curl` command above! The script will automatically detect your existing installation, pull the newest code, and restart the server while keeping your SQLite database perfectly intact.

## ⚙️ Manual Docker Installation
If you prefer to install manually via Docker Compose:
1. `git clone https://github.com/ProdeaGG/HealthHUD.git`
2. `cd HealthHUD`
3. `docker compose up -d --build`
