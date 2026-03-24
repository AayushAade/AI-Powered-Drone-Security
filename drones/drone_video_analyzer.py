import cv2
import base64
import time
import socketio
import sys
import threading
import math
from ultralytics import YOLO

# 1. Check Arguments
if len(sys.argv) < 2:
    print("Error: No video file path provided.")
    sys.exit(1)

video_path = sys.argv[1]

# 2. Setup Socket.IO
sio = socketio.Client()
sio.connect('http://localhost:3000')

# 3. Load Fire/Smoke Model
print("Loading Fire & Smoke Detection AI...")
model = YOLO('../backend/fire_model.pt')
print("✅ Fire & Smoke Model Loaded.")

# 4. Open Video File
cap = cv2.VideoCapture(video_path)

if not cap.isOpened():
    print(f"Error: Could not open video file {video_path}")
    sio.disconnect()
    sys.exit(1)

print(f"STARTED AERIAL FIRE SCANNING ON VIDEO: {video_path}")

# Cooldown for incident alerts (per type)
last_alert_sent = {}
ALERT_COOLDOWN = 3 # Seconds

try:
    while cap.isOpened():
        ret, frame = cap.read()
        if not ret:
            print("End of video reached. Looping...")
            cap.set(cv2.CAP_PROP_POS_FRAMES, 0)
            continue

        # Resize for performance
        frame_resized = cv2.resize(frame, (640, 480))

        # Run Inference
        results = model(frame_resized, stream=True, verbose=False, conf=0.40, iou=0.4)
        
        objects_detected = []
        for r in results:
            boxes = r.boxes
            for box in boxes:
                cls = int(box.cls[0])
                label = model.names[cls].lower()
                
                if label in ['fire', 'smoke']:
                    # Bounding Box
                    x1, y1, x2, y2 = map(int, box.xyxy[0])
                    conf = float(box.conf[0])
                    
                    objects_detected.append(label)
                    
                    # Draw Flame/Smoke Box (Red for Fire, Grey for Smoke)
                    color = (0, 0, 255) if label == 'fire' else (128, 128, 128)
                    cv2.rectangle(frame_resized, (x1, y1), (x2, y2), color, 2)
                    cv2.putText(frame_resized, f"CRITICAL: {label.upper()} ({conf:.2f})", (x1, y1 - 10), 
                                cv2.FONT_HERSHEY_SIMPLEX, 0.5, color, 2)

        # Convert to Base64
        _, buffer = cv2.imencode('.jpg', frame_resized, [cv2.IMWRITE_JPEG_QUALITY, 50])
        base64_img = base64.b64encode(buffer).decode('utf-8')

        # Broadcast to Node.js backend
        sio.emit('video_frame', {'image': base64_img})
        
        # If we detect fire or smoke, trigger a system alert with cooldown
        for alert_type in ['fire', 'smoke']:
            if alert_type in objects_detected:
                current_time = time.time()
                
                if alert_type not in last_alert_sent or (current_time - last_alert_sent[alert_type] > ALERT_COOLDOWN):
                    print(f"🔥 DRONE ALERT: {alert_type.upper()} DETECTED!")
                    sio.emit('incident_alert', {
                        'id': f'FIRE-{int(time.time())}',
                        'type': f'{alert_type.upper()} DETECTED (DRONE FEED)',
                        'lat': 18.5204, 
                        'lng': 73.8567,
                        'severity': 'CRITICAL',
                        'timestamp': time.time() * 1000
                    })
                    last_alert_sent[alert_type] = current_time

        # Process at approx 30 FPS
        time.sleep(0.033)

except KeyboardInterrupt:
    print("Video analysis interrupted by user.")
finally:
    cap.release()
    sio.disconnect()
    print("YOLO Drone Video Analyzer shutdown cleanly.")
