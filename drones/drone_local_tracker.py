import cv2
import os
from ultralytics import YOLO

def run_local_video():
    video_path = '../project_assets/Movie on 28-02-26 at 2.02 PM.mov'
    
    if not os.path.exists(video_path):
        print(f"Error: Could not find video at {video_path}")
        return

    # Load the YOLO model
    model = YOLO('../project_assets/yolov8n.pt') 

    # Open the webcam (0 is usually the default laptop camera)
    cap = cv2.VideoCapture(0)
    
    print(f"Starting tracking on Live Webcam... Press 'q' to quit.")
    

    
    print("Starting tracking on Live Webcam... Press 'q' to quit.")
    
    frame_count = 0
    while cap.isOpened():
        success, frame = cap.read()
        if not success:
            break
            
        # Run tracking
        results = model.track(frame, persist=True, tracker="bytetrack.yaml", verbose=False)
        
        # Draw boxes
        annotated_frame = results[0].plot()
        
        # Display the live frame on the screen
        cv2.imshow("Hackathon AI Command Center", annotated_frame)
        
        # Press 'q' on your keyboard to stop the live feed (wait 1ms per frame for input)
        if cv2.waitKey(1) & 0xFF == ord('q'):
            break
        
        frame_count += 1
        if frame_count % 30 == 0:
            print(f"Processed {frame_count} frames...")

    cap.release()
    cv2.destroyAllWindows() # Close the video window
    print("\n✅ Webcam feed closed.")

if __name__ == "__main__":
    run_local_video()
