#!/usr/bin/env python3
"""
Create admin user in app_profiles table for Auth V2.

This script:
1. Checks if user exists in Supabase auth.users
2. Creates/updates app_profiles entry with admin role
"""
import os
import sys
from pathlib import Path

# Add backend to path
backend_path = Path(__file__).parent.parent
sys.path.insert(0, str(backend_path))

from dotenv import load_dotenv
load_dotenv(backend_path / '.env')

from app.core.db import get_connection
from app.core.supabase import supabase_admin
from psycopg.rows import dict_row


def create_admin_user(email: str, password: str, display_name: str = None):
    """
    Create admin user in app_profiles table.
    
    Args:
        email: User email
        password: User password
        display_name: Optional display name
    """
    print("="*70)
    print("CREATING ADMIN USER IN APP_PROFILES (Auth V2)")
    print("="*70)
    
    # Step 1: Check if user exists in Supabase auth
    print(f"\n1. Checking Supabase auth for user: {email}")
    try:
        # Try to sign in to verify user exists
        auth_response = supabase_admin.password_sign_in(email, password)
        user = auth_response.get('user')
        
        if not user:
            print(f"❌ User {email} not found in Supabase auth")
            print("\nCreating user in Supabase auth first...")
            # Create user in Supabase
            create_response = supabase_admin.create_user({
                'email': email,
                'password': password,
                'email_confirm': True,  # Auto-confirm email
            })
            user = create_response.get('user')
            if not user:
                print("❌ Failed to create user in Supabase")
                return False
            print(f"✅ Created user in Supabase auth: {user.get('id')}")
        else:
            print(f"✅ User found in Supabase auth: {user.get('id')}")
        
        user_id = user.get('id')
        if not user_id:
            print("❌ No user ID found")
            return False
        
    except Exception as e:
        print(f"❌ Error checking/creating Supabase user: {e}")
        # Try to create user anyway
        try:
            create_response = supabase_admin.create_user({
                'email': email,
                'password': password,
                'email_confirm': True,
            })
            user = create_response.get('user')
            if user:
                user_id = user.get('id')
                print(f"✅ Created user in Supabase auth: {user_id}")
            else:
                print("❌ Failed to create user")
                return False
        except Exception as e2:
            print(f"❌ Failed to create user: {e2}")
            return False
    
    # Step 2: Check/create app_profiles entry
    print(f"\n2. Checking app_profiles table for user_id: {user_id}")
    
    with get_connection() as conn:
        with conn.cursor(row_factory=dict_row) as cur:
            # Check if profile exists
            cur.execute(
                'SELECT id, email, role, display_name FROM public.app_profiles WHERE id = %s',
                (user_id,)
            )
            profile = cur.fetchone()
            
            if profile:
                print(f"✅ Profile exists: role={profile['role']}, email={profile['email']}")
                
                # Update to admin role if not already
                if profile['role'] != 'admin':
                    print(f"   Updating role from '{profile['role']}' to 'admin'...")
                    cur.execute(
                        'UPDATE public.app_profiles SET role = %s, updated_at = now() WHERE id = %s',
                        ('admin', user_id)
                    )
                    conn.commit()
                    print("✅ Role updated to 'admin'")
                else:
                    print("✅ User already has admin role")
                
                # Update email if changed
                if profile['email'] != email:
                    print(f"   Updating email from '{profile['email']}' to '{email}'...")
                    cur.execute(
                        'UPDATE public.app_profiles SET email = %s, updated_at = now() WHERE id = %s',
                        (email, user_id)
                    )
                    conn.commit()
                    print("✅ Email updated")
                
                # Update display_name if provided
                if display_name and profile.get('display_name') != display_name:
                    print(f"   Updating display_name to '{display_name}'...")
                    cur.execute(
                        'UPDATE public.app_profiles SET display_name = %s, updated_at = now() WHERE id = %s',
                        (display_name, user_id)
                    )
                    conn.commit()
                    print("✅ Display name updated")
                
            else:
                print("   Profile not found, creating new profile with admin role...")
                cur.execute(
                    '''
                    INSERT INTO public.app_profiles (id, email, role, display_name)
                    VALUES (%s, %s, 'admin', %s)
                    RETURNING id, email, role, display_name
                    ''',
                    (user_id, email, display_name)
                )
                conn.commit()
                new_profile = cur.fetchone()
                print(f"✅ Created admin profile:")
                print(f"   ID: {new_profile['id']}")
                print(f"   Email: {new_profile['email']}")
                print(f"   Role: {new_profile['role']}")
                print(f"   Display Name: {new_profile.get('display_name', 'N/A')}")
    
    print("\n" + "="*70)
    print("✅ ADMIN USER CREATED/UPDATED SUCCESSFULLY")
    print("="*70)
    print(f"\nYou can now login with:")
    print(f"  Email: {email}")
    print(f"  Password: {password}")
    print(f"\nUser ID: {user_id}")
    print(f"Role: admin")
    
    return True


if __name__ == '__main__':
    email = 'filippmiller@gmail.com'
    password = 'Airbus380+'
    display_name = 'Filipp Miller'
    
    success = create_admin_user(email, password, display_name)
    sys.exit(0 if success else 1)

