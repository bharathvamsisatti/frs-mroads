import cv2
import time
import requests
import numpy as np
import threading
import logging
import base64
from datetime import datetime

# Setup logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Configuration
STREAMS = [
    {"id": "phone-entry", "name": "Phone 1 (Entry)", "url": "http://172.16.3.185:8080/video"},
    {"id": "phone-exit", "name": "Phone 2 (Exit)", "url": "http://172.16.3.199:8080/video"}
]

# Redirecting to 9090 since that's where the backend is expected
RECOGNIZE_API = "http://localhost:9090/recognize"
ATTENDANCE_API = "http://localhost:8000/api/save-attendance"
PROCESS_INTERVAL = 0.5  # Faster processing for tracking
MIN_CONFIDENCE = 0.6
IOU_THRESHOLD = 0.3    # Threshold for matching boxes
TRACK_TIMEOUT = 2.0    # Seconds to keep a track alive after losing it

def calculate_iou(boxA, boxB):
    xA = max(boxA[0], boxB[0])
    yA = max(boxA[1], boxB[1])
    xB = min(boxA[2], boxB[2])
    yB = min(boxA[3], boxB[3])
    interArea = max(0, xB - xA + 1) * max(0, yB - yA + 1)
    boxAArea = (boxA[2] - boxA[0] + 1) * (boxA[3] - boxA[1] + 1)
    boxBArea = (boxB[2] - boxB[0] + 1) * (boxB[3] - boxB[1] + 1)
    iou = interArea / float(boxAArea + boxBArea - interArea)
    return iou

class IoUTracker:
    def __init__(self):
        self.tracks = {} # {track_id: {"bbox": [], "identity": None, "last_seen": timestamp}}
        self.next_id = 0

    def update(self, detected_boxes):
        now = time.time()
        new_tracks = {}
        
        # 1. Match detected boxes to existing tracks
        for box in detected_boxes:
            best_iou = 0
            best_id = None
            
            for tid, track in self.tracks.items():
                iou = calculate_iou(box, track["bbox"])
                if iou > best_iou and iou > IOU_THRESHOLD:
                    best_iou = iou
                    best_id = tid
            
            if best_id is not None:
                # Update existing track
                self.tracks[best_id]["bbox"] = box
                self.tracks[best_id]["last_seen"] = now
                new_tracks[best_id] = self.tracks[best_id]
                del self.tracks[best_id]
            else:
                # Create new track
                new_tracks[self.next_id] = {
                    "bbox": box,
                    "identity": None,
                    "last_seen": now,
                    "recognized": False
                }
                self.next_id += 1
        
        # 2. Keep old tracks around for a timeout period (occlusion/noise handling)
        for tid, track in self.tracks.items():
            if now - track["last_seen"] < TRACK_TIMEOUT:
                new_tracks[tid] = track
        
        self.tracks = new_tracks
        return self.tracks

class StreamProcessor(threading.Thread):
    def __init__(self, stream_config):
        super().__init__()
        self.stream_id = stream_config["id"]
        self.stream_name = stream_config["name"]
        self.stream_url = stream_config["url"]
        self.running = True
        self.daemon = True
        self.tracker = IoUTracker()

    def run(self):
        logger.info(f"Starting IoU Tracker for {self.stream_name}...")
        
        while self.running:
            cap = cv2.VideoCapture(self.stream_url)
            if not cap.isOpened():
                logger.error(f"Stream {self.stream_name} unreachable. Retry in 5s...")
                time.sleep(5)
                continue

            while self.running:
                ret, frame = cap.read()
                if not ret: break

                # 1. Simple Motion/Detection check (For actual IoU we need bboxes)
                # Since we don't have a local detector here, we use the API to get bboxes 
                # but only when needed or at a subset of frames.
                # HOWEVER: For true tracking, we need the backend to return BBOXES.
                
                self.process_frame(frame)
                time.sleep(PROCESS_INTERVAL)

            cap.release()
            time.sleep(1)

    def process_frame(self, frame):
        try:
            _, buffer = cv2.imencode('.jpg', frame)
            img_b64 = base64.b64encode(buffer).decode('utf-8')

            # Send to Backend (9090)
            response = requests.post(RECOGNIZE_API, json={"content": img_b64}, timeout=5)
            if response.status_code != 200: return

            result = response.json()
            matches = result.get("matches", [])
            
            # Extract boxes from API response
            detected_boxes = []
            for m in matches:
                if "bbox" in m:
                    # m["bbox"] is [x, y, w, h] or similar. Converting to [x1, y1, x2, y2]
                    b = m["bbox"]
                    detected_boxes.append([b[0], b[1], b[0]+b[2], b[1]+b[3]])

            # Update Tracker
            current_tracks = self.tracker.update(detected_boxes)

            # Process Identities
            for tid, track in current_tracks.items():
                # Find match for this bbox in the API result
                for m in matches:
                    b = m["bbox"]
                    box = [b[0], b[1], b[0]+b[2], b[1]+b[3]]
                    if calculate_iou(box, track["bbox"]) > 0.8:
                        identity = m.get("identity", "Unknown")
                        score = m.get("average_score", 0.0)
                        
                        # Only Mark Attendance ONCE per track session
                        if identity != "Unknown" and score >= MIN_CONFIDENCE and not track.get("recognized"):
                            logger.info(f"[{self.stream_name}] NEW TRACK {tid}: {identity} ({score:.2f})")
                            self.save_attendance(identity, score)
                            track["recognized"] = True
                            track["identity"] = identity

        except Exception as e:
            logger.error(f"Error in {self.stream_name}: {str(e)}")

    def save_attendance(self, person_id, confidence):
        try:
            data = {
                "person_id": person_id,
                "status": "success",
                "confidence": confidence,
                "camera_name": self.stream_name,
                "matching_mode": "1:N"
            }
            requests.post(ATTENDANCE_API, data=data, timeout=5)
        except: pass

if __name__ == "__main__":
    for config in STREAMS:
        StreamProcessor(config).start()
    while True: time.sleep(1)
