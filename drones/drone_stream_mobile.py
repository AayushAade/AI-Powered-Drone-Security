import cv2
import os
import base64
import socketio
import time
from ultralytics import YOLO

def run_local_video():
    # Connect to Node.js backend
    sio = socketio.Client()
    try:
        sio.connect('http://localhost:3000')
        print("✅ Connected to Command Center Backend")
        time.sleep(1) # Wait for connection to fully initialize
    except Exception as e:
        print(f"Failed to connect to backend: {e}")
        return

    # Load the YOLO model
    model = YOLO('../project_assets/yolo11n.pt') 

    video_url = "http://192.0.0.4:8080/video"
    print(f"Connecting Drone Feed to Mobile Hotspot ({video_url})...")
    cap = cv2.VideoCapture(video_url)
    cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)
    if not cap.isOpened():
        print(f"❌ Error: Drone could not open local webcam.")
        return
    
    print("✅ Waiting for backend connection to settle...")
    time.sleep(1) # Wait for connection to fully initialize

    print("Starting tracking on Live Webcam... Press 'q' to quit.")
    cv2.namedWindow("Hackathon AI Command Center", cv2.WINDOW_NORMAL)
    
    frame_count = 0
    while cap.isOpened():
        success, frame = cap.read()
        if not success:
            break
            
        frame = cv2.resize(frame, (640, 480))
            
        # Run tracking
        results = model.track(frame, persist=True, tracker="bytetrack.yaml", verbose=False)
        
        # Draw boxes
        annotated_frame = results[0].plot()
        
        # Display the live frame on the screen
        cv2.imshow("Hackathon AI Command Center", annotated_frame)
        
        # Encode frame to Base64 and send over WebSocket
        _, buffer = cv2.imencode('.jpg', annotated_frame, [int(cv2.IMWRITE_JPEG_QUALITY), 30])
        frame_base64 = base64.b64encode(buffer).decode('utf-8')
        sio.emit('video_frame', {'image': frame_base64})

        # Press 'q' on your keyboard to stop the live feed (wait 1ms per frame for input)
        if cv2.waitKey(1) & 0xFF == ord('q'):
            break
        
        frame_count += 1
        if frame_count % 30 == 0:
            print(f"Processed {frame_count} frames...")

    cap.release()
    cv2.destroyAllWindows() # Close the video window
    sio.disconnect()
    print("\n✅ Webcam feed closed.")

if __name__ == "__main__":
    run_local_video()
