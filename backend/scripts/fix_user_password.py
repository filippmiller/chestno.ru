#!/usr/bin/env python3
"""
Fix user password issue - check user status and optionally reset password
"""
import sys
import os

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.core.supabase import supabase_admin
from app.core.db import get_connection
from psycopg.rows import dict_row

def check_and_fix_user(email: str, new_password: str = None):
    print("="*70)
    print(f"CHECKING AND FIXING USER: {email}")
    print("="*70)
    
    # Check Supabase Auth
    print("\n1. Checking Supabase Auth...")
    try:
        user = supabase_admin.get_user_by_email(email)
        if user:
            user_id = user.get('id')
            print(f"✅ User found in Supabase Auth")
            print(f"   ID: {user_id}")
            print(f"   Email: {user.get('email')}")
            print(f"   Email confirmed: {user.get('email_confirmed_at') is not None}")
            print(f"   Created at: {user.get('created_at')}")
            print(f"   Last sign in: {user.get('last_sign_in_at')}")
            print(f"   User metadata: {user.get('user_metadata', {})}")
            print(f"   App metadata: {user.get('app_metadata', {})}")
            
            # Check if user has password
            has_password = user.get('encrypted_password') is not None
            print(f"   Has password: {has_password}")
            
            if not has_password:
                print("\n⚠️  User exists but has NO password set!")
                print("   This user was likely created via OAuth or admin without password.")
                
                if new_password:
                    print(f"\n2. Setting password for user...")
                    try:
                        # Update user password using admin API
                        response = supabase_admin._client.put(
                            f'{supabase_admin.base_auth_url}/admin/users/{user_id}',
                            headers=supabase_admin.admin_headers,
                            json={'password': new_password}
                        )
                        supabase_admin._raise_for_status(response)
                        print("✅ Password set successfully!")
                    except Exception as e:
                        print(f"❌ Failed to set password: {e}")
                else:
                    print("\n💡 To set a password, run:")
                    print(f"   python scripts/fix_user_password.py {email} <new_password>")
            else:
                print("\n✅ User has a password set")
                if new_password:
                    print(f"\n2. Resetting password...")
                    try:
                        response = supabase_admin._client.put(
                            f'{supabase_admin.base_auth_url}/admin/users/{user_id}',
                            headers=supabase_admin.admin_headers,
                            json={'password': new_password}
                        )
                        supabase_admin._raise_for_status(response)
                        print("✅ Password reset successfully!")
                    except Exception as e:
                        print(f"❌ Failed to reset password: {e}")
        else:
            print("❌ User NOT found in Supabase Auth")
            return
    except Exception as e:
        print(f"❌ Error checking Supabase Auth: {e}")
        import traceback
        traceback.print_exc()
        return
    
    if not user_id:
        print("❌ No user ID found")
        return
    
    # Check app_profiles
    print(f"\n3. Checking app_profiles table...")
    try:
        with get_connection() as conn:
            with conn.cursor(row_factory=dict_row) as cur:
                cur.execute(
                    'SELECT id, email, role, display_name, created_at FROM public.app_profiles WHERE id = %s',
                    (user_id,)
                )
                profile = cur.fetchone()
                
                if profile:
                    print(f"✅ Profile found in app_profiles")
                    print(f"   ID: {profile['id']}")
                    print(f"   Email: {profile['email']}")
                    print(f"   Role: {profile['role']}")
                    print(f"   Display name: {profile.get('display_name')}")
                else:
                    print("⚠️  Profile NOT found in app_profiles")
                    print("   Creating app_profiles entry...")
                    try:
                        cur.execute(
                            '''
                            INSERT INTO public.app_profiles (id, email, role, display_name)
                            VALUES (%s, %s, %s, %s)
                            ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email
                            RETURNING id, email, role
                            ''',
                            (user_id, email, 'user', None)
                        )
                        conn.commit()
                        profile = cur.fetchone()
                        print(f"✅ Created app_profiles entry: role={profile['role']}")
                    except Exception as e:
                        print(f"❌ Failed to create app_profiles: {e}")
    except Exception as e:
        print(f"❌ Error checking app_profiles: {e}")
        import traceback
        traceback.print_exc()
    
    # Test password sign-in if password was set
    if new_password:
        print(f"\n4. Testing password sign-in with new password...")
        try:
            auth_response = supabase_admin.password_sign_in(email, new_password)
            print("✅ Password sign-in successful!")
            print(f"   Access token present: {bool(auth_response.get('access_token'))}")
            print(f"   Refresh token present: {bool(auth_response.get('refresh_token'))}")
        except Exception as e:
            print(f"❌ Password sign-in failed: {e}")
            print(f"   Error type: {type(e).__name__}")

if __name__ == '__main__':
    if len(sys.argv) < 2:
        print("Usage: python fix_user_password.py <email> [new_password]")
        sys.exit(1)
    
    email = sys.argv[1]
    new_password = sys.argv[2] if len(sys.argv) > 2 else None
    check_and_fix_user(email, new_password)

