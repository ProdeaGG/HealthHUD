# HealthHUD ⚡
### The Self-Hosted Personal Health & Fitness Command Center

[![Docker](https://img.shields.io/badge/Docker-Containerized-blue?logo=docker&logoColor=white)](https://www.docker.com/)
[![CasaOS](https://img.shields.io/badge/CasaOS-Ready-orange)](https://casaos.io/)
[![Next.js](https://img.shields.io/badge/Next.js-15-black?logo=next.js&logoColor=white)](https://nextjs.org/)
[![Prisma](https://img.shields.io/badge/Prisma-SQLite-16a34a?logo=prisma&logoColor=white)](https://www.prisma.io/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

**HealthHUD** is an anime-inspired, high-visibility personal health dashboard built to run 24/7 on your home server (**CasaOS, Proxmox VE, Ubuntu, or Debian Linux**). 

Stop checking four different phone apps and wrestling with brittle Google Sheets scripts that double-count your steps. HealthHUD pulls your live Apple Health workouts, Withings smart scale weigh-ins, sleep architecture, and tape measurements into a unified **4-Quadrant Tactical Command Center**.

---

## ⚡ The 4 Command Quadrants

```
┌─────────────────────────────────┬─────────────────────────────────┐
│  🩸 VITALS COMMAND              │  ⚡ CONSISTENCY TRACKER          │
│  • Current Weight & 7D Trend    │  • Mon–Sun Strength Battle Map  │
│  • 7D Rolling Weight Average    │  • Cardio Sessions & Total Mins │
│  • Monotonic Daily Steps Avg    │  • Cardio-Specific Avg Heart Rate│
│  • Step Delta vs. Previous Week │  • Floating Session Inspector   │
├─────────────────────────────────┼─────────────────────────────────┤
│  💤 RECOVERY HUD                │  📐 THICC BOY MEASUREMENTS      │
│  • Last Night Sleep Hours       │  • Starting Baseline Calibration│
│  • 7D Average Sleep Line        │  • Directional Progress Bars    │
│  • Daily Sleep Architecture Bar │  • Quick-Log Tape Measurements  │
│  • Mon–Sun Sleep Tracking       │  • Customizable Target Goals ⚙️ │
└─────────────────────────────────┴─────────────────────────────────┘
```

### 🩸 Vitals Command (Top-Left)
* **Smart Weigh-Ins:** Real-time weight logging with Withings OAuth2 integration and optional manual entry.
* **True 7-Day Rolling Average:** Filters out daily water weight fluctuations to reveal your actual metabolic direction.
* **Weekly Step Velocity:** Tracks daily step count and calculates your step delta compared to the previous calendar week.

### ⚡ Consistency Tracker (Top-Right)
* **Weekly Strength Battle Map:** Interactive Monday–Sunday tracker lighting up green for logged strength sessions.
* **Itemized Workout Inspection:** Hover over any day (or the total session counter) to view an attached popover listing workout dates, types, and exact durations in `MM:SS`.
* **Cardio Sessions & Minutes:** Exact itemized session count and cumulative cardio minutes for the current calendar week.
* **Cardio-Specific Heart Rate:** Intelligently isolates heart rate during cardio sessions (running, walks, elliptical, cycling) to measure cardiovascular conditioning, separate from resting heart rate.
* **Automatic Monday Reset:** At midnight Monday, weekly consistency targets restart cleanly for the new week.

### 💤 Recovery HUD (Bottom-Left)
* **Sleep Architecture:** Visualizes sleep duration for each night of the week against a dynamic 7-day average line.
* **Auto-Aggregated from Apple Health:** Deep, Core, REM, and Asleep stages automatically parsed and totaled.

### 📐 Thicc Boy Measurements (Bottom-Right)
* **Baseline Starting Point:** Unlike basic calculators that falsely show 80% progress on day one, HealthHUD measures true directional progress from your calibrated starting baseline to your target goal.
* **Directional Progress Bars:** Accurately reflects cutting goals (Chest/Waist reduction) and hypertrophy goals (Bicep growth).
* **Instant Tape Logging (`+`):** Log tape measurements anytime with date tracking and history persistence.
* **Goal Customizer (`⚙️`):** Configure your Starting Baselines and Target Goals side-by-side.

---

## 🔄 Dual-Engine Automated Ingestion

### 1. Apple Health (via Health Auto Export)
HealthHUD includes a dedicated high-throughput webhook endpoint (`/api/ingest/apple-health`) engineered for the **Health Auto Export** iOS app:
* **Unique Workout Deduplication:** Workouts are identified using persistent Apple HealthKit UUIDs and composite start/end timestamps. Running the export 10 times a day will **never** double-count your workouts or minutes.
* **Multiple Same-Day Sessions:** Logging two separate 30-minute cardio sessions in the same day correctly registers as **2 sessions / 60 minutes**, preserving each workout's unique identity.
* **Monotonic Step Aggregation:** Avoids the classic spreadsheet pitfall where sync updates re-add steps. Step counts accumulate monotonically across the day, always storing your highest verified daily total.
* **Deep Heart Rate Extraction:** Unpacks complex Apple HealthKit object trees (`{ qty }`, `{ avg }`, time-series arrays) to capture exact workout BPM.

### 2. Withings Smart Scales
* **Automated 15-Minute Background Daemon:** A lightweight internal daemon queries the Withings API every 15 minutes to pull new weigh-ins automatically.
* **Instant "Sync Now 🔄" Button:** Weighed yourself just now? Tap the sync button in the footer for an immediate pull in ~2 seconds.
* **14-Day Resiliency Window:** Offline scale? Delayed sync? HealthHUD automatically looks back 14 days on each pull so no weigh-ins are ever missed.
* **Automatic OAuth2 Token Rotation:** Keeps your connection alive indefinitely without manual re-login.

---

## 🚀 One-Line Installation

HealthHUD is built to deploy effortlessly on any Linux machine, Proxmox VE container/VM, or CasaOS home server.

Open your server terminal and run:

```bash
curl -sSL https://raw.githubusercontent.com/ProdeaGG/HealthHUD/main/install.sh | bash
```

**What the installer does:**
1. Installs `git` and verifies Docker Compose.
2. Clones the repository to `/DATA/AppData/HealthHUD`.
3. Sets up your persistent SQLite database in `/data/dev.db`.
4. Builds and starts the container with automated daily database backups.
5. Surfaces HealthHUD on your CasaOS dashboard (Port `3000`).

---

## 🔄 Updating HealthHUD

To update your installation to the latest version with **zero data loss**, run the exact same command:

```bash
curl -sSL https://raw.githubusercontent.com/ProdeaGG/HealthHUD/main/install.sh | bash
```

The script automatically pulls the newest code, executes non-destructive Prisma schema migrations, and restarts the container while keeping all your historical logs, measurements, and settings safe.

---

## 🛠️ Manual Docker Compose Setup

If you prefer managing your containers manually:

```bash
git clone https://github.com/ProdeaGG/HealthHUD.git
cd HealthHUD
docker compose up -d --build
```

Access the dashboard at `http://<SERVER_IP>:3000`.

---

## 📁 Tech Stack & Architecture

* **Framework:** Next.js 15 (App Router, React Server Components & Client Hooks)
* **Styling:** Tailwind CSS with retro-clinical dark HUD aesthetic
* **Database:** SQLite (lightweight, zero-config, portable)
* **ORM:** Prisma Client with strict schema validation and auto-migrations
* **Runtime:** Node.js 20 on Alpine Linux (Docker containerized)
* **Hosting:** Optimized for CasaOS, Proxmox VE, Debian, and Ubuntu Linux

---

## 📄 License

MIT License. Designed and built with ❤️ for lifters, biohackers, and self-hosters.
