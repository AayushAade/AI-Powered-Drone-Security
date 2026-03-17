"""
Multi-Incident CCTV Detection Engine
Uses YOLOv11 for object detection with multi-frame confirmation to eliminate false positives.
"""

import cv2
import numpy as np
import time
import socketio
import requests
from ultralytics import YOLO

# ─── Configuration ───────────────────────────────────────────────────────────
BACKEND_URL = "http://localhost:3000"
CONFIDENCE_THRESHOLD = 0.65       # Only trust detections above 65% confidence
CONFIRMATION_FRAMES = 5           # Must see anomaly for 5 consecutive frames
ALERT_COOLDOWN_SEC = 30           # Seconds between repeated alerts of same type
FALL_ASPECT_RATIO = 1.3           # Width/Height ratio that indicates a fall
CROWD_THRESHOLD = 5               # Number of people to trigger crowd alert
ABANDONED_TIME_SEC = 3.0          # Seconds a bag must be alone to trigger alert
ABANDONED_DISTANCE_PX = 150       # Max pixel distance from a person to count as "attended"


# ─── Alert Tracker (multi-frame confirmation) ───────────────────────────────
class AlertTracker:
    """Requires N consecutive detections before firing an alert."""

    def __init__(self, required_frames=CONFIRMATION_FRAMES, cooldown=ALERT_COOLDOWN_SEC):
        self.required = required_frames
        self.cooldown = cooldown
        self.consecutive = 0
        self.last_alert_time = 0

    def update(self, detected: bool) -> bool:
        """Call every frame. Returns True only when confirmed AND cooldown expired."""
        if detected:
            self.consecutive += 1
        else:
            self.consecutive = 0
            return False

        if self.consecutive >= self.required:
            now = time.time()
            if now - self.last_alert_time >= self.cooldown:
                self.last_alert_time = now
                self.consecutive = 0  # reset after firing
                return True
        return False


def send_alert(alert_type, severity="High"):
    """Send alert to the backend command center."""
    payload = {
        "type": alert_type,
        "lat": 18.4575,
        "lng": 73.8508,
        "severity": severity,
        "camera_id": "CCTV-Main"
    }
    try:
        resp = requests.post(f"{BACKEND_URL}/api/alert", json=payload, timeout=3)
        if resp.ok:
            print(f"   ✅ Drone dispatched for: {alert_type}")
        else:
            print(f"   ⚠️ Backend rejected alert: {resp.status_code}")
    except Exception as e:
        print(f"   ❌ Failed to send alert: {e}")


def run_cctv_monitor():
    # ─── Connect to command center via WebSocket (for live video streaming) ──
    sio = socketio.Client()

    @sio.event
    def connect():
        print("[CCTV] ✅ Connected to Command Center")
        sio.emit('register', {'type': 'cctv', 'id': 'CCTV-Main'})

    try:
        sio.connect(BACKEND_URL)
    except Exception as e:
        print(f"[CCTV] ⚠️ WebSocket connection failed: {e}")
        return

    time.sleep(1)  # Let connection settle

    # ─── Load ONLY the object detection model (no pose = fewer false positives) ─
    print("Loading YOLOv11 Object Detection model...")
    det_model = YOLO("../project_assets/yolo11n.pt")
    print("✅ Model loaded.")

    # ─── Open webcam ─────────────────────────────────────────────────────────
    print("Connecting to laptop webcam...")
    cap = cv2.VideoCapture(0)
    if not cap.isOpened():
        print("❌ Cannot open webcam")
        sio.disconnect()
        return

    # ─── Alert trackers (one per incident type) ──────────────────────────────
    fall_tracker      = AlertTracker()
    crowd_tracker     = AlertTracker(required_frames=8)   # Crowd needs more confirmation
    abandoned_tracker = AlertTracker(required_frames=10)  # Abandoned needs even more

    # ─── Abandoned object tracking state ─────────────────────────────────────
    lonely_objects = {}  # {(cx, cy): first_seen_time}

    print("\n✅ CCTV Engine ACTIVE (multi-frame confirmation enabled)")
    print("   Detects: Falls | Crowd Gathering | Abandoned Objects")
    print(f"   Confidence threshold: {CONFIDENCE_THRESHOLD}")
    print(f"   Confirmation frames: {CONFIRMATION_FRAMES}\n")

    frame_count = 0

    try:
        while True:
            ret, frame = cap.read()
            if not ret:
                break

            frame_count += 1

            # Run detection every 2nd frame for performance
            if frame_count % 2 != 0:
                continue

            # ─── YOLO Object Detection ───────────────────────────────────────
            results = det_model(frame, verbose=False, conf=CONFIDENCE_THRESHOLD)

            person_boxes = []
            object_boxes = []  # bags, suitcases

            for r in results:
                for box in r.boxes:
                    cls = int(box.cls[0])
                    conf = float(box.conf[0])
                    x1, y1, x2, y2 = map(int, box.xyxy[0])
                    w, h = x2 - x1, y2 - y1
                    label = det_model.names[cls]

                    if label == 'person' and conf >= CONFIDENCE_THRESHOLD:
                        person_boxes.append((x1, y1, x2, y2, w, h, conf))
                        # Draw person box
                        cv2.rectangle(frame, (x1, y1), (x2, y2), (0, 255, 0), 2)
                        cv2.putText(frame, f"Person {conf:.0%}", (x1, y1 - 8),
                                    cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 255, 0), 1)

                    elif label in ('backpack', 'suitcase', 'handbag') and conf >= CONFIDENCE_THRESHOLD:
                        cx, cy = (x1 + x2) // 2, (y1 + y2) // 2
                        object_boxes.append((x1, y1, x2, y2, cx, cy, label, conf))
                        cv2.rectangle(frame, (x1, y1), (x2, y2), (0, 165, 255), 2)
                        cv2.putText(frame, f"{label} {conf:.0%}", (x1, y1 - 8),
                                    cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 165, 255), 1)

            num_people = len(person_boxes)

            # ─── DETECTION 1: Fallen Person ──────────────────────────────────
            fall_detected = False
            for (x1, y1, x2, y2, w, h, conf) in person_boxes:
                if h > 0 and w / h > FALL_ASPECT_RATIO:
                    fall_detected = True
                    cv2.putText(frame, "FALL?", (x1, y1 - 25),
                                cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 0, 255), 2)
                    break

            if fall_tracker.update(fall_detected):
                print(f"🚨 CONFIRMED: Fallen Person Detected")
                send_alert("Fallen Person Detected", "CRITICAL")

            # ─── DETECTION 2: Crowd Gathering ────────────────────────────────
            crowd_detected = num_people >= CROWD_THRESHOLD

            if crowd_tracker.update(crowd_detected):
                print(f"🚨 CONFIRMED: Crowd Gathering ({num_people} people)")
                send_alert(f"Crowd Gathering Detected ({num_people} people)", "High")

            # ─── DETECTION 3: Abandoned Object ───────────────────────────────
            abandoned_detected = False
            now = time.time()

            # Clean up old tracked objects
            lonely_objects = {k: v for k, v in lonely_objects.items() if now - v < ABANDONED_TIME_SEC * 2}

            for (ox1, oy1, ox2, oy2, ocx, ocy, olabel, oconf) in object_boxes:
                # Check if any person is near this object
                attended = False
                for (px1, py1, px2, py2, pw, ph, pconf) in person_boxes:
                    pcx, pcy = (px1 + px2) // 2, (py1 + py2) // 2
                    dist = np.sqrt((ocx - pcx) ** 2 + (ocy - pcy) ** 2)
                    if dist < ABANDONED_DISTANCE_PX:
                        attended = True
                        break

                if not attended:
                    # Find or create tracking entry (snap to nearest 30px grid)
                    key = (round(ocx / 30) * 30, round(ocy / 30) * 30)
                    if key not in lonely_objects:
                        lonely_objects[key] = now
                    elif now - lonely_objects[key] >= ABANDONED_TIME_SEC:
                        abandoned_detected = True
                        cv2.putText(frame, "ABANDONED!", (ox1, oy1 - 25),
                                    cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 0, 255), 2)
                else:
                    # Object is attended, remove from tracking
                    key = (round(ocx / 30) * 30, round(ocy / 30) * 30)
                    lonely_objects.pop(key, None)

            if abandoned_tracker.update(abandoned_detected):
                print(f"🚨 CONFIRMED: Abandoned Object Detected")
                send_alert("Abandoned Object Detected", "High")

            # ─── HUD Overlay ─────────────────────────────────────────────────
            cv2.putText(frame, f"CCTV ACTIVE | {num_people} people | Frame {frame_count}",
                        (10, 25), cv2.FONT_HERSHEY_SIMPLEX, 0.55, (200, 200, 200), 1)

            # Draw confirmation bars
            bar_y = 50
            for name, tracker, color in [
                ("Fall", fall_tracker, (0, 0, 255)),
                ("Crowd", crowd_tracker, (0, 165, 255)),
                ("Abandoned", abandoned_tracker, (255, 0, 255))
            ]:
                fill = min(tracker.consecutive / tracker.required, 1.0)
                cv2.rectangle(frame, (10, bar_y), (10 + int(150 * fill), bar_y + 12), color, -1)
                cv2.rectangle(frame, (10, bar_y), (160, bar_y + 12), (100, 100, 100), 1)
                cv2.putText(frame, f"{name}: {tracker.consecutive}/{tracker.required}",
                            (165, bar_y + 10), cv2.FONT_HERSHEY_SIMPLEX, 0.35, (200, 200, 200), 1)
                bar_y += 20

            # ─── Stream frame to dashboard ───────────────────────────────────
            _, buffer = cv2.imencode('.jpg', frame, [cv2.IMWRITE_JPEG_QUALITY, 60])
            frame_b64 = __import__('base64').b64encode(buffer).decode('utf-8')
            sio.emit('cctv_frame', {'image': frame_b64})

            # Status log every 60 frames
            if frame_count % 120 == 0:
                print(f"CCTV Active... (frame {frame_count} | {num_people} people)")

    except KeyboardInterrupt:
        print("\nCCTV shutdown.")
    finally:
        cap.release()
        print("✅ CCTV feed closed.")
        try:
            sio.disconnect()
        except:
            pass


if __name__ == "__main__":
    run_cctv_monitor()
