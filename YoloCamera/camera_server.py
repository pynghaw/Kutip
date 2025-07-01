from fastapi import FastAPI, Response
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
import cv2
import pytesseract
import re
import difflib
from ultralytics import YOLO
from datetime import datetime
import json
import threading
import time
from typing import Optional
import io
from PIL import Image
import numpy as np
from gdrive_auth import upload_to_gdrive

# ——— CONFIG ———
MODEL_PATH = r"C:\Users\User\Documents\GitHub\Kutip\YoloCamera\weights.pt"
DRIVE_FOLDER_ID = "1oLqV0VLJiqyoGBDXwCQNo1zL3xu0lj56"
pytesseract.pytesseract.tesseract_cmd = r"C:\Program Files\Tesseract-OCR\tesseract.exe"

# Your fixed list of 10 bin IDs
KNOWN_PLATES = [
    'BAM 9267', 'AAA 4444', 'WVX 3589', 'WXM 3268', 'WSN 5634',
    'IIUM 6763', 'VS 2277', 'WXS 3465', 'BGN 6677', 'JFC 2218'
]
# Minimum similarity ratio (0–1) to accept a match
MATCH_THRESHOLD = 0.7

app = FastAPI()

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global variables to store latest detection
latest_detection = {
    "plate": None,
    "confidence": 0.0,
    "timestamp": None
}

# Camera and model instances
camera = None
model = None
detection_thread = None
stop_detection = False

def get_nearest_plate(ocr_text: str):
    """
    Returns (best_match, ratio). If best_ratio < MATCH_THRESHOLD, returns (None, best_ratio).
    """
    best_match = None
    best_ratio = 0.0
    for candidate in KNOWN_PLATES:
        ratio = difflib.SequenceMatcher(None, ocr_text, candidate).ratio()
        if ratio > best_ratio:
            best_ratio, best_match = ratio, candidate
    if best_ratio >= MATCH_THRESHOLD:
        return best_match, best_ratio
    return None, best_ratio

def preprocess_image(img):
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    _, th = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    return cv2.GaussianBlur(th, (5, 5), 0)

def rotate_180(img):
    return cv2.rotate(img, cv2.ROTATE_180)

def crop_borders(img):
    g = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    _, th = cv2.threshold(g, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    cnts, _ = cv2.findContours(th, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    if cnts:
        c = max(cnts, key=cv2.contourArea)
        x, y, w, h = cv2.boundingRect(c)
        return img[y:y+h, x:x+w]
    return img

def clean_text(s):
    return ''.join(ch for ch in s if ch.isalnum() or ch.isspace()).strip()

def detection_loop():
    """Background thread for continuous detection"""
    global latest_detection, camera, model, stop_detection
    
    while not stop_detection:
        if camera is None or model is None:
            time.sleep(1)
            continue
            
        ret, frame = camera.read()
        if not ret:
            time.sleep(0.1)
            continue

        res = model.predict(source=frame, conf=0.5, save=False)[0]
        if res.boxes:
            x1, y1, x2, y2 = map(int, res.boxes.xyxy[0].cpu().numpy())
            conf = float(res.boxes.conf[0].cpu().numpy())

            # crop & preprocess
            roi = frame[y1:y2, x1:x2]
            roi = crop_borders(roi)
            roi = rotate_180(roi)
            prep = preprocess_image(roi)

            # OCR + clean
            raw = pytesseract.image_to_string(prep, config='--psm 8')
            ocr_plate = clean_text(raw)

            # find best known match
            matched_plate, ratio = get_nearest_plate(ocr_plate)

            if matched_plate:
                ts = datetime.now().strftime('%Y%m%d_%H%M%S')
                cf = f"plate_{ts}.jpg"
                ff = f"full_{ts}.jpg"
                
                # Save images
                cv2.imwrite(ff, frame)
                cv2.imwrite(cf, roi)
                
                # Upload to Google Drive
                try:
                    upload_to_gdrive(cf, folder_id=DRIVE_FOLDER_ID)
                    print(f"📤 Uploaded {cf} to Google Drive")
                except Exception as e:
                    print(f"⚠️ Upload failed: {e}")
                
                latest_detection = {
                    "plate": matched_plate,
                    "confidence": ratio,
                    "timestamp": datetime.now().strftime('%Y-%m-%d %H:%M:%S')
                }
                print(f"✅ Matched: {matched_plate} | OCR='{ocr_plate}' | Ratio={ratio:.2f} | Conf={conf:.2f}")
            else:
                print(f"❌ No match above {MATCH_THRESHOLD:.2f}: OCR='{ocr_plate}' | Best ratio={ratio:.2f}")

        time.sleep(0.1)  # Small delay to prevent excessive CPU usage

def generate_frames():
    """Generate MJPEG stream frames"""
    global camera
    while True:
        if camera is None:
            time.sleep(1)
            continue
            
        ret, frame = camera.read()
        if not ret:
            time.sleep(0.1)
            continue

        # Convert frame to JPEG
        _, buffer = cv2.imencode('.jpg', frame)
        frame_bytes = buffer.tobytes()
        
        yield (b'--frame\r\n'
               b'Content-Type: image/jpeg\r\n\r\n' + frame_bytes + b'\r\n')

@app.on_event("startup")
async def startup_event():
    """Initialize camera and model on startup"""
    global camera, model, detection_thread, stop_detection
    
    try:
        # Initialize camera
        camera = cv2.VideoCapture(0, cv2.CAP_DSHOW)
        if not camera.isOpened():
            print("Error: Could not open camera")
            return
            
        # Load model
        model = YOLO(MODEL_PATH)
        print("[INFO] Camera and model initialized successfully")
        
        # Start detection thread
        stop_detection = False
        detection_thread = threading.Thread(target=detection_loop, daemon=True)
        detection_thread.start()
        
    except Exception as e:
        print(f"Error during startup: {e}")

@app.on_event("shutdown")
async def shutdown_event():
    """Clean up resources on shutdown"""
    global camera, stop_detection
    
    stop_detection = True
    if camera:
        camera.release()
    print("[INFO] Camera released")

@app.get("/")
async def root():
    return {"message": "Camera Detection Server", "status": "running"}

@app.get("/latest")
async def get_latest_detection():
    """Get the latest plate detection result"""
    return latest_detection

@app.get("/stream")
async def video_stream():
    """Stream MJPEG video feed"""
    return StreamingResponse(
        generate_frames(),
        media_type="multipart/x-mixed-replace; boundary=frame"
    )

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000) 