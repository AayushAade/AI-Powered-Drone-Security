import cv2
import numpy as np
from ultralytics import YOLO
import base64
import socketio
import time
import requests

def detect_raised_hands(keypoints):
    """
    COCO Keypoint format:
    5: L Shoulder, 6: R Shoulder
    7: L Elbow, 8: R Elbow
    
    A person has "hands raised" (surrendering) if BOTH their elbows 
    are physically higher (lower y-value) than BOTH their shoulders.
    """
    if len(keypoints) < 9:
        return False
        
    left_shoulder = keypoints[5]
    right_shoulder = keypoints[6]
    left_elbow = keypoints[7]
    right_elbow = keypoints[8]
    
    # Check if we have high enough confidence for these joints
    if left_shoulder[0] == 0: return False
    if right_shoulder[0] == 0: return False
    if left_elbow[0] == 0: return False
    if right_elbow[0] == 0: return False

    # In OpenCV, y=0 is the TOP of the screen (lower y-value = higher up)
    left_elbow_raised = left_elbow[1] < left_shoulder[1]
    right_elbow_raised = right_elbow[1] < right_shoulder[1]
    
    return left_elbow_raised and right_elbow_raised

def run_cctv_monitor():
    sio = socketio.Client()
    try:
        sio.connect('http://localhost:3000')
        print("✅ CCTV: Connected to Command Center WebSockets")
    except Exception as e:
        print(f"CCTV Failed to connect to WebSocket: {e}")
        return

    # UPGRADE: Load the Pose model instead of standard object detection
    print("Loading YOLOv11 POSE Model for CCTV...")
    model = YOLO('../project_assets/yolo11n-pose.pt') 
    
    video_url = "http://192.0.0.4:8080/video" 
    print(f"Connecting CCTV to Mobile Hotspot Camera at {video_url}...")
    
    cap = cv2.VideoCapture(video_url)
    
    if not cap.isOpened():
        print(f"❌ Error: CCTV could not open the mobile video stream at {video_url}")
        print("Falling back to local laptop webcam (0) for CCTV testing...")
        cap = cv2.VideoCapture(0)
    
    print("✅ Waiting for backend connection to settle...")
    time.sleep(1)
    
    print("✅ CCTV Tracking Started! Waiting for raised hands...")

    last_alert_time = 0
    ALERT_COOLDOWN = 10 
    
    frame_count = 0
    while cap.isOpened():
        # Aggressively clear the buffer to prevent 5-second IP camera lag
        for _ in range(4): cap.grab() 

        success, frame = cap.read()
        if not success:
            break
            
        # Resize immediately to speed up YOLO and reduce network bandwidth
        frame = cv2.resize(frame, (640, 480))
            
        # Run YOLO Pose inference
        results = model.predict(frame, verbose=False)
        result = results[0]
        
        annotated_frame = frame.copy()
        incident_triggered_this_frame = False
        
        # Check every detected person's keypoints
        if result.keypoints is not None and len(result.keypoints) > 0:
            # keypoints.xy contains the [x,y] coordinates for each skeleton found
            for i, person_kpts in enumerate(result.keypoints.xy):
                kpts_array = person_kpts.cpu().numpy()
                hands_are_up = detect_raised_hands(kpts_array)
                
                # Get the bounding box for this specific person to draw the UI
                box = result.boxes[i].xyxy[0].cpu().numpy()
                x1, y1, x2, y2 = map(int, box)
                
                if hands_are_up:
                    incident_triggered_this_frame = True
                    color = (0, 165, 255) # Orange for Surrender/Distress
                    label = "🚨 SUBJECT SURRENDER DETECTED 🚨"
                    cv2.rectangle(annotated_frame, (x1, y1), (x2, y2), color, 4)
                    cv2.putText(annotated_frame, label, (x1, max(30, y1 - 10)), 
                                cv2.FONT_HERSHEY_SIMPLEX, 0.8, color, 3)
                    
                    # Draw a skeleton specifically highlighting the arms
                    try:
                        pts = [(int(kpts_array[9][0]), int(kpts_array[9][1])), # L wrist
                               (int(kpts_array[7][0]), int(kpts_array[7][1])), # L elbow
                               (int(kpts_array[5][0]), int(kpts_array[5][1])), # L shoulder
                               (int(kpts_array[6][0]), int(kpts_array[6][1])), # R shoulder
                               (int(kpts_array[8][0]), int(kpts_array[8][1])), # R elbow
                               (int(kpts_array[10][0]), int(kpts_array[10][1]))] # R wrist
                        for j in range(len(pts)-1):
                            cv2.line(annotated_frame, pts[j], pts[j+1], (0, 0, 255), 4)
                            cv2.circle(annotated_frame, pts[j], 6, (0, 255, 255), -1)
                        cv2.circle(annotated_frame, pts[-1], 6, (0, 255, 255), -1)
                    except Exception as e:
                        pass # Ignore if keypoints aren't fully visible
                        
                    # Add a visual flash to the whole screen
                    overlay = annotated_frame.copy()
                    cv2.rectangle(overlay, (0, 0), (annotated_frame.shape[1], annotated_frame.shape[0]), (0, 0, 255), -1)
                    annotated_frame = cv2.addWeighted(overlay, 0.15, annotated_frame, 0.85, 0)
                    
                else:
                    color = (0, 255, 0) # Green
                    label = "Person: Normal"
                    cv2.rectangle(annotated_frame, (x1, y1), (x2, y2), color, 2)
                    cv2.putText(annotated_frame, label, (x1, max(20, y1 - 10)), 
                                cv2.FONT_HERSHEY_SIMPLEX, 0.6, color, 2)

        # Encode frame to Base64 with high compression to speed up WebSocket transmission
        _, buffer = cv2.imencode('.jpg', annotated_frame, [int(cv2.IMWRITE_JPEG_QUALITY), 50])
        frame_base64 = base64.b64encode(buffer).decode('utf-8')
        sio.emit('cctv_frame', {'image': frame_base64})
        
        current_time = time.time()
        if incident_triggered_this_frame and (current_time - last_alert_time > ALERT_COOLDOWN):
            print("🚨 HANDS RAISED! Sending dispatch request to Command Center...")
            try:
                payload = {
                    "type": "Subject Surrender - Hands Raised", 
                    "lat": 18.4575, 
                    "lng": 73.8508,
                    "severity": "High",
                    "camera_id": "CCTV-Mobile-Alpha"
                }
                res = requests.post("http://localhost:3000/api/alert", json=payload)
                if res.status_code == 200:
                    print(f"✅ Drone Dispatch Confirmed! Target set.")
                last_alert_time = current_time
            except Exception as e:
                print(f"❌ Failed to reach backend API for dispatch: {e}")

        cv2.waitKey(1)
        
        frame_count += 1
        if frame_count % 30 == 0:
            print(f"CCTV Pose Tracking Active... ({frame_count} frames)")

    cap.release()
    cv2.destroyAllWindows() 
    sio.disconnect()
    print("\n✅ CCTV feed closed.")

if __name__ == "__main__":
    run_cctv_monitor()
