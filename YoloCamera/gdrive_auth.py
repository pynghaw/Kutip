from google_auth_oauthlib.flow import InstalledAppFlow
from googleapiclient.discovery import build
from googleapiclient.http import MediaFileUpload
from google.auth.transport.requests import Request
import os
import pickle

# Google Drive API scope
SCOPES = ['https://www.googleapis.com/auth/drive.file']

# Full absolute path to your credentials.json file
CREDENTIALS_PATH = r'C:\Users\User\Documents\GitHub\Kutip\YoloCamera\credentials.json'

# Path to token.pickle
TOKEN_PATH = 'token.pickle'

def authenticate():
    """Authenticate the user and return the Drive API service."""
    creds = None

    # Check if token.pickle exists (it stores user's access and refresh tokens)
    if os.path.exists(TOKEN_PATH):
        try:
            with open(TOKEN_PATH, 'rb') as token:
                creds = pickle.load(token)
        except Exception as e:
            print(f"Error loading token.pickle: {e}")

    # If no valid credentials, start the authentication flow
    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            try:
                creds.refresh(Request())
            except Exception as e:
                print(f"Error refreshing credentials: {e}")
        else:
            try:
                # Use the correct full path for credentials.json
                flow = InstalledAppFlow.from_client_secrets_file(CREDENTIALS_PATH, SCOPES)
                creds = flow.run_local_server(port=0)
            except Exception as e:
                print(f"Error during the authentication flow: {e}")

        # Save the credentials for the next run
        try:
            with open(TOKEN_PATH, 'wb') as token:
                pickle.dump(creds, token)
        except Exception as e:
            print(f"Error saving token.pickle: {e}")

    # Build the Drive API service
    try:
        service = build('drive', 'v3', credentials=creds)
    except Exception as e:
        print(f"Error building the Google Drive API service: {e}")
        return None

    return service

def upload_to_gdrive(file_path):
    """Uploads a file to Google Drive."""
    # Authenticate and get the Drive service
    service = authenticate()

    if service is None:
        print("Google Drive authentication failed.")
        return

    try:
        # Prepare file metadata and upload
        file_metadata = {'name': os.path.basename(file_path)}
        media = MediaFileUpload(file_path, resumable=True)
        request = service.files().create(media_body=media, body=file_metadata)
        response = request.execute()

        # Print response from Google Drive
        print(f"File uploaded to Google Drive: {response['id']}")
    except Exception as e:
        print(f"Error uploading file to Google Drive: {e}")
