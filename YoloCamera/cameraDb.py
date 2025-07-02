
import requests
from datetime import datetime

SUPABASE_URL = "https://nnfdzosgcjqvwoqlodku.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5uZmR6b3NnY2pxdndvcWxvZGt1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDc5NzcxMjMsImV4cCI6MjA2MzU1MzEyM30.m2aBBCsXoNqMKuV74DACxOXjPTcWAcxlMw4crqysX-o"

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
