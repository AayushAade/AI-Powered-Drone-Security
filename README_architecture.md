# Presentation Architecture Diagram

Use this specific syntax if your presentation software supports Mermaid, or drop it into a tool like [Mermaid Live Editor](https://mermaid.live/) to export a high-res PNG for your slides.

```mermaid
flowchart TD
  classDef ingest fill:#D9ECFF,stroke:#2F6FAB,stroke-width:2px,color:#0B2A4A,font-weight:bold;
  classDef perceive fill:#EAF5FF,stroke:#1D5FA8,stroke-width:2px,color:#0B2A4A,font-weight:bold;
  classDef intel fill:#FFE7C7,stroke:#C56A00,stroke-width:2px,color:#5A2E00,font-weight:bold;
  classDef agent fill:#F0DDFE,stroke:#7C3AED,stroke-width:2px,color:#3A1B6B,font-weight:bold;
  classDef core fill:#4A5568,stroke:#2D3748,stroke-width:2px,color:#FFFFFF,font-weight:bold;
  classDef dash fill:#DFF7E8,stroke:#228B5A,stroke-width:2px,color:#123D2A,font-weight:bold;

  subgraph S1 ["LAYER 1: INGESTION"]
    direction LR
    I1(Live CCTV) --> I6(Event Bus)
    I2(Drone Cam) --> I6
    I3(Simulated GPS) --> I6
    I4(Video Upload) --> I6
  end

  B{{"BACKEND ORCHESTRATION\n(Node.js / Socket.IO)"}}:::core

  subgraph S2 ["LAYER 2: PERCEPTION"]
    direction LR
    P1(YOLOv11n\nDetection) --> P4(Fusion & Alert)
    P2(YOLOv11n-pose\nBehavior) --> P4
    P3(MediaPipe\nGestures) --> P4
  end

  subgraph S3 ["LAYER 3: INTELLIGENCE & NAVIGATION"]
    direction LR
    D1(Nearest-Neighbor\nDispatch) --> D2(Geofence Safety)
    D2 --> D3(Mission State\nMachine)
    D3 --> D4(Real-Time\nTelemetry)
  end

  subgraph S4 ["LAYER 4: AGENTIC REASONING"]
    direction LR
    A1(On-Scene Frame) --> A2(LLM Vision API)
    A2 --> A3(Actionable\nSummary)
  end

  subgraph S5 ["COMMAND DASHBOARD (React)"]
    direction LR
    C1(Live Map / ETA)
    C2(Active Alerts)
    C3(Video Feed)
  end

  %% Flow
  I6 -->|Streams/Data| B
  B -->|Frames| S2
  P4 -->|Generated Event| B
  B -->|Incident Details| S3
  D4 -->|Status Update| B
  D3 -->|Arrival Event| S4
  A3 -->|Scene Report| B
  
  B --> S5

  class I1,I2,I3,I4,I6 ingest;
  class P1,P2,P3,P4 perceive;
  class D1,D2,D3,D4 intel;
  class A1,A2,A3 agent;
  class C1,C2,C3 dash;
```
