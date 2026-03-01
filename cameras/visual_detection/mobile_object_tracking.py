import cv2
from ultralytics import YOLO
import time

def run_mobile_video():
    model = YOLO('../../project_assets/yolov8n.pt') 
    
    # Standard URL endpoint for IP Webcam apps is usually /video
    video_url = "https://100.80.198.142:8080/video" 
    
    print(f"Connecting to Simulated Drone Feed at {video_url}...")
    # Add a small delay to make sure the endpoint is ready
    time.sleep(1)
    
    cap = cv2.VideoCapture(video_url)
    
    if not cap.isOpened():
        print(f"❌ Error: Could not open the video stream at {video_url}")
        print("Please check if the app is broadcasting and the IP is correct (some apps use /video or /manager).")
        return
        
    print("✅ Connected! Press 'q' to quit the visual feed popup.")
    
    while cap.isOpened():
        success, frame = cap.read()
        if not success:
            print("Failed to read frame or stream ended.")
            break
            
        results = model.track(frame, persist=True, tracker="bytetrack.yaml", verbose=False)
        annotated_frame = results[0].plot()
        
        cv2.imshow("Drone Feed AI Analysis", annotated_frame)
        
        # Press 'q' to exit
        if cv2.waitKey(1) & 0xFF == ord('q'):
            break

    cap.release()
    cv2.destroyAllWindows()
    print("\n✅ Drone feed disconnected.")

if __name__ == "__main__":
    run_mobile_video()
