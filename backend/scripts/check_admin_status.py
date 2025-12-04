import sys
import os
from pathlib import Path
from psycopg.rows import dict_row

# Add backend directory to path
backend_dir = Path(__file__).parent.parent
sys.path.append(str(backend_dir))

from app.core.config import get_settings
from app.core.supabase import supabase_admin
from app.core.db import get_connection

ALLOWED_ADMIN_ROLES = ('platform_owner', 'platform_admin')

def check_admin_status():
    print("Checking admin status for filippmiller@gmail.com...")
    
    try:
        # 1. Get User ID from Supabase
        email = "filippmiller@gmail.com"
        # We don't need password if we just want to look up by email in DB, 
        # but Supabase Admin might be needed to get the ID if not in our DB yet.
        # However, let's assume the user exists in our DB tables if they are claiming to be admin.
        
        # Let's try to find the user in app_profiles or auth.users (if we had access, but we use Supabase)
        # We can use the debug_login approach to get the ID via login, or just query our tables by email if possible?
        # app_profiles usually has 'id' which is the UUID. It might not have email.
        # Let's use the login method from debug_login.py to be sure we get the correct ID.
        
        password = "Airbus380+" # Using the password from debug_login.py
        print(f"Attempting login to get User ID...")
        response = supabase_admin.password_sign_in(email, password)
        user_id = response['user']['id']
        print(f"User ID: {user_id}")
        
        with get_connection() as conn:
            with conn.cursor(row_factory=dict_row) as cur:
                # 2. Check app_profiles
                print("\nChecking app_profiles...")
                cur.execute("SELECT * FROM app_profiles WHERE id = %s", (user_id,))
                profile = cur.fetchone()
                if profile:
                    print(f"Found in app_profiles: {profile}")
                    if profile.get('role') == 'admin':
                        print("✅ User IS admin in app_profiles")
                    else:
                        print(f"❌ User is NOT admin in app_profiles (role: {profile.get('role')})")
                else:
                    print("❌ User NOT found in app_profiles")

                # 3. Check platform_roles
                print("\nChecking platform_roles...")
                cur.execute("SELECT * FROM platform_roles WHERE user_id = %s", (user_id,))
                roles = cur.fetchall()
                if roles:
                    print(f"Found in platform_roles: {roles}")
                    is_platform_admin = False
                    for role in roles:
                        if role.get('role') in ALLOWED_ADMIN_ROLES:
                            is_platform_admin = True
                            print(f"✅ User has admin role: {role.get('role')}")
                    
                    if not is_platform_admin:
                        print("❌ User does NOT have any platform admin roles")
                else:
                    print("❌ User NOT found in platform_roles")

    except Exception as e:
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    check_admin_status()
