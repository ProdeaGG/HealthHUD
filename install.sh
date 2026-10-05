#!/bin/bash
set -e

VERSION="v1.8.0"

echo "====================================================="
echo "  HealthHUD Installer & Updater - $VERSION"
echo "====================================================="
echo ""
echo "📋 Patch Notes ($VERSION):"
echo "  • DATA INTEGRITY & DEDUPLICATION OVERHAUL:"
echo "    - Monotonic Daily Steps: Daily step counts now accumulate cleanly"
echo "      across multiple syncs without accidental double-counting."
echo "    - Composite Workout Deduplication: Workouts now track unique start"
echo "      timestamps and HealthKit UUIDs. Logging two separate sessions"
echo "      with identical durations correctly counts as 2 distinct workouts."
echo "    - Unified Weekly Consistency: Cardio sessions, minutes, and strength"
echo "      counts are strictly computed from unique verified workout records."
echo "  • REPOSITORY & DOCUMENTATION:"
echo "    - Full README overhaul for CasaOS, Proxmox VE, and Linux servers."
echo "    - Cleaned up repository structure and updated file descriptions."
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
