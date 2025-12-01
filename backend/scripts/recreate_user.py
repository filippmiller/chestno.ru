#!/usr/bin/env python3
"""
Delete and recreate user with password
"""
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.core.supabase import supabase_admin
from app.core.db import get_connection

old_email = 'mylifeis0plus1@gmail.com'
new_email = 'filippmiller@gmail.com'  # The actual email in Supabase
password = 'Airbus380+'

print("="*70)
print("RECREATING USER WITH PASSWORD")
print("="*70)
print(f"\nLooking for email: {old_email}")
print(f"Actual email in Supabase: {new_email}")
print(f"Password: {'*' * len(password)}")

# Step 1: Get existing user ID
print("\n1. Getting existing user...")
try:
    user = supabase_admin.get_user_by_email(old_email)
    if user:
        user_id = user.get('id')
        actual_email = user.get('email')
        print(f"✅ User found: {user_id}")
        print(f"   Email in record: {actual_email}")
        print(f"   Email confirmed: {user.get('email_confirmed_at') is not None}")
        print(f"   Has password: {user.get('encrypted_password') is not None}")
    else:
        print("❌ User not found!")
        sys.exit(1)
except Exception as e:
    print(f"❌ Error: {e}")
    sys.exit(1)

# Step 2: Delete user from Supabase Auth
print("\n2. Deleting user from Supabase Auth...")
try:
    response = supabase_admin._client.delete(
        f'{supabase_admin.base_auth_url}/admin/users/{user_id}',
        headers=supabase_admin.admin_headers,
    )
    if response.status_code in [200, 204]:
        print(f"✅ User deleted from Supabase Auth")
    else:
        print(f"⚠️  Delete returned {response.status_code}: {response.text}")
except Exception as e:
    print(f"❌ Error deleting user: {e}")
    print("   Continuing anyway...")

# Step 3: Delete from app_profiles
print("\n3. Cleaning up app_profiles...")
try:
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute('DELETE FROM public.app_profiles WHERE id = %s', (user_id,))
            conn.commit()
            print(f"✅ Deleted from app_profiles")
except Exception as e:
    print(f"⚠️  Error deleting from app_profiles: {e}")

# Step 4: Wait a bit
print("\n4. Waiting 2 seconds...")
import time
time.sleep(2)

# Step 5: Create new user with password
print(f"\n5. Creating new user: {new_email}")
try:
    new_user = supabase_admin.create_user(
        email=new_email,
        password=password,
        user_metadata={'full_name': 'Filipp Miller'},
        email_confirm=True,  # Auto-confirm for this fix
    )
    new_user_id = new_user.get('id')
    print(f"✅ New user created: {new_user_id}")
    print(f"   Email: {new_user.get('email')}")
    print(f"   Email confirmed: {new_user.get('email_confirmed_at') is not None}")
except Exception as e:
    print(f"❌ Error creating user: {e}")
    sys.exit(1)

# Step 6: Create app_profiles entry
print(f"\n6. Creating app_profiles...")
try:
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                '''
                INSERT INTO public.app_profiles (id, email, role, display_name)
                VALUES (%s, %s, %s, %s)
                ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email
                ''',
                (new_user_id, new_email, 'user', 'Filipp Miller')
            )
            conn.commit()
            print(f"✅ app_profiles entry created")
except Exception as e:
    print(f"❌ Error creating app_profiles: {e}")

# Step 7: Test login
print(f"\n7. Testing login with {new_email}...")
time.sleep(1)
try:
    auth_response = supabase_admin.password_sign_in(new_email, password)
    print("✅ Login successful!")
    print(f"   User ID: {auth_response.get('user', {}).get('id')}")
    print(f"   Has access_token: {bool(auth_response.get('access_token'))}")
    print(f"   Has refresh_token: {bool(auth_response.get('refresh_token'))}")
    print(f"\n✅ Account fixed! Please login with: {new_email}")
except Exception as e:
    print(f"❌ Login failed: {e}")
    print("\n⚠️  Please try logging in manually in a few minutes.")

