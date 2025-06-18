from fastapi import FastAPI, Response
from fastapi.responses import StreamingResponse, JSONResponse
import cv2, io, threading, time
from ultralytics import YOLO
# … your OCR imports …

app = FastAPI()
model = YOLO("weights.pt")
cap = cv2.VideoCapture(0, cv2.CAP_DSHOW)

latest_plate = {"plate": None, "confidence": 0.0, "timestamp": None}

def detection_loop():
    global latest_plate
    while True:
        ret, frame = cap.read()
        if not ret:
            break
        # … run YOLO, OCR, set latest_plate …
        time.sleep(0.03)  # ~30fps

threading.Thread(target=detection_loop, daemon=True).start()

def mjpeg_generator():
    while True:
        ret, frame = cap.read()
        if not ret:
            break
        # draw boxes on frame …
        _, jpg = cv2.imencode('.jpg', frame)
        yield (b"--frame\r\n"
               b"Content-Type: image/jpeg\r\n\r\n" + jpg.tobytes() + b"\r\n")

@app.get("/stream")
def stream_video():
    return StreamingResponse(mjpeg_generator(), media_type="multipart/x-mixed-replace; boundary=frame")

@app.get("/latest")
def get_latest():
    return JSONResponse(latest_plate)
