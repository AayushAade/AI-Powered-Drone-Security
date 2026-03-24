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

# 3. Load YOLO Model
model = YOLO('yolo11n.pt')

# 4. Open Video File
cap = cv2.VideoCapture(video_path)

if not cap.isOpened():
    print(f"Error: Could not open video file {video_path}")
    sio.disconnect()
    sys.exit(1)

print(f"STARTED YOLO DETECTION ON UPLOADED VIDEO: {video_path}")

# Cooldown for incident alerts (per type)
last_alert_sent = {}
ALERT_COOLDOWN = 4 # Seconds

try:
    while cap.isOpened():
        ret, frame = cap.read()
        if not ret:
            print("End of video reached. Looping...")
            cap.set(cv2.CAP_PROP_POS_FRAMES, 0)
            continue

        # Resize for performance
        frame_resized = cv2.resize(frame, (640, 480))

        # Run Inference with stricter NMS (iou) and sensitivity (conf)
        results = model(frame_resized, stream=True, verbose=False, conf=0.35, iou=0.4)
        
        objects_detected = []
        for r in results:
            boxes = r.boxes
            for box in boxes:
                # Bounding Box
                x1, y1, x2, y2 = box.xyxy[0]
                x1, y1, x2, y2 = int(x1), int(y1), int(x2), int(y2)
                
                # Confidence
                conf = math.ceil((box.conf[0] * 100)) / 100
                
                if conf > 0.6:  # 60% confidence threshold
                    cls = int(box.cls[0])
                    class_name = model.names[cls]
                    objects_detected.append(class_name)
                    
                    # Draw Red Box & Label
                    cv2.rectangle(frame_resized, (x1, y1), (x2, y2), (0, 0, 255), 2)
                    cv2.putText(frame_resized, f"{class_name} {conf}", (x1, y1 - 10), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 0, 255), 2)

        # Convert to Base64
        _, buffer = cv2.imencode('.jpg', frame_resized, [cv2.IMWRITE_JPEG_QUALITY, 50])
        base64_img = base64.b64encode(buffer).decode('utf-8')

        # Broadcast to Node.js backend
        sio.emit('video_frame', {'image': base64_img})
        
        # If we detect a person, trigger a system alert with cooldown
        if 'person' in objects_detected:
            alert_type = 'PERSON DETECTED'
            current_time = time.time()
            
            if alert_type not in last_alert_sent or (current_time - last_alert_sent[alert_type] > ALERT_COOLDOWN):
                print(f"🚨 ALERT: {alert_type} in drone feed!")
                sio.emit('incident_alert', {
                    'id': f'INC-{int(time.time())}',
                    'type': f'{alert_type} (UPLOADED VID)',
                    'lat': 18.5204, 
                    'lng': 73.8567,
                    'severity': 'HIGH',
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
