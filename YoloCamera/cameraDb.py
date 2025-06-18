
import requests
from datetime import datetime

SUPABASE_URL = "https://your_project.supabase.co"
SUPABASE_KEY = "your_anon_or_service_role_key"

def log_to_supabase(bin_id, confidence, filename):
    payload = {
        "bin_id": bin_id,
        "confidence": confidence,
        "image_name": filename,
        "timestamp": datetime.now().isoformat()
    }
    headers = {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Content-Type": "application/json"
    }
    res = requests.post(
        f"{SUPABASE_URL}/rest/v1/bin_logs",
        json=payload,
        headers=headers
    )
    print("📬 Supabase log status:", res.status_code)
