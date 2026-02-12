"""
Ensure Supabase storage buckets exist for the application.
Run this once after setting up Supabase.

Usage:
    python scripts/ensure_buckets.py
"""

import sys
import os

# Add the src directory to Python path
sys.path.append(os.path.join(os.path.dirname(__file__), "..", "src"))

from src.app.services.supabase_storage_service import supabase_storage_service

if __name__ == "__main__":
    print("🪣 Ensuring Supabase storage buckets exist...")
    print(f"   - {supabase_storage_service.bucket_name}")
    print(f"   - {supabase_storage_service.default_images_bucket}\n")

    supabase_storage_service.ensure_buckets_exist()

    print("\n✅ Bucket verification complete!")
