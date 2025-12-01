#!/usr/bin/env python3
"""
Fix mylifeis0plus1@gmail.com account - set password and confirm email
"""
import sys
import os
import time

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.core.supabase import supabase_admin

email = 'mylifeis0plus1@gmail.com'
password = 'Airbus380+'

print("="*70)
print("FIXING USER ACCOUNT")
print("="*70)
print(f"\nEmail: {email}")
print(f"Password: {'*' * len(password)}")

# Step 1: Get user
print("\n1. Getting user...")
try:
    user = supabase_admin.get_user_by_email(email)
    if not user:
        print("❌ User not found!")
        sys.exit(1)
    
    user_id = user.get('id')
    print(f"✅ User found: {user_id}")
    print(f"   Email confirmed: {user.get('email_confirmed_at') is not None}")
    print(f"   Has password: {user.get('encrypted_password') is not None}")
except Exception as e:
    print(f"❌ Error: {e}")
    sys.exit(1)

# Step 2: Update user - set password and confirm email
print("\n2. Updating user (password + email confirmation)...")
try:
    response = supabase_admin._client.put(
        f'{supabase_admin.base_auth_url}/admin/users/{user_id}',
        headers=supabase_admin.admin_headers,
        json={
            'password': password,
            'email_confirm': True,  # Force email confirmation
        }
    )
    supabase_admin._raise_for_status(response)
    print("✅ User updated successfully")
    print(f"   Response: {response.json()}")
except Exception as e:
    print(f"❌ Error updating user: {e}")
    sys.exit(1)

# Step 3: Wait for propagation
print("\n3. Waiting 3 seconds for changes to propagate...")
time.sleep(3)

# Step 4: Verify user state
print("\n4. Verifying user state...")
try:
    updated_user = supabase_admin.get_user_by_email(email)
    print(f"   Email confirmed: {updated_user.get('email_confirmed_at') is not None}")
    print(f"   Has password: {updated_user.get('encrypted_password') is not None}")
except Exception as e:
    print(f"⚠️  Error verifying: {e}")

# Step 5: Test login
print("\n5. Testing login...")
for attempt in range(3):
    try:
        auth_response = supabase_admin.password_sign_in(email, password)
        print(f"✅ Login successful on attempt {attempt + 1}!")
        print(f"   User ID: {auth_response.get('user', {}).get('id')}")
        print(f"   Has access_token: {bool(auth_response.get('access_token'))}")
        print(f"   Has refresh_token: {bool(auth_response.get('refresh_token'))}")
        print("\n✅ Account is now fixed! You can login.")
        break
    except Exception as e:
        print(f"❌ Login attempt {attempt + 1} failed: {e}")
        if attempt < 2:
            print(f"   Waiting 2 seconds before retry...")
            time.sleep(2)
        else:
            print("\n⚠️  Login still failing. The password might need more time to propagate.")
            print("   Please try logging in manually in a few minutes.")

