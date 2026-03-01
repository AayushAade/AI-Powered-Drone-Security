import cv2
import numpy as np
from ultralytics import YOLO

def detect_fall(bbox):
    """
    Heuristic rule: A person is typically taller than they are wide.
    If the bounding box width > height, it indicates a fall.
    """
    x1, y1, x2, y2 = bbox
    width = x2 - x1
    height = y2 - y1
    
    # Simple aspect ratio check
    aspect_ratio = width / max(height, 1)  # prevent division by zero
    
    # If width is greater than height, person might be fallen
    return aspect_ratio > 1.2

def run_heuristic_demo():
    print("Loading YOLOv8 Model...")
    model = YOLO('../../project_assets/yolov8n.pt') 
    
    print("\nStarting Webcam (Please stand up, then lean over or lie down to test!)")
    print("Press 'q' to quit.")
    
    # Try multiple camera indices in case 0 doesn't work (useful for MacOS)
    for i in range(2, -1, -1):
        cap = cv2.VideoCapture(i)
        if cap.isOpened():
            print(f"✅ Successfully opened camera index {i}")
            break
            
    if not cap.isOpened():
        print("❌ Error: Could not open any webcam. Please check permissions.")
        return

    while cap.isOpened():
        success, frame = cap.read()
        if not success:
            break
            
        # Run YOLO inference
        results = model.predict(frame, verbose=False)
        result = results[0]
        
        # We will draw our own boxes instead of using results.plot()
        annotated_frame = frame.copy()
        
        # Check every detected object
        if result.boxes:
            for box in result.boxes:
                # Class 0 is 'person' in COCO dataset
                class_id = int(box.cls[0])
                if class_id == 0: 
                    # Get the bounding box coordinates [x1, y1, x2, y2]
                    coords = box.xyxy[0].cpu().numpy()
                    
                    # Run our Heuristic Rule!
                    has_fallen = detect_fall(coords)
                    
                    x1, y1, x2, y2 = map(int, coords)
                    
                    # If fallen: Draw RED box and large ALERT text
                    if has_fallen:
                        color = (0, 0, 255) # Red (BGR format in OpenCV)
                        label = "🚨 FALL DETECTED! ALERT 🚨"
                        cv2.rectangle(annotated_frame, (x1, y1), (x2, y2), color, 4)
                        cv2.putText(annotated_frame, label, (x1, max(30, y1 - 10)), 
                                    cv2.FONT_HERSHEY_SIMPLEX, 1, color, 3)
                        
                        # Add a visual flash to the whole screen
                        overlay = annotated_frame.copy()
                        cv2.rectangle(overlay, (0, 0), (annotated_frame.shape[1], annotated_frame.shape[0]), (0, 0, 255), -1)
                        annotated_frame = cv2.addWeighted(overlay, 0.2, annotated_frame, 0.8, 0)
                        
                    # If normal: Draw GREEN box
                    else:
                        color = (0, 255, 0) # Green
                        label = "Person: Standing/Walking"
                        cv2.rectangle(annotated_frame, (x1, y1), (x2, y2), color, 2)
                        cv2.putText(annotated_frame, label, (x1, max(20, y1 - 10)), 
                                    cv2.FONT_HERSHEY_SIMPLEX, 0.6, color, 2)

        
        # Display the result
        cv2.imshow("Heuristic AI Demo - Fall Detection", annotated_frame)
        
        if cv2.waitKey(1) & 0xFF == ord('q'):
            break

    cap.release()
    cv2.destroyAllWindows()
    print("\n✅ Demo closed.")

if __name__ == "__main__":
    run_heuristic_demo()
