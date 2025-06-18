import cv2

cap = cv2.VideoCapture(0, cv2.CAP_DSHOW)
ret, frame = cap.read()
if ret:
    print("✅ Webcam capture successful!")
else:
    print("❌ Webcam failed to capture.")

cap.release()
