"""
Create auth_events table if it doesn't exist
"""
import os
import sys
from pathlib import Path
import psycopg

def get_db_connection():
    database_url = os.getenv('DATABASE_URL')
    if not database_url:
        raise ValueError("DATABASE_URL not set")
    return psycopg.connect(database_url)

def create_auth_events_table():
    """Create auth_events table if it doesn't exist"""
    print("="*70)
    print("CREATING auth_events TABLE")
    print("="*70)
    
    conn = get_db_connection()
    print("✅ Connected to Supabase")
    
    try:
        # Check if table exists
        with conn.cursor() as cur:
            cur.execute("""
                SELECT EXISTS (
                    SELECT FROM information_schema.tables 
                    WHERE table_schema = 'public' 
                    AND table_name = 'auth_events'
                );
            """)
            exists = cur.fetchone()[0]
            
            if exists:
                print("✅ auth_events table already exists")
                return True
            
            # Create table
            print("\n--- Creating auth_events table ---")
            cur.execute("""
                CREATE TABLE public.auth_events (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    user_id UUID REFERENCES public.app_profiles(id) ON DELETE SET NULL,
                    event_type TEXT NOT NULL,
                    email TEXT,
                    ip TEXT,
                    user_agent TEXT,
                    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
                );
            """)
            
            cur.execute("""
                CREATE INDEX idx_auth_events_email ON public.auth_events(email);
            """)
            
            cur.execute("""
                CREATE INDEX idx_auth_events_ip ON public.auth_events(ip);
            """)
            
            cur.execute("""
                CREATE INDEX idx_auth_events_created_at ON public.auth_events(created_at);
            """)
            
            conn.commit()
            print("✅ auth_events table created")
            return True
            
    except Exception as e:
        print(f"❌ ERROR: {e}")
        import traceback
        traceback.print_exc()
        conn.rollback()
        return False
    finally:
        conn.close()

if __name__ == '__main__':
    from dotenv import load_dotenv
    env_path = Path(__file__).parent.parent / '.env'
    if env_path.exists():
        load_dotenv(env_path)
    
    os.environ['DATABASE_URL'] = 'postgresql://postgres:Champ20242024+@db.ygsbcrqajkjcvrzixvam.supabase.co:5432/postgres'
    
    success = create_auth_events_table()
    sys.exit(0 if success else 1)

