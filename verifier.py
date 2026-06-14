import os
import time
import requests
from PIL import Image
from io import BytesIO
from supabase import create_client, Client
from transformers import pipeline

# 1. Live Production Credentials
SUPABASE_URL = "https://qzwthwaubqmqjksgujwr.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF6d3Rod2F1YnFtcWprc2d1andyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEzNDc4OTksImV4cCI6MjA5NjkyMzg5OX0.goKx7P4sQT9igWDZdRb7lqIhPnaFjXCwG-fYTDujjRw"

print("📡 Connecting to Live Supabase Database...")
try:
    supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
    print("🚀 Connected successfully!")
except Exception as e:
    print(f"❌ Supabase Connection Failed: {e}")
    exit(1)

# 2. Load the Specialized Deepfake Detector Model
print("\n⏳ Loading Deep Learning Model (prithivMLmods/Deep-Fake-Detector-v2-Model)...")
try:
    detector = pipeline("image-classification", model="prithivMLmods/Deep-Fake-Detector-v2-Model")
    print("✅ Advanced Deepfake Detector Ready & Active!")
except Exception as e:
    print(f"❌ Failed to load DL model: {e}")
    exit(1)

def process_pending_predictions():
    """Pulls uncalculated rows from Supabase, processes them, and saves findings."""
    try:
        response = supabase.table("predictions").select("*").eq("real_percentage", 0).eq("ai_percentage", 0).execute()
        records = response.data

        if not records:
            return False

        print(f"\n📦 Found {len(records)} pending image(s) to verify!")

        for record in records:
            record_id = record["id"]
            image_url = record.get("image_url")

            if not image_url:
                continue

            print(f"\n🔍 Analyzing Record ID: {record_id}")
            print(f"🔗 Pulling Image: {image_url}")

            img_response = requests.get(image_url, timeout=15)
            img = Image.open(BytesIO(img_response.content)).convert("RGB")

            results = detector(img)
            
            real_score = 0.0
            ai_score = 0.0
            
            for pred in results:
                label = pred["label"].lower()
                if "real" in label:
                    real_score = pred["score"]
                elif "fake" in label or "deepfake" in label or "ai" in label:
                    ai_score = pred["score"]

            total_score = real_score + ai_score
            if total_score > 0:
                real_score /= total_score
                ai_score /= total_score

            real_percentage = int(real_score * 100)
            ai_percentage = int(ai_score * 100)
            
            if real_percentage == 0 and ai_percentage == 0:
                ai_percentage = 100 
            
            true_label = "Real" if real_percentage >= ai_percentage else "AI Generated"

            print(f"📊 Deep Learning Output -> Real: {real_percentage}% | AI: {ai_percentage}%")

            supabase.table("predictions").update({
                "real_percentage": real_percentage,
                "ai_percentage": ai_percentage,
                "true_label": true_label
            }).eq("id", record_id).execute()
            
            print(f"💾 Live database updated successfully for ID: {record_id}!")
        return True

    except Exception as e:
        print(f"❌ Error while running analysis batch: {e}")
        return False

if __name__ == "__main__":
    print("\n⚡ Background Listener Script Started. Press Ctrl+C to stop anytime.")
    print("🟢 Monitoring database live for incoming website uploads...")
    
    last_heartbeat = time.time()
    
    while True:
        processed = process_pending_predictions()
        if not processed and (time.time() - last_heartbeat > 30):
            print("💤 Standing by... Watching live Supabase table for changes.")
            last_heartbeat = time.time()
            
        time.sleep(3)
