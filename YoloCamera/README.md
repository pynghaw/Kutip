# Camera Detection Server

This server provides real-time bin plate detection using YOLO and OCR, with a web interface for viewing the camera feed and detection results.

## Setup

1. **Install Python dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

2. **Ensure Tesseract OCR is installed:**
   - Download from: https://github.com/UB-Mannheim/tesseract/wiki
   - Install to: `C:\Program Files\Tesseract-OCR\`
   - The server expects tesseract.exe at this location

3. **Verify your camera is connected and accessible**

## Running the Server

### Option 1: Using the batch file (Windows)
```bash
start_server.bat
```

### Option 2: Direct Python command
```bash
python camera_server.py
```

The server will start on `http://localhost:8000`

## API Endpoints

- `GET /` - Server status
- `GET /latest` - Latest detection result (JSON)
- `GET /stream` - MJPEG camera stream

## Integration with Next.js

The React component `CameraViewer` in your Next.js app expects:
- Camera stream at: `http://localhost:8000/stream`
- Detection data at: `http://localhost:8000/latest`

## Configuration

Edit `camera_server.py` to modify:
- `KNOWN_PLATES` - List of valid plate numbers
- `MATCH_THRESHOLD` - Minimum similarity ratio (0.0-1.0)
- `MODEL_PATH` - Path to your YOLO weights file

## Troubleshooting

1. **Camera not found:** Check if your camera is connected and not in use by another application
2. **Tesseract error:** Verify tesseract.exe is installed at the expected path
3. **Model loading error:** Check that `weights.pt` exists at the specified path
4. **Port already in use:** Change the port in `camera_server.py` or stop other services using port 8000 