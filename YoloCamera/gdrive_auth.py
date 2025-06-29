from google_auth_oauthlib.flow import InstalledAppFlow
from googleapiclient.discovery import build
from googleapiclient.http import MediaFileUpload     # ← make sure this is here
from google.auth.transport.requests import Request
import os, pickle

SCOPES = ['https://www.googleapis.com/auth/drive']

CREDENTIALS_PATH = r'C:\xampp\htdocs\Kutip\YoloCamera\credentials.json'
TOKEN_PATH = 'token.pickle'

def authenticate():
    creds = None
    if os.path.exists(TOKEN_PATH):
        with open(TOKEN_PATH, 'rb') as token:
            creds = pickle.load(token)
    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            creds.refresh(Request())
        else:
            flow = InstalledAppFlow.from_client_secrets_file(CREDENTIALS_PATH, SCOPES)
            creds = flow.run_local_server(port=0)
        with open(TOKEN_PATH, 'wb') as token:
            pickle.dump(creds, token)
    return build('drive', 'v3', credentials=creds)

def upload_to_gdrive(file_path, folder_id=None):
    service = authenticate()
    if service is None:
        print("⚠️ Drive auth failed.")
        return
    metadata = {'name': os.path.basename(file_path)}
    if folder_id:
        metadata['parents'] = [folder_id]
    media = MediaFileUpload(file_path, resumable=True)
    file = service.files().create(media_body=media, body=metadata).execute()
    print(f"✔️ Uploaded {file_path} → Drive ID {file.get('id')}")
