import cv2, pytesseract, re, difflib
from ultralytics import YOLO
from datetime import datetime
from gdrive_auth import upload_to_gdrive
from cameraDb import log_to_supabase

# ——— CONFIG ———
MODEL_PATH      = r"C:\xampp\htdocs\Kutip\YoloCamera\weights.pt"
DRIVE_FOLDER_ID = "1oLqV0VLJiqyoGBDXwCQNo1zL3xu0lj56"
pytesseract.pytesseract.tesseract_cmd = r"C:\Program Files\Tesseract-OCR\tesseract.exe"

# Your fixed list of 10 bin IDs
KNOWN_PLATES = [
    'BAM 9267', 'AAA 4444', 'WVX 3589', 'WXM 3268', 'WSN 5634',
    'IIUM 6763', 'VS 2277', 'WXS 3465', 'BGN 6677', 'JFC 2218'
]
# Minimum similarity ratio (0–1) to accept a match
MATCH_THRESHOLD = 0.7

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

# Load model & camera
model = YOLO(MODEL_PATH)
cap   = cv2.VideoCapture(0, cv2.CAP_DSHOW)
print("[INFO] Starting detection…")

while True:
    ret, frame = cap.read()
    if not ret:
        break

    res = model.predict(source=frame, conf=0.5, save=False)[0]
    if res.boxes:
        x1,y1,x2,y2 = map(int, res.boxes.xyxy[0].cpu().numpy())
        conf = float(res.boxes.conf[0].cpu().numpy())

        # draw bounding box
        cv2.rectangle(frame, (x1,y1),(x2,y2),(0,255,0),2)

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

        # show cropped region
        cv2.imshow("Cropped Plate", roi)

        if matched_plate:
            ts = datetime.now().strftime('%Y%m%d_%H%M%S')
            cf = f"plate_{ts}.jpg"
            ff = f"full_{ts}.jpg"
            label = f"{matched_plate} ({ratio:.2f})"
            # overlay matched label
            cv2.putText(frame, label, (x1, y1-10),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.8, (0,255,0), 2)
            print(f"✅ Matched: {matched_plate} | OCR='{ocr_plate}' | Ratio={ratio:.2f} | Conf={conf:.2f}")

            # save & upload
            cv2.imwrite(ff, frame)
            cv2.imwrite(cf, roi)
            upload_to_gdrive(cf, folder_id=DRIVE_FOLDER_ID)
            log_to_supabase(bin_id=matched_plate, confidence=conf, filename=cf)
        else:
            # no good match—ignore this detection
            print(f"❌ No match above {MATCH_THRESHOLD:.2f}: OCR='{ocr_plate}' | Best ratio={ratio:.2f}")

    # display full frame
    cv2.imshow("Bin Plate Detection", frame)
    if cv2.waitKey(1) & 0xFF == ord('q'):
        break

cap.release()
cv2.destroyAllWindows()
