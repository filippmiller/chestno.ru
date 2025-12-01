#!/usr/bin/env python3
"""
Create E2E test admin user for automated testing.

This script creates a dedicated admin account for E2E tests with:
- Unique email based on timestamp
- Strong password
- Admin role in app_profiles

Credentials are printed and can be saved to Railway environment variables.
"""
import os
import sys
import secrets
import string
from pathlib import Path
from datetime import datetime

# Add backend to path
backend_path = Path(__file__).parent.parent
sys.path.insert(0, str(backend_path))

from dotenv import load_dotenv
load_dotenv(backend_path / '.env')

from app.core.db import get_connection
from app.core.supabase import supabase_admin
from psycopg.rows import dict_row


def generate_password(length=16):
    """Generate a strong random password."""
    alphabet = string.ascii_letters + string.digits + "!@#$%^&*"
    password = ''.join(secrets.choice(alphabet) for _ in range(length))
    # Ensure at least one uppercase, one lowercase, one digit, one special char
    if not any(c.isupper() for c in password):
        password = password[0].upper() + password[1:]
    if not any(c.islower() for c in password):
        password = password[0].lower() + password[1:]
    if not any(c.isdigit() for c in password):
        password = password[:-1] + '1'
    if not any(c in "!@#$%^&*" for c in password):
        password = password[:-1] + '!'
    return password


def create_e2e_admin():
    """Create E2E test admin user."""
    timestamp = datetime.now().strftime('%Y%m%d%H%M%S')
    email = f'e2e-admin-{timestamp}@chestno.ru'
    password = generate_password(20)
    display_name = 'E2E Test Admin'
    
    print("="*70)
    print("CREATING E2E TEST ADMIN USER")
    print("="*70)
    print(f"\nEmail: {email}")
    print(f"Password: {password}")
    print(f"Display Name: {display_name}")
    print("\n" + "-"*70)
    
    try:
        # Step 1: Create user in Supabase Auth
        print("\n1. Creating user in Supabase Auth...")
        try:
            # Check if user already exists
            existing_user = supabase_admin.get_user_by_email(email)
            if existing_user:
                user_id = existing_user.get('id')
                print(f"   ⚠️  User already exists: {user_id}")
            else:
                supabase_user = supabase_admin.create_user(
                    email=email,
                    password=password,
                    user_metadata={'full_name': display_name},
                )
                user_id = supabase_user.get('id')
                if not user_id:
                    raise ValueError('Failed to get user ID from Supabase response')
                print(f"   ✅ User created in Supabase: {user_id}")
        except Exception as e:
            # If create failed, try to get existing user
            if 'already registered' in str(e).lower() or 'already exists' in str(e).lower():
                print(f"   ⚠️  User already exists, fetching existing user...")
                existing_user = supabase_admin.get_user_by_email(email)
                if existing_user:
                    user_id = existing_user.get('id')
                    print(f"   ✅ Found existing user: {user_id}")
                else:
                    raise ValueError(f'User exists but could not be found: {e}')
            else:
                raise
        
        # Step 2: Create/update app_profiles entry
        print("\n2. Creating/updating app_profiles entry...")
        with get_connection() as conn:
            with conn.cursor(row_factory=dict_row) as cur:
                # Check if profile exists (id is the primary key, same as auth.users.id)
                cur.execute(
                    'SELECT id, role FROM app_profiles WHERE id = %s',
                    (user_id,)
                )
                profile = cur.fetchone()
                
                if profile:
                    print(f"   ⚠️  Profile already exists (role: {profile['role']})")
                    # Update to admin
                    cur.execute(
                        'UPDATE app_profiles SET role = %s, updated_at = now() WHERE id = %s RETURNING id, role',
                        ('admin', user_id)
                    )
                    updated = cur.fetchone()
                    print(f"   ✅ Profile updated to admin role")
                else:
                    # Create new profile
                    cur.execute(
                        '''
                        INSERT INTO app_profiles (id, email, display_name, role)
                        VALUES (%s, %s, %s, 'admin')
                        RETURNING id, role
                        ''',
                        (user_id, email, display_name)
                    )
                    new_profile = cur.fetchone()
                    print(f"   ✅ Profile created with admin role")
                
                conn.commit()
        
        # Step 3: Verify admin role
        print("\n3. Verifying admin role...")
        with get_connection() as conn:
            with conn.cursor(row_factory=dict_row) as cur:
                cur.execute(
                    'SELECT role FROM app_profiles WHERE id = %s',
                    (user_id,)
                )
                profile = cur.fetchone()
                if profile and profile['role'] == 'admin':
                    print(f"   ✅ Admin role verified: {profile['role']}")
                else:
                    raise ValueError(f'Admin role not set correctly: {profile}')
        
        # Step 4: Print credentials for Railway
        print("\n" + "="*70)
        print("✅ E2E ADMIN USER CREATED SUCCESSFULLY")
        print("="*70)
        print("\n📋 CREDENTIALS (save these to Railway environment variables):")
        print("\n" + "-"*70)
        print(f"E2E_ADMIN_EMAIL={email}")
        print(f"E2E_ADMIN_PASSWORD={password}")
        print("-"*70)
        
        print("\n📝 Railway CLI commands to set environment variables:")
        print("\n" + "-"*70)
        print(f'railway variables set E2E_ADMIN_EMAIL="{email}"')
        print(f'railway variables set E2E_ADMIN_PASSWORD="{password}"')
        print("-"*70)
        
        print("\n📝 Or set in Railway Dashboard:")
        print("   1. Go to your Railway project")
        print("   2. Navigate to Variables tab")
        print("   3. Add:")
        print(f"      E2E_ADMIN_EMAIL = {email}")
        print(f"      E2E_ADMIN_PASSWORD = {password}")
        
        print("\n" + "="*70)
        print("⚠️  IMPORTANT: Save these credentials securely!")
        print("   They are needed to run E2E tests against production.")
        print("="*70)
        
        return {
            'email': email,
            'password': password,
            'user_id': user_id,
        }
        
    except Exception as e:
        print(f"\n❌ Error creating E2E admin user: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == '__main__':
    create_e2e_admin()

