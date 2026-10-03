#!/bin/bash
set -e

echo "====================================================="
echo " Starting HealthHUD Installation for CasaOS/Ubuntu"
echo "====================================================="

INSTALL_DIR="/DATA/AppData/HealthHUD"

# Ensure Git is installed
if ! command -v git &> /dev/null; then
    echo "Git is not installed. Installing git..."
    sudo apt-get update && sudo apt-get install -y git
fi

# Clone or Update the repository
if [ -d "$INSTALL_DIR" ]; then
    echo "HealthHUD directory already exists at $INSTALL_DIR."
    echo "Pulling latest updates from GitHub..."
    cd "$INSTALL_DIR"
    
    # Stash any local changes just in case, pull, and pop
    git stash
    git pull origin main
    git stash pop || true
else
    echo "Cloning HealthHUD repository to $INSTALL_DIR..."
    sudo mkdir -p /DATA/AppData
    cd /DATA/AppData
    sudo git clone https://github.com/ProdeaGG/HealthHUD.git
    cd HealthHUD
fi

echo "Building and starting Docker containers. This may take 1-3 minutes..."
sudo docker compose up -d --build

echo "====================================================="
echo " SUCCESS! HealthHUD has been installed and started."
echo "====================================================="
echo "It should now appear on your CasaOS dashboard."
echo ""
echo "NOTE: If the app icon on the CasaOS dashboard doesn't"
echo "work right away, click the 3 dots on the HealthHUD app,"
echo "go to 'Settings', and set the 'Web UI Port' to 3000."
echo "====================================================="
