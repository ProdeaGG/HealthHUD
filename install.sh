#!/bin/bash
set -e

VERSION="v1.7.0"

echo "====================================================="
echo "  HealthHUD Installer & Updater - $VERSION"
echo "====================================================="
echo ""
echo "📋 Patch Notes ($VERSION):"
echo "  • NEW: Automated Withings Background Sync Daemon! The container"
echo "    now automatically pulls your latest weigh-ins from Withings"
echo "    every 15 minutes in the background."
echo "  • NEW: 'Sync Now 🔄' button in the dashboard footer for instant"
echo "    weight pulls right after stepping off the scale."
echo "  • NEW: Real-time Withings sync status indicator in the footer."
echo "  • Expanded measurement pull window to 14 days so missed weigh-ins"
echo "    are automatically backfilled."
echo "====================================================="
echo ""

INSTALL_DIR="/DATA/AppData/HealthHUD"

# Ensure Git is installed
if ! command -v git &> /dev/null; then
    echo "Git is not installed. Installing git..."
    sudo apt-get update && sudo apt-get install -y git
fi

# Whitelist directory for safe git operations
git config --global --add safe.directory "$INSTALL_DIR" 2>/dev/null || true
sudo git config --global --add safe.directory "$INSTALL_DIR" 2>/dev/null || true

# Clone or Update the repository
if [ -d "$INSTALL_DIR" ]; then
    echo "HealthHUD directory found at $INSTALL_DIR."
    echo "Pulling latest updates from GitHub..."
    cd "$INSTALL_DIR"
    
    # Stash any local changes just in case, pull, and pop
    sudo git stash || true
    sudo git pull origin main
    sudo git stash pop 2>/dev/null || true
else
    echo "Cloning HealthHUD repository to $INSTALL_DIR..."
    sudo mkdir -p /DATA/AppData
    cd /DATA/AppData
    sudo git clone https://github.com/ProdeaGG/HealthHUD.git
    cd HealthHUD
fi

echo ""
echo "Building and starting HealthHUD $VERSION containers..."
echo "This may take 1-3 minutes..."
sudo docker compose up -d --build

echo ""
echo "Waiting for HealthHUD to start, then showing its startup log..."
sleep 8
sudo docker logs --tail 25 healthhud || true

echo ""
echo "====================================================="
echo " SUCCESS! HealthHUD $VERSION is installed and running."
echo "====================================================="
echo "Access your dashboard at: http://<YOUR_SERVER_IP>:3000"
echo ""
echo "NOTE: If the app icon on the CasaOS dashboard doesn't"
echo "open directly, click the 3 dots on the HealthHUD app,"
echo "go to 'Settings', and set the 'Web UI Port' to 3000."
echo "====================================================="
