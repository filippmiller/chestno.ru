#!/usr/bin/env python3
"""
Test Supabase login directly to debug authentication issues.
"""
import os
import sys
from pathlib import Path

backend_path = Path(__file__).parent.parent
sys.path.insert(0, str(backend_path))

from dotenv import load_dotenv
load_dotenv(backend_path / '.env')

from app.core.supabase import supabase_admin

email = 'filippmiller@gmail.com'
password = 'Airbus380+'

print("="*70)
print("TESTING SUPABASE LOGIN")
print("="*70)
print(f"\nEmail: {email}")
print(f"Password: {'*' * len(password)}")

try:
    print("\nAttempting password_sign_in...")
    response = supabase_admin.password_sign_in(email, password)
    print("✅ Login successful!")
    print(f"User ID: {response.get('user', {}).get('id')}")
    print(f"Email: {response.get('user', {}).get('email')}")
    print(f"Has access_token: {bool(response.get('access_token'))}")
    print(f"Has refresh_token: {bool(response.get('refresh_token'))}")
except Exception as e:
    print(f"\n❌ Login failed!")
    print(f"Error type: {type(e).__name__}")
    print(f"Error: {e}")
    if hasattr(e, 'detail'):
        print(f"Detail: {e.detail}")
    import traceback
    traceback.print_exc()

