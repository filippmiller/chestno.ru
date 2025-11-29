import sys
import os
from pathlib import Path

# Add backend directory to path
backend_dir = Path(__file__).parent.parent
sys.path.append(str(backend_dir))

from app.core.config import get_settings
from app.core.supabase import supabase_admin
from app.core.db import get_connection
from app.services.accounts import get_session_data

def test_supabase():
    print("Testing Supabase connection...")
    settings = get_settings()
    print(f"Supabase URL: {settings.supabase_url}")
    print(f"Supabase Auth URL: {settings.supabase_auth_url}")
    
    try:
        # Try to sign in with the provided credentials
        email = "filippmiller@gmail.com"
        password = "Airbus380+"
        print(f"Attempting login for {email}...")
        
        response = supabase_admin.password_sign_in(email, password)
        print("Supabase login successful!")
        print(f"User ID: {response['user']['id']}")
        return response['user']['id']
    except Exception as e:
        print(f"Supabase login failed: {e}")
        import traceback
        traceback.print_exc()
        return None

def test_tables():
    print("\nTesting tables existence...")
    try:
        with get_connection() as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT to_regclass('public.login_throttle')")
                if cur.fetchone()[0]:
                    print("Table 'login_throttle' exists.")
                else:
                    print("Table 'login_throttle' DOES NOT exist!")
                
                cur.execute("SELECT to_regclass('public.app_users')")
                if cur.fetchone()[0]:
                    print("Table 'app_users' exists.")
                else:
                    print("Table 'app_users' DOES NOT exist!")
    except Exception as e:
        print(f"Table check failed: {e}")

def test_session(user_id):
    if not user_id:
        print("Skipping session test because user_id is missing")
        return

    print("\nTesting get_session_data...")
    try:
        session = get_session_data(user_id)
        print("Session data retrieved successfully!")
        # print(f"User: {session.user}")
        print(f"Organizations: {len(session.organizations)}")
        print(f"Memberships: {session.memberships}")
        for m in session.memberships:
            print(f"Role: {m.role}")
    except Exception as e:
        print(f"get_session_data failed: {e}")
        import traceback
        traceback.print_exc()

from app.services import login_throttle

def test_throttle(email):
    print("\nTesting login_throttle.reset...")
    try:
        login_throttle.reset(email)
        print("Throttle reset successful!")
    except Exception as e:
        print(f"Throttle reset failed: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    test_tables()
    user_id = test_supabase()
    test_throttle("filippmiller@gmail.com")
    test_session(user_id)
