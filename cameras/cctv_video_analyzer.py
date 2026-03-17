import cv2
import base64
import time
import socketio
import sys
import numpy as np
import mediapipe as mp

# 1. Check Arguments
if len(sys.argv) < 2:
    print("Error: No video file path provided.")
    sys.exit(1)

video_path = sys.argv[1]

# 2. Setup Socket.IO
sio = socketio.Client()
sio.connect('http://localhost:3000')

# 3. Setup MediaPipe Hands
mp_hands = mp.solutions.hands
hands = mp_hands.Hands(
    static_image_mode=False,
    max_num_hands=2,
    min_detection_confidence=0.5,
    min_tracking_confidence=0.5
)
mp_drawing = mp.solutions.drawing_utils

def is_thumbs_up(hand_landmarks):
    # Get landmarks
    thumb_tip = hand_landmarks.landmark[mp_hands.HandLandmark.THUMB_TIP]
    thumb_mcp = hand_landmarks.landmark[mp_hands.HandLandmark.THUMB_MCP]
    
    index_tip = hand_landmarks.landmark[mp_hands.HandLandmark.INDEX_FINGER_TIP]
    index_mcp = hand_landmarks.landmark[mp_hands.HandLandmark.INDEX_FINGER_MCP]
    
    middle_tip = hand_landmarks.landmark[mp_hands.HandLandmark.MIDDLE_FINGER_TIP]
    middle_mcp = hand_landmarks.landmark[mp_hands.HandLandmark.MIDDLE_FINGER_MCP]
    
    ring_tip = hand_landmarks.landmark[mp_hands.HandLandmark.RING_FINGER_TIP]
    ring_mcp = hand_landmarks.landmark[mp_hands.HandLandmark.RING_FINGER_MCP]
    
    pinky_tip = hand_landmarks.landmark[mp_hands.HandLandmark.PINKY_TIP]
    pinky_mcp = hand_landmarks.landmark[mp_hands.HandLandmark.PINKY_MCP]
    
    # Check if thumb is pointing up (y of tip is noticeably less than y of mcp)
    thumb_is_up = thumb_tip.y < thumb_mcp.y - 0.05
    
    # Check if other fingers are folded (y of tip is greater than y of mcp)
    index_is_folded = index_tip.y > index_mcp.y
    middle_is_folded = middle_tip.y > middle_mcp.y
    ring_is_folded = ring_tip.y > ring_mcp.y
    pinky_is_folded = pinky_tip.y > pinky_mcp.y

    return thumb_is_up and index_is_folded and middle_is_folded and ring_is_folded and pinky_is_folded


# 4. Open Video File
cap = cv2.VideoCapture(video_path)
if not cap.isOpened():
    print(f"Error: Could not open video file {video_path}")
    sio.disconnect()
    sys.exit(1)

print(f"STARTED AI SCANNERS ON UPLOADED VIDEO: {video_path}")

last_alert_time = 0
ALERT_COOLDOWN = 10 

try:
    while cap.isOpened():
        ret, frame = cap.read()
        if not ret:
            print("End of video reached. Looping...")
            cap.set(cv2.CAP_PROP_POS_FRAMES, 0)
            continue

        # Resize immediately
        frame = cv2.resize(frame, (640, 480))
        rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        
        # Run MediaPipe inference
        results = hands.process(rgb_frame)
        
        annotated_frame = frame.copy()
        incident_type = None
        
        thumbs_up_detected = False
        
        if results.multi_hand_landmarks:
            for hand_landmarks in results.multi_hand_landmarks:
                mp_drawing.draw_landmarks(annotated_frame, hand_landmarks, mp_hands.HAND_CONNECTIONS)
                
                if is_thumbs_up(hand_landmarks):
                    thumbs_up_detected = True
        
        if thumbs_up_detected:
            incident_type = "THUMBS UP GESTURE"
            cv2.putText(annotated_frame, "THUMBS UP DETECTED!", (20, 100), cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 255, 0), 3)

        # Convert to Base64
        _, buffer = cv2.imencode('.jpg', annotated_frame, [cv2.IMWRITE_JPEG_QUALITY, 50])
        b64_img = base64.b64encode(buffer).decode('utf-8')
        sio.emit('cctv_frame', {'image': b64_img})

        # Generate System Alarm
        if incident_type:
            current_time = time.time()
            if current_time - last_alert_time > ALERT_COOLDOWN:
                print(f"🚨 INCIDENT DETECTED (UPLOADED CCTV): {incident_type}!")
                incident_data = {
                    'id': f'INC-{int(time.time())}',
                    'type': incident_type,
                    'lat': 18.5204, # Pune location 
                    'lng': 73.8567,
                    'severity': 'CRITICAL',
                    'timestamp': int(current_time * 1000)
                }
                sio.emit('incident_alert', incident_data)
                last_alert_time = current_time

        # Run at ~30 FPS
        time.sleep(0.033)

except KeyboardInterrupt:
    print("CCTV Video Analysis interrupted by user.")
finally:
    cap.release()
    sio.disconnect()
    hands.close()
