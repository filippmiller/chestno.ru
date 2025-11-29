"""
Fix sessions table structure - remove duplicates and Supabase auth columns
"""
import os
import sys
from pathlib import Path
import psycopg
from psycopg.rows import dict_row

def get_db_connection():
    database_url = os.getenv('DATABASE_URL')
    if not database_url:
        raise ValueError("DATABASE_URL not set")
    return psycopg.connect(database_url)

def fix_sessions_table():
    """Fix sessions table structure"""
    print("="*70)
    print("FIXING SESSIONS TABLE STRUCTURE")
    print("="*70)
    
    conn = get_db_connection()
    print("✅ Connected to Supabase")
    
    try:
        # Check current structure
        with conn.cursor(row_factory=dict_row) as cur:
            cur.execute("""
                SELECT column_name, data_type 
                FROM information_schema.columns 
                WHERE table_name = 'sessions'
                AND table_schema = 'public'
                ORDER BY ordinal_position;
            """)
            columns = cur.fetchall()
            print(f"\nCurrent columns ({len(columns)}):")
            for col in columns:
                print(f"  - {col['column_name']} ({col['data_type']})")
        
        # Check if table has data
        with conn.cursor() as cur:
            cur.execute("SELECT COUNT(*) FROM public.sessions;")
            count = cur.fetchone()[0]
            print(f"\nCurrent records: {count}")
            
            if count > 0:
                print("⚠️  Table has data - backing up...")
                # Backup data if exists
                cur.execute("""
                    CREATE TABLE IF NOT EXISTS public.sessions_backup AS 
                    SELECT * FROM public.sessions;
                """)
                conn.commit()
                print("✅ Backup created: sessions_backup")
        
        # Drop and recreate table with correct structure
        print("\n--- Recreating sessions table ---")
        with conn.cursor() as cur:
            # Drop table
            cur.execute("DROP TABLE IF EXISTS public.sessions CASCADE;")
            conn.commit()
            print("✅ Old table dropped")
            
            # Create correct table
            cur.execute("""
                CREATE TABLE public.sessions (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    user_id UUID NOT NULL REFERENCES public.app_profiles(id) ON DELETE CASCADE,
                    refresh_token_hash TEXT NOT NULL,
                    expires_at TIMESTAMPTZ NOT NULL,
                    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                    last_used_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
                );
            """)
            conn.commit()
            print("✅ New table created")
            
            # Create indexes
            cur.execute("""
                CREATE INDEX idx_sessions_user_id ON public.sessions(user_id);
            """)
            cur.execute("""
                CREATE INDEX idx_sessions_expires_at ON public.sessions(expires_at);
            """)
            conn.commit()
            print("✅ Indexes created")
            
            # Enable RLS
            cur.execute("ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;")
            conn.commit()
            print("✅ RLS enabled")
            
            # Create RLS policy
            cur.execute("DROP POLICY IF EXISTS \"Users can read own sessions\" ON public.sessions;")
            cur.execute("""
                CREATE POLICY "Users can read own sessions"
                ON public.sessions
                FOR SELECT
                USING (auth.uid() = user_id);
            """)
            conn.commit()
            print("✅ RLS policy created")
        
        # Verify
        print("\n--- Verification ---")
        with conn.cursor(row_factory=dict_row) as cur:
            cur.execute("""
                SELECT column_name, data_type 
                FROM information_schema.columns 
                WHERE table_name = 'sessions'
                AND table_schema = 'public'
                ORDER BY ordinal_position;
            """)
            columns = cur.fetchall()
            print(f"New columns ({len(columns)}):")
            for col in columns:
                print(f"  ✅ {col['column_name']} ({col['data_type']})")
            
            expected_columns = ['id', 'user_id', 'refresh_token_hash', 'expires_at', 'created_at', 'last_used_at']
            actual_columns = [c['column_name'] for c in columns]
            
            if set(expected_columns) == set(actual_columns):
                print("\n✅ Table structure is correct!")
                return True
            else:
                print(f"\n❌ Column mismatch!")
                print(f"  Expected: {expected_columns}")
                print(f"  Actual: {actual_columns}")
                return False
        
    except Exception as e:
        print(f"\n❌ ERROR: {e}")
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
    
    success = fix_sessions_table()
    sys.exit(0 if success else 1)

