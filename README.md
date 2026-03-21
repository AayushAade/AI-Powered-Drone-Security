# 🚁 AI-Powered Drone Security & Emergency Response

![Command Center Dashboard](https://img.shields.io/badge/Status-Active-brightgreen) ![License](https://img.shields.io/badge/License-MIT-blue) ![Version](https://img.shields.io/badge/Version-1.0.0-orange)

A real-time, AI-driven command center built for modern first responders. This system integrates stationary CCTV feeds and autonomous drone video streams, utilizing YOLOv11 Pose Estimation to detect incidents (like a suspect surrendering) and automatically dispatch aerial assets to precise geographical coordinates via an interactive React-Leaflet dashboard.

---

## 🌟 Key Features

*   **🧠 Real-Time AI Inference:** Utilizes `ultralytics` YOLOv11-Pose to instantly detect human behaviors (e.g., raised hands/surrender) from raw video feeds.
*   **📡 Dual-Stream Command Center:** A Vite + React frontend dashboard capable of handling simultaneous WebSocket streams from both stationary CCTV and mobile drone units.
*   **📍 Live Geospatial Tracking:** Integrates `react-leaflet` to visualize live drone telemetry, dynamically tracking aerial assets across a city map.
*   **⚡ Automated Dispatch System:** When CCTV detects a critical incident, the Node.js backend instantly correlates the event and dispatches the nearest active drone to the exact coordinates.
*   **💻 Remote Process Management:** Administrators can launch and terminate separate Python video processing scripts directly from the React dashboard via a robust Node.js `child_process` backend.

---

## 🏗️ System Architecture

The project is divided into four core microservices:

1.  **`/backend` (Node.js & Express):** The central nervous system. Manages Socket.IO connections, handles REST API dispatch alerts, and controls the spawning of Python sub-processes.
2.  **`/frontend` (React + Tailwind + Vite):** The responder's Command Center. Features draggable resizable video modals (`react-rnd`), live map tracking, and an incident alert sidebar.
3.  **`/cameras` & `/drones` (Python + OpenCV):** The edge hardware. Captures video via IP Webcams or local webcams, runs YOLO inference, encodes frames to Base64, and pushes them to the Node.js server.
4.  **`/mobile_app` (React Native & Expo):** The on-ground responder application. Provides real-time alerts, live camera feeds, and geolocation tracking for field units.

```mermaid
graph TD
    %% Define styles
    classDef input fill:#e2e8f0,stroke:#94a3b8,color:#000
    classDef edge fill:#f1f5f9,stroke:#cbd5e1,color:#000
    classDef core fill:#e0f2fe,stroke:#7dd3fc,color:#000
    classDef ai fill:#fef08a,stroke:#fde047,color:#000
    classDef ui fill:#dcfce7,stroke:#86efac,color:#000
    classDef ops fill:#fce7f3,stroke:#f9a8d4,color:#000

    subgraph Sources ["📱 Data Ingestion Sources"]
        Mobile["Mobile Devices\nApp Ingest / Broadcast"]:::input
        CCTV["Fixed CCTV Cameras\nRTSP Streams"]:::input
        Manual["Manual Staging\n.mp4 Uploads"]:::input
    end

    subgraph EdgeLayer ["🧠 Edge AI Processing Layer (TensorFlow.js)"]
        DeviceInf["Device-Level Inference\nReal-Time Object Detection"]:::edge
        Rules["Behavioral Rules Engine"]:::edge
    end

    subgraph Gateway ["⚡ Media Gateway Server (Node.js/Express)"]
        VideoTriage["Video Triage Module"]:::core
        API["REST API Upload\n(/api/upload)"]:::core
        WS["Low-Latency WebSocket Bus\n(Socket.IO)"]:::core
        EventBus["Event Bus & Messaging"]:::core
    end

    subgraph AICore ["🤖 AI Core: Cognitive Services"]
        CV["YOLO11 & ByteTrack\nObject/Pose & Fall Detection"]:::ai
        LLM["Gemini Vision API\nLLM Scene Reasoning"]:::ai
    end

    subgraph Orchestration ["🚁 Drone Fleet & Mission Orchestration"]
        FlightPlan["Flight Planner Module"]:::core
        Telemetry["Telemetry Monitoring Unit"]:::core
    end

    subgraph Dashboard ["💻 Command & Control Dashboard"]
        Map["Situational Awareness Map"]:::ui
        Feeds["Live AI Alerts Feed"]:::ui
        Status["Drone Fleet Status"]:::ui
    end
    
    subgraph Operations ["🌍 Field Operations & Analytics"]
        Analytics["Analytics & Insights Unit"]:::ops
        FieldOps["Field Operations Unit"]:::ops
        Drones["Active Drone Squadrons"]:::ops
    end

    %% Data flows
    Mobile --> EdgeLayer
    CCTV --> EdgeLayer
    Manual --> EdgeLayer
    
    DeviceInf --> Rules
    Rules -->|"Alerts, Metadata & Raw Video"| Gateway

    Gateway <-->|"Control Commands &\nAI Model Propagation"| AICore
    AICore -->|"Analytics Prediction"| Analytics

    Gateway <-->|"Control Commands &\nDrone Telemetry"| Orchestration
    Orchestration <-->|"ETA & Commands"| Drones

    Gateway <-->|"Command Interface\n& Packets"| Dashboard
    
    Dashboard -->|"Alerts to Authorities"| FieldOps
    Dashboard -->|"System Reports"| Analytics
```

---

## 🚀 Quick Start Guide

Follow these steps to get the Command Center running on your local machine.

### Prerequisites
*   [Node.js](https://nodejs.org/) (v16+)
*   [Python](https://www.python.org/downloads/) (3.9+)
*   [Git](https://git-scm.com/)

### 1. Clone the Repository
```bash
git clone https://github.com/AayushAade/AI-Powered-Drone-Security.git
cd AI-Powered-Drone-Security
```

### 2. Setup the Python Environment
```bash
# Install required ML and vision libraries
pip install ultralytics opencv-python numpy python-socketio requests
```
*(Ensure you have the YOLO weights (`yolo11n-pose.pt`, `yolo11n.pt`) placed in the `/project_assets` directory).*

### 3. Launch the Backend Server
```bash
cd backend
npm install
npm run start
# Runs on http://localhost:3000
```

### 4. Launch the Frontend Dashboard
Open a new terminal window:
```bash
cd frontend
npm install
npm run dev
# Runs on http://localhost:5173
```

### 5. Start the AI Feeds
1. Open the dashboard at `http://localhost:5173`.
2. Click **"LAUNCH CCTV CAM"** to start the stationary posture-detection feed.
3. Click **"LAUNCH DRONE CAM"** to start the mobile tracking feed.

*(Note: The Python scripts are currently configured to look for an IP Webcam stream at `http://192.0.0.4:8080`. Update `video_url` in the respective Python files to match your hardware).*

### 6. Start the Mobile Application (Optional)
To run the responder's app on your phone or emulator:
```bash
cd mobile_app
npm install
npx expo start
```
*(Scan the QR code with Expo Go on your mobile device to test).*

---

## 🛠️ Built With

*   **Frontend:** React, Vite, Tailwind CSS, React-Leaflet, React-RND
*   **Mobile App:** React Native, Expo, Socket.IO Client
*   **Backend:** Node.js, Express, Socket.IO
*   **AI/CV:** Python, OpenCV, Ultralytics YOLOv11

---

*Built for Hackathon Innovation.*
