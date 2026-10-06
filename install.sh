#!/bin/bash
set -e

VERSION="v1.9.0"

echo "====================================================="
echo "  HealthHUD Installer & Updater - $VERSION"
echo "====================================================="
echo ""
echo "📋 Patch Notes ($VERSION):"
echo "  • VITALS & STEPS DASHBOARD ENHANCEMENTS:"
echo "    - 'Today's Steps': Left side now highlights today's exact step count."
echo "    - 'This Week's Steps': Right side displays cumulative total week steps"
echo "      with a clear delta comparison against last week's total count."
echo "    - Last Weight Reading: Discrete timestamp under main weight showing"
echo "      the exact date and time the latest reading was taken."
echo "  • WITHINGS SYNC & TROUBLESHOOTING TRANSPARENCY:"
echo "    - Dissected sync footer: Displays both 'Last Sync Attempt' and"
echo "      'Last Weight Data Line Added' (exact date & time of the latest data line)."
echo "    - Smart Scale Ingestion Fix: Upgraded Withings API query to 30-day window"
echo "      with strict weight measure filtering (type: 1) so scale weigh-ins are"
echo "      never missed or eclipsed by body composition metrics."
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
