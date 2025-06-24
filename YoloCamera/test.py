import cv2
from ultralytics import YOLO
from datetime import datetime
import pytesseract  # OCR for extracting the plate number
from gdrive_auth import upload_to_gdrive  # Function to upload to Google Drive
from cameraDb import log_to_supabase  # Function to log to Supabase
import re

# Load the YOLO model
model = YOLO(r"C:\Users\User\Documents\GitHub\Kutip\YoloCamera\weights.pt")
cap = cv2.VideoCapture(0, cv2.CAP_DSHOW)

# Tesseract OCR path
pytesseract.pytesseract.tesseract_cmd = r"C:\Program Files\Tesseract-OCR\tesseract.exe"

print("[INFO] Starting automatic detection...")

def preprocess_image(cropped_plate):
    gray = cv2.cvtColor(cropped_plate, cv2.COLOR_BGR2GRAY)
    _, thresh = cv2.threshold(
        gray, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU
    )
    return cv2.GaussianBlur(thresh, (5, 5), 0)

def rotate_image_180(image):
    return cv2.rotate(image, cv2.ROTATE_180)

def crop_plate_borders(cropped_plate):
    gray = cv2.cvtColor(cropped_plate, cv2.COLOR_BGR2GRAY)
    _, thresh = cv2.threshold(
        gray, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU
    )
    contours, _ = cv2.findContours(
        thresh, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE
    )
    # Find the largest contour (assumed plate)
    if contours:
        c = max(contours, key=cv2.contourArea)
        x, y, w, h = cv2.boundingRect(c)
        cropped_plate = cropped_plate[y:y+h, x:x+w]
    return cropped_plate

def clean_plate_text(plate_text):
    # Keep only alphanumeric and spaces
    cleaned = ''.join(c for c in plate_text if c.isalnum() or c.isspace())
    return cleaned.strip()

while True:
    ret, frame = cap.read()
    if not ret:
        print("❌ Failed to read frame")
        break

    # Perform YOLOv8 detection
    result = model.predict(source=frame, conf=0.5, save=False)[0]

    if result.boxes:
        # Only handle the first detected box to avoid rapid repeats
        x1, y1, x2, y2 = map(int, result.boxes.xyxy[0].cpu().numpy())
        conf = float(result.boxes.conf[0].cpu().numpy())
        
        # Draw rectangle on full frame
        cv2.rectangle(frame, (x1, y1), (x2, y2), (0, 255, 0), 2)

        # Crop and process the plate region
        plate_roi = frame[y1:y2, x1:x2]
        plate_roi = crop_plate_borders(plate_roi)
        plate_roi = rotate_image_180(plate_roi)
        prepped = preprocess_image(plate_roi)

        # OCR and clean text
        raw_text = pytesseract.image_to_string(prepped, config='--psm 8')
        plate_text = clean_plate_text(raw_text)

        # Show the cropped plate in its own window
        cv2.imshow("Cropped Plate", plate_roi)

        # Save & upload only when valid text or high confidence
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        crop_filename = f"plate_{timestamp}.jpg"
        full_filename = f"full_{timestamp}.jpg"
        if plate_text:
            print(f"✅ Detected Plate: {plate_text} | Confidence: {conf:.2f}")
            cv2.imwrite(full_filename, frame)
            cv2.imwrite(crop_filename, plate_roi)
            upload_to_gdrive(crop_filename)
            log_to_supabase(bin_id=plate_text, confidence=conf, filename=crop_filename)
        else:
            print("❌ OCR failed to read alphanumeric text. Retrying...")

    # Show full-frame with bounding box
    cv2.imshow("Bin Plate Detection", frame)

    # Wait for 'q' key to stop and close the camera feed
    if cv2.waitKey(1) & 0xFF == ord('q'):
        break

# Release the camera and close any OpenCV windows
cap.release()
cv2.destroyAllWindows()
