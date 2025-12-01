#!/usr/bin/env python3
"""
Check user status in Supabase Auth and app_profiles
"""
import sys
import os

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.core.supabase import supabase_admin
from app.core.db import get_connection
from psycopg.rows import dict_row

def check_user(email: str):
    print("="*70)
    print(f"CHECKING USER STATUS: {email}")
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
        else:
            print("❌ User NOT found in Supabase Auth")
            return
    except Exception as e:
        print(f"❌ Error checking Supabase Auth: {e}")
        return
    
    if not user_id:
        print("❌ No user ID found")
        return
    
    # Check app_profiles
    print(f"\n2. Checking app_profiles table...")
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
                    print(f"   Created at: {profile.get('created_at')}")
                else:
                    print("❌ Profile NOT found in app_profiles")
                    print("   This user exists in Supabase Auth but has no app_profiles entry!")
    except Exception as e:
        print(f"❌ Error checking app_profiles: {e}")
    
    # Check organizations
    print(f"\n3. Checking organizations...")
    try:
        with get_connection() as conn:
            with conn.cursor(row_factory=dict_row) as cur:
                cur.execute(
                    '''
                    SELECT o.id, o.name, o.slug, o.verification_status, o.public_visible
                    FROM organizations o
                    JOIN organization_memberships om ON o.id = om.organization_id
                    WHERE om.user_id = %s
                    ''',
                    (user_id,)
                )
                orgs = cur.fetchall()
                
                if orgs:
                    print(f"✅ Found {len(orgs)} organization(s):")
                    for org in orgs:
                        print(f"   - {org['name']} (ID: {org['id']}, Status: {org['verification_status']}, Public: {org['public_visible']})")
                else:
                    print("ℹ️  No organizations found for this user")
    except Exception as e:
        print(f"❌ Error checking organizations: {e}")
    
    # Try password sign-in
    print(f"\n4. Testing password sign-in...")
    password = input("Enter password to test (or press Enter to skip): ").strip()
    if password:
        try:
            auth_response = supabase_admin.password_sign_in(email, password)
            print("✅ Password sign-in successful!")
            print(f"   Access token present: {bool(auth_response.get('access_token'))}")
            print(f"   Refresh token present: {bool(auth_response.get('refresh_token'))}")
        except Exception as e:
            print(f"❌ Password sign-in failed: {e}")
            print(f"   Error type: {type(e).__name__}")
    else:
        print("⏭️  Skipped password test")

if __name__ == '__main__':
    if len(sys.argv) < 2:
        print("Usage: python check_user_status.py <email>")
        sys.exit(1)
    
    email = sys.argv[1]
    check_user(email)

