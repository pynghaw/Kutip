import cv2
from ultralytics import YOLO
from datetime import datetime
import pytesseract  # OCR for extracting the plate number
from gdrive_auth import upload_to_gdrive  # Function to upload to Google Drive
from cameraDb import log_to_supabase  # Function to log to Supabase
import os
import re

# Load the YOLO model
model = YOLO("weights.pt")
cap = cv2.VideoCapture(0, cv2.CAP_DSHOW)

# Tesseract OCR path (Ensure Tesseract is installed)
pytesseract.pytesseract.tesseract_cmd = r"C:\Program Files\Tesseract-OCR\tesseract.exe"

print("[INFO] Press 'c' to capture and detect, 'q' to quit.")
print("[INFO] Make sure the camera window is active (click it) before pressing keys.")

# Preprocess the image for better OCR accuracy
def preprocess_image(cropped_plate):
    gray = cv2.cvtColor(cropped_plate, cv2.COLOR_BGR2GRAY)
    _, thresh = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    return cv2.GaussianBlur(thresh, (5, 5), 0)

# Function to rotate the image 180 degrees
def rotate_image_180(image):
    return cv2.rotate(image, cv2.ROTATE_180)

# Function to crop tightly around the detected plate (to remove unwanted border)
def crop_plate_borders(cropped_plate):
    # Convert to grayscale and find contours to remove extra space
    gray = cv2.cvtColor(cropped_plate, cv2.COLOR_BGR2GRAY)
    _, thresh = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    
    # Find contours
    contours, _ = cv2.findContours(thresh, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    for contour in contours:
        # Get bounding box for each contour
        x, y, w, h = cv2.boundingRect(contour)
        # Crop the plate more tightly around the bounding box
        cropped_plate = cropped_plate[y:y+h, x:x+w]
    
    return cropped_plate

# Function to clean up OCR results and remove unwanted characters
def clean_plate_text(plate_text):
    # Remove leading negative signs or unwanted characters (e.g., ' — ')
    cleaned_text = plate_text.strip()
    if cleaned_text.startswith('—'):
        cleaned_text = cleaned_text[1:].strip()
    return cleaned_text

while True:
    ret, frame = cap.read()
    if not ret:
        print("❌ Failed to read frame")
        break

    cv2.imshow("Bin Plate Detection", frame)
    key = cv2.waitKey(1) & 0xFF

    if key == ord('c'):
        print("[INFO] Capturing image and running YOLOv8 detection...")
        result = model.predict(source=frame, conf=0.5, save=False)[0]

        if result.boxes:
            boxes = result.boxes.xyxy.cpu().numpy()
            confidences = result.boxes.conf.cpu().numpy()

            for idx, ((x1, y1, x2, y2), conf) in enumerate(zip(boxes, confidences)):
                # Draw rectangle
                cv2.rectangle(frame, (int(x1), int(y1)), (int(x2), int(y2)), (0, 255, 0), 2)

                # Crop the detected plate
                cropped_plate = frame[int(y1):int(y2), int(x1):int(x2)]

                # Optionally, crop plate more tightly to remove borders
                cropped_plate = crop_plate_borders(cropped_plate)

                # Rotate image 180 degrees (if the plate is upside down)
                rotated_plate = rotate_image_180(cropped_plate)

                # Preprocess the rotated plate for OCR
                preprocessed_plate = preprocess_image(rotated_plate)

                # Apply OCR to extract plate text
                plate_text = pytesseract.image_to_string(preprocessed_plate, config='--psm 8').strip()

                # Clean the OCR result by removing leading '-' (if it's mistakenly detected)
                plate_text = clean_plate_text(plate_text)

                # Use timestamp as unique filename
                timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
                full_filename = f"full_plate_{timestamp}.jpg"
                crop_filename = f"plate_{timestamp}.jpg"

                # Save images (both full frame and cropped plate)
                cv2.imwrite(full_filename, frame)
                cv2.imwrite(crop_filename, rotated_plate)

                print(f"✅ Plate Detected: {plate_text or 'N/A'} | Confidence: {conf:.2f}")
                print(f"📝 Saved crop as {crop_filename} and full frame as {full_filename}")

                # Upload to Google Drive
                upload_to_gdrive(crop_filename)

                # Log to Supabase
                log_to_supabase(
                    bin_id=plate_text if plate_text else "Unrecognized",
                    confidence=float(conf),
                    filename=crop_filename
                )
        else:
            print("❌ No bin plate detected.")

    elif key == ord('q'):
        break

cap.release()
cv2.destroyAllWindows()
