from fastapi import FastAPI, Response
from fastapi.responses import StreamingResponse, JSONResponse
import cv2, threading, time
from datetime import datetime
from ultralytics import YOLO
import pytesseract, difflib
from cameraDb import log_to_supabase
from gdrive_auth import upload_to_gdrive

app = FastAPI()
model = YOLO("weights.pt")
cap = cv2.VideoCapture(0, cv2.CAP_DSHOW)

latest_plate = {"plate": None, "confidence": 0.0, "timestamp": None}

KNOWN_PLATES = [
    'BAM 9267', 'AAA 4444', 'WVX 3589', 'WXM 3268', 'WSN 5634',
    'IIUM 6763', 'VS 2277', 'WXS 3465', 'BGN 6677', 'JFC 2218'
]

MATCH_THRESHOLD = 0.7

def get_nearest_plate(ocr_text: str):
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
    _, th = cv2.threshold(gray, 0,255, cv2.THRESH_BINARY+cv2.THRESH_OTSU)
    return cv2.GaussianBlur(th, (5,5), 0)

def detection_loop():
    global latest_plate
    while True:
        ret, frame = cap.read()
        if not ret:
            break

        res = model.predict(source=frame, conf=0.5, save=False)[0]
        if res.boxes:
            x1, y1, x2, y2 = map(int, res.boxes.xyxy[0].cpu().numpy())
            roi = frame[y1:y2, x1:x2]
            prep = preprocess_image(roi)
            raw = pytesseract.image_to_string(prep, config='--psm 8')
            ocr_plate = clean_text(raw)
            matched_plate, ratio = get_nearest_plate(ocr_plate)

            if matched_plate:
                ts = datetime.now().strftime('%Y%m%d_%H%M%S')
                cf = f"plate_{ts}.jpg"
                label = f"{matched_plate} ({ratio:.2f})"
                cv2.putText(frame, label, (x1, y1-10),
                            cv2.FONT_HERSHEY_SIMPLEX, 0.8, (0,255,0), 2)

                # save and upload
                cv2.imwrite(cf, frame)
                upload_to_gdrive(cf, folder_id="your-folder-id")
                log_to_supabase(bin_id=matched_plate, confidence=ratio, filename=cf)

            latest_plate = {"plate": matched_plate, "confidence": ratio, "timestamp": ts}

        time.sleep(0.03)  # ~30fps

threading.Thread(target=detection_loop, daemon=True).start()

def mjpeg_generator():
    while True:
        ret, frame = cap.read()
        if not ret:
            break
        _, jpg = cv2.imencode('.jpg', frame)
        yield (b"--frame\r\n"
               b"Content-Type: image/jpeg\r\n\r\n" + jpg.tobytes() + b"\r\n")

@app.get("/stream")
def stream_video():
    return StreamingResponse(mjpeg_generator(), media_type="multipart/x-mixed-replace; boundary=frame")

@app.get("/latest")
def get_latest():
    return JSONResponse(latest_plate)
