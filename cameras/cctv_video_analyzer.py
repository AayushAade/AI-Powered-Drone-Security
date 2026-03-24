import cv2
import base64
import time
import socketio
import sys
import numpy as np
from ultralytics import YOLO
from sklearn.cluster import DBSCAN

# 1. Check Arguments
if len(sys.argv) < 2:
    print("Error: No video file path provided.")
    sys.exit(1)

video_path = sys.argv[1]

# 2. Setup Socket.IO
sio = socketio.Client()
try:
    sio.connect('http://localhost:3000')
except Exception as e:
    print(f"Error connecting to backend: {e}")
    sys.exit(1)

# 3. Load YOLOv11 Model
print("Loading YOLOv11 for Crowd Scanning...")
# Load from project_assets relative to root
model = YOLO("project_assets/yolo11n.pt")
print("✅ YOLO Model Loaded.")

# 4. Open Video File
cap = cv2.VideoCapture(video_path)
if not cap.isOpened():
    print(f"Error: Could not open video file {video_path}")
    sio.disconnect()
    sys.exit(1)

print(f"STARTED CROWD SCANNING ON UPLOADED VIDEO: {video_path}")

last_alert_time = 0
ALERT_COOLDOWN = 4 # Reduced to 4 seconds for better responsive monitoring without spam
CROWD_THRESHOLD = 5

try:
    frame_count = 0
    while cap.isOpened():
        ret, frame = cap.read()
        if not ret:
            print("End of video reached. Analysis complete.")
            break

        frame_count += 1
        # Process every 2nd frame for better performance during analysis
        if frame_count % 2 != 0:
            continue

        # Resize for consistent processing speed
        frame = cv2.resize(frame, (640, 480))
        
        # Run YOLO Inference with stricter NMS (iou) and sensitivity (conf)
        results = model(frame, verbose=False, conf=0.35, iou=0.45)
        
        person_centers = []
        person_boxes = []
        annotated_frame = frame.copy()
        
        for r in results:
            for box in r.boxes:
                cls = int(box.cls[0])
                label = model.names[cls]
                if label == 'person':
                    x1, y1, x2, y2 = map(int, box.xyxy[0])
                    person_boxes.append((x1, y1, x2, y2))
                    # Center point for clustering
                    person_centers.append([(x1 + x2) / 2, (y1 + y2) / 2])
                    # Draw Person Box (Cyan, No Label)
                    cv2.rectangle(annotated_frame, (x1, y1), (x2, y2), (0, 255, 255), 1)

        person_count = len(person_centers)
        cluster_detected = False
        
        # --- SPATIAL CLUSTERING (DBSCAN) ---
        if person_count >= 8:
            X = np.array(person_centers)
            clustering = DBSCAN(eps=100, min_samples=8).fit(X)
            labels = clustering.labels_
            
            # Find clusters (label != -1)
            unique_labels = set(labels)
            for l in unique_labels:
                if l == -1: continue # Noise
                
                cluster_detected = True
                class_member_mask = (labels == l)
                cluster_points = X[class_member_mask]
                
                # Get cluster boundaries
                c_x1, c_y1 = np.min(cluster_points, axis=0)
                c_x2, c_y2 = np.max(cluster_points, axis=0)
                
                # Draw Red Highlight for the Cluster (Translucent-ish using an overlay)
                overlay = annotated_frame.copy()
                # Expand slightly for visibility
                pad = 30
                cv2.rectangle(overlay, (int(c_x1-pad), int(c_y1-pad)), (int(c_x2+pad), int(c_y2+pad)), (0, 0, 255), -1)
                cv2.addWeighted(overlay, 0.3, annotated_frame, 0.7, 0, annotated_frame)
                cv2.rectangle(annotated_frame, (int(c_x1-pad), int(c_y1-pad)), (int(c_x2+pad), int(c_y2+pad)), (0, 0, 255), 2)
                
                cv2.putText(annotated_frame, "DENSE CROWD DETECTED", (int(c_x1), int(c_y1 - 40)), 
                            cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 0, 255), 2)

        # Dashboard HUD
        cv2.putText(annotated_frame, f"CROWD SCANNER | PEOPLE: {person_count}", (20, 40), 
                    cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 255, 255), 2)
        
        if cluster_detected:
            cv2.putText(annotated_frame, "ACTIVE GATHERING!", (20, 80), 
                        cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 0, 255), 3)

        # Stream frame to dashboard
        _, buffer = cv2.imencode('.jpg', annotated_frame, [cv2.IMWRITE_JPEG_QUALITY, 50])
        b64_img = base64.b64encode(buffer).decode('utf-8')
        sio.emit('cctv_frame', {'image': b64_img})

        # Trigger Incident Alert if dense cluster (not just headcount)
        if cluster_detected:
            current_time = time.time()
            if current_time - last_alert_time > ALERT_COOLDOWN:
                print(f"🚨 DENSE CLUSTER DETECTED: {person_count} people gathering!")
                incident_data = {
                    'type': f'Crowd Gathering ({person_count} people)',
                    'lat': 18.5204, 
                    'lng': 73.8567,
                    'severity': 'High',
                    'camera_id': 'UPLOADED_INFERENCE'
                }
                sio.emit('incident_alert', incident_data)
                last_alert_time = current_time

        # Sleep slightly to avoid overwhelming the socket
        time.sleep(0.01)

except Exception as e:
    print(f"Error during analysis: {e}")
finally:
    cap.release()
    sio.disconnect()
    print("Analysis finished.")
