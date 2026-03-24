import os
import cv2
import base64
import time
import eventlet
import socketio
import numpy as np
from ultralytics import YOLO

# 1. Initialize Socket.IO Server
sio = socketio.Server(cors_allowed_origins='*')
app = socketio.WSGIApp(sio)

# 2. Load Dual-Model AI Architecture
print("🚀 Initializing Dual-Model Persistent AI Server...")

# Paths for models
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
SAFETY_MODEL_PATH = os.path.join(BASE_DIR, "..", "project_assets", "yolo11n.pt")
FIRE_MODEL_PATH = os.path.join(BASE_DIR, "fire_model.pt")

# Load Models
safety_model = YOLO(SAFETY_MODEL_PATH)
fire_model = YOLO(FIRE_MODEL_PATH)

print("✅ AI Models Loaded & Ready.")

# 3. Socket.IO Event Handlers
@sio.event
def connect(sid, environ):
    print(f"✅ Dashboard Connected: {sid}")

@sio.event
def disconnect(sid):
    print(f"❌ Dashboard Disconnected: {sid}")

@sio.on('start_scan')
def handle_start_scan(sid, data):
    video_filename = data.get('video_filename')
    print(f"🎬 Starting AI Scan for: {video_filename}")
    
    # Locate Video in backend/uploads
    video_path = os.path.join(BASE_DIR, "..", "backend", "uploads", video_filename)
    
    # Internal Sample Check (if not in uploads, maybe in public)
    if not os.path.exists(video_path):
        video_path = os.path.join(BASE_DIR, "..", "frontend", "public", video_filename)

    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        print(f"❌ Error: Could not open video {video_path}")
        sio.emit('error', {'message': f'Could not open video: {video_filename}'}, to=sid)
        return

    print(f"⚡ Streaming vision updates to {sid}...")
    
    frame_count = 0
    while cap.isOpened():
        ret, frame = cap.read()
        if not ret: break

        frame_count += 1
        if frame_count % 3 != 0: continue # Process every 3rd frame for speed

        # Resize for performance and dashboard fit
        frame_resized = cv2.resize(frame, (640, 480))
        
        # Dual-Model Inference
        safety_results = safety_model(frame_resized, verbose=False, conf=0.35)
        fire_results = fire_model(frame_resized, verbose=False, conf=0.45)
        
        active_alerts = []
        person_count = 0
        
        # Draw Results Directly on Frame (as requested)
        # 1. Safety Detections
        for r in safety_results:
            for box in r.boxes:
                cls_id = int(box.cls[0])
                label = safety_model.names[cls_id].lower()
                
                if label in ['person', 'car', 'motorcycle']:
                    if label == 'person': person_count += 1
                    x1, y1, x2, y2 = map(int, box.xyxy[0])
                    # Cyan Box for safety entities
                    cv2.rectangle(frame_resized, (x1, y1), (x2, y2), (255, 245, 0), 2) 

        # 2. Hazard Detections
        for r in fire_results:
            for box in r.boxes:
                cls_id = int(box.cls[0])
                label = fire_model.names[cls_id].lower()
                
                if label in ['fire', 'smoke']:
                    x1, y1, x2, y2 = map(int, box.xyxy[0])
                    # Vibrant Red Box for hazards
                    cv2.rectangle(frame_resized, (x1, y1), (x2, y2), (0, 0, 255), 2)
                    cv2.putText(frame_resized, f"CRITICAL: {label.upper()}", (x1, y1 - 10), 
                                cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 0, 255), 2)
                    if label.upper() not in active_alerts:
                        active_alerts.append(label.upper())

        # Crowd Logic
        if person_count >= 8:
            active_alerts.append('CROWD GATHERING')

        # Encode Frame to Base64
        _, buffer = cv2.imencode('.jpg', frame_resized, [cv2.IMWRITE_JPEG_QUALITY, 45])
        b64_img = base64.b64encode(buffer).decode('utf-8')

        # Emit Unified Vision Update
        sio.emit('vision_update', {
            'frame': f"data:image/jpeg;base64,{b64_img}",
            'alerts': active_alerts,
        }, to=sid)

        # Non-blocking pause
        eventlet.sleep(0.01)

    cap.release()
    print(f"✅ Scan Complete for: {video_filename}")
    sio.emit('scan_complete', {'video_filename': video_filename}, to=sid)

# 4. Start Server
if __name__ == '__main__':
    print("📡 AI Analytics Server listening on http://0.0.0.0:5001")
    eventlet.wsgi.server(eventlet.listen(('0.0.0.0', 5001)), app)
