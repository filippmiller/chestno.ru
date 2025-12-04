import sys
import os
from pathlib import Path
from psycopg.rows import dict_row

# Add backend directory to path
backend_dir = Path(__file__).parent.parent
sys.path.append(str(backend_dir))

from app.core.db import get_connection

def promote_admin():
    user_id = "cdb4a5aa-3efe-4dab-b34f-d02fb1be5bf9"
    print(f"Promoting user {user_id} to admin...")
    
    try:
        with get_connection() as conn:
            with conn.cursor(row_factory=dict_row) as cur:
                # Update app_profiles
                print("Updating app_profiles...")
                cur.execute(
                    "UPDATE app_profiles SET role = 'admin' WHERE id = %s RETURNING *",
                    (user_id,)
                )
                updated_profile = cur.fetchone()
                if updated_profile:
                    print(f"✅ User promoted in app_profiles: {updated_profile}")
                else:
                    print("❌ User NOT found in app_profiles")
            
            conn.commit()
            print("Changes committed.")

    except Exception as e:
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    promote_admin()
