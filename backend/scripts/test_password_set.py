#!/usr/bin/env python3
"""
Test password setting and login for mylifeis0plus1@gmail.com
"""
import sys
import os
import time

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.core.supabase import supabase_admin

email = 'mylifeis0plus1@gmail.com'
password = 'Airbus380+'

print("="*70)
print("TESTING PASSWORD SET AND LOGIN")
print("="*70)
print(f"\nEmail: {email}")
print(f"Password: {'*' * len(password)}")

# Step 1: Check user
print("\n1. Checking user...")
try:
    user = supabase_admin.get_user_by_email(email)
    if user:
        user_id = user.get('id')
        print(f"✅ User found: {user_id}")
        print(f"   Has password: {user.get('encrypted_password') is not None}")
    else:
        print("❌ User not found")
        sys.exit(1)
except Exception as e:
    print(f"❌ Error: {e}")
    sys.exit(1)

# Step 2: Set password
print("\n2. Setting password...")
try:
    response = supabase_admin._client.put(
        f'{supabase_admin.base_auth_url}/admin/users/{user_id}',
        headers=supabase_admin.admin_headers,
        json={'password': password}
    )
    supabase_admin._raise_for_status(response)
    print("✅ Password set successfully")
    print(f"   Response: {response.json()}")
except Exception as e:
    print(f"❌ Error setting password: {e}")
    sys.exit(1)

# Step 3: Wait a bit
print("\n3. Waiting 2 seconds for password to propagate...")
time.sleep(2)

# Step 4: Try login
print("\n4. Testing login...")
for attempt in range(3):
    try:
        auth_response = supabase_admin.password_sign_in(email, password)
        print(f"✅ Login successful on attempt {attempt + 1}!")
        print(f"   User ID: {auth_response.get('user', {}).get('id')}")
        print(f"   Has access_token: {bool(auth_response.get('access_token'))}")
        print(f"   Has refresh_token: {bool(auth_response.get('refresh_token'))}")
        break
    except Exception as e:
        print(f"❌ Login attempt {attempt + 1} failed: {e}")
        if attempt < 2:
            print(f"   Waiting 1 second before retry...")
            time.sleep(1)
        else:
            print("\n❌ All login attempts failed!")
            print("\nTrying to get user info again...")
            try:
                updated_user = supabase_admin.get_user_by_email(email)
                print(f"   Has password now: {updated_user.get('encrypted_password') is not None}")
                print(f"   User data: {updated_user}")
            except Exception as e2:
                print(f"   Error getting user: {e2}")

