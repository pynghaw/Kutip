import cv2, pytesseract, re
from ultralytics import YOLO
from datetime import datetime
from gdrive_auth import upload_to_gdrive
from cameraDb import log_to_supabase

# ——— CONFIG ———
MODEL_PATH      = r"C:\Users\User\Documents\GitHub\Kutip\YoloCamera\weights.pt"
DRIVE_FOLDER_ID = "1oLqV0VLJiqyoGBDXwCQNo1zL3xu0lj56"
pytesseract.pytesseract.tesseract_cmd = r"C:\Program Files\Tesseract-OCR\tesseract.exe"

# Load model & camera
model = YOLO(MODEL_PATH)
cap   = cv2.VideoCapture(0, cv2.CAP_DSHOW)
print("[INFO] Starting detection…")

def preprocess_image(img):
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    _, th = cv2.threshold(gray, 0,255, cv2.THRESH_BINARY+cv2.THRESH_OTSU)
    return cv2.GaussianBlur(th, (5,5), 0)

def rotate_180(img): return cv2.rotate(img, cv2.ROTATE_180)

def crop_borders(img):
    g = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    _, th = cv2.threshold(g, 0,255, cv2.THRESH_BINARY+cv2.THRESH_OTSU)
    cnts,_ = cv2.findContours(th, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    if cnts:
        c = max(cnts, key=cv2.contourArea)
        x,y,w,h = cv2.boundingRect(c)
        return img[y:y+h, x:x+w]
    return img

def clean_text(s):
    return ''.join(ch for ch in s if ch.isalnum() or ch.isspace()).strip()

while True:
    ret, frame = cap.read()
    if not ret: break

    res = model.predict(source=frame, conf=0.5, save=False)[0]
    if res.boxes:
        # first detection only
        x1,y1,x2,y2 = map(int, res.boxes.xyxy[0].cpu().numpy())
        conf = float(res.boxes.conf[0].cpu().numpy())

        # draw box
        cv2.rectangle(frame, (x1,y1),(x2,y2),(0,255,0),2)
        roi = frame[y1:y2, x1:x2]
        roi = crop_borders(roi)
        roi = rotate_180(roi)
        prep = preprocess_image(roi)

        # OCR
        raw = pytesseract.image_to_string(prep, config='--psm 8')
        plate = clean_text(raw)

        cv2.imshow("Cropped Plate", roi)

        if plate:
            ts = datetime.now().strftime('%Y%m%d_%H%M%S')
            cf = f"plate_{ts}.jpg"
            ff = f"full_{ts}.jpg"
            print(f"✅ {plate} ({conf:.2f})")
            cv2.imwrite(ff, frame)
            cv2.imwrite(cf, roi)
            upload_to_gdrive(cf, folder_id=DRIVE_FOLDER_ID)
            log_to_supabase(bin_id=plate, confidence=conf, filename=cf)
        else:
            print("⚠️ OCR failed… retry")

    cv2.imshow("Bin Plate Detection", frame)
    if cv2.waitKey(1) & 0xFF == ord('q'):
        break

cap.release()
cv2.destroyAllWindows()
