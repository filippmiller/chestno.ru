"""
Apply Auth V2 migration directly to Supabase
Creates app_profiles and sessions tables
"""
import os
import sys
from pathlib import Path
import psycopg
from psycopg.rows import dict_row

def get_db_connection():
    """Get database connection"""
    database_url = os.getenv('DATABASE_URL')
    if not database_url:
        raise ValueError("DATABASE_URL not set")
    return psycopg.connect(database_url)

def check_table_exists(conn, table_name):
    """Check if table exists"""
    with conn.cursor() as cur:
        cur.execute("""
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND table_name = %s
            );
        """, (table_name,))
        return cur.fetchone()[0]

def apply_migration():
    """Apply Auth V2 migration"""
    print("="*70)
    print("APPLYING AUTH V2 MIGRATION TO SUPABASE")
    print("="*70)
    
    conn = get_db_connection()
    print("✅ Connected to Supabase")
    
    try:
        # Check existing tables
        app_profiles_exists = check_table_exists(conn, 'app_profiles')
        sessions_exists = check_table_exists(conn, 'sessions')
        
        print(f"\nCurrent state:")
        print(f"  app_profiles: {'EXISTS' if app_profiles_exists else 'NOT FOUND'}")
        print(f"  sessions: {'EXISTS' if sessions_exists else 'NOT FOUND'}")
        
        if app_profiles_exists and sessions_exists:
            print("\n✅ All tables already exist!")
            return True
        
        # Create app_profiles table
        if not app_profiles_exists:
            print("\n--- Creating app_profiles table ---")
            with conn.cursor() as cur:
                cur.execute("""
                    CREATE TABLE IF NOT EXISTS public.app_profiles (
                        id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
                        email TEXT NOT NULL,
                        role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('admin', 'business_owner', 'user')),
                        display_name TEXT,
                        avatar_url TEXT,
                        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
                    );
                """)
                cur.execute("""
                    CREATE INDEX IF NOT EXISTS idx_app_profiles_email ON public.app_profiles(email);
                """)
                conn.commit()
                print("✅ app_profiles table created")
        
        # Create sessions table
        if not sessions_exists:
            print("\n--- Creating sessions table ---")
            with conn.cursor() as cur:
                cur.execute("""
                    CREATE TABLE IF NOT EXISTS public.sessions (
                        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                        user_id UUID NOT NULL REFERENCES public.app_profiles(id) ON DELETE CASCADE,
                        refresh_token_hash TEXT NOT NULL,
                        expires_at TIMESTAMPTZ NOT NULL,
                        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                        last_used_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
                    );
                """)
                cur.execute("""
                    CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON public.sessions(user_id);
                """)
                cur.execute("""
                    CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON public.sessions(expires_at);
                """)
                conn.commit()
                print("✅ sessions table created")
        
        # Enable RLS
        print("\n--- Enabling RLS ---")
        with conn.cursor() as cur:
            cur.execute("ALTER TABLE public.app_profiles ENABLE ROW LEVEL SECURITY;")
            cur.execute("ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;")
            conn.commit()
            print("✅ RLS enabled")
        
        # Create RLS policies for app_profiles
        print("\n--- Creating RLS policies for app_profiles ---")
        with conn.cursor() as cur:
            # Drop policies if they exist
            cur.execute("DROP POLICY IF EXISTS \"Users can read own profile\" ON public.app_profiles;")
            cur.execute("DROP POLICY IF EXISTS \"Users can update own profile\" ON public.app_profiles;")
            
            # Policy: Users can read their own profile
            cur.execute("""
                CREATE POLICY "Users can read own profile"
                ON public.app_profiles
                FOR SELECT
                USING (auth.uid() = id);
            """)
            
            # Policy: Users can update their own profile
            cur.execute("""
                CREATE POLICY "Users can update own profile"
                ON public.app_profiles
                FOR UPDATE
                USING (auth.uid() = id);
            """)
            
            conn.commit()
            print("✅ RLS policies created for app_profiles")
        
        # Create RLS policies for sessions
        print("\n--- Creating RLS policies for sessions ---")
        with conn.cursor() as cur:
            # Drop policy if it exists
            cur.execute("DROP POLICY IF EXISTS \"Users can read own sessions\" ON public.sessions;")
            
            # Policy: Users can read their own sessions
            cur.execute("""
                CREATE POLICY "Users can read own sessions"
                ON public.sessions
                FOR SELECT
                USING (auth.uid() = user_id);
            """)
            
            conn.commit()
            print("✅ RLS policies created for sessions")
        
        # Verify
        print("\n--- Verification ---")
        app_profiles_exists = check_table_exists(conn, 'app_profiles')
        sessions_exists = check_table_exists(conn, 'sessions')
        
        print(f"  app_profiles: {'✅ EXISTS' if app_profiles_exists else '❌ NOT FOUND'}")
        print(f"  sessions: {'✅ EXISTS' if sessions_exists else '❌ NOT FOUND'}")
        
        if app_profiles_exists and sessions_exists:
            # Check columns
            with conn.cursor(row_factory=dict_row) as cur:
                cur.execute("""
                    SELECT column_name, data_type 
                    FROM information_schema.columns 
                    WHERE table_name = 'app_profiles'
                    ORDER BY ordinal_position;
                """)
                columns = cur.fetchall()
                print(f"\n  app_profiles columns: {[c['column_name'] for c in columns]}")
                
                cur.execute("""
                    SELECT column_name, data_type 
                    FROM information_schema.columns 
                    WHERE table_name = 'sessions'
                    ORDER BY ordinal_position;
                """)
                columns = cur.fetchall()
                print(f"  sessions columns: {[c['column_name'] for c in columns]}")
            
            print("\n" + "="*70)
            print("✅ MIGRATION COMPLETE - All tables created successfully!")
            print("="*70)
            return True
        else:
            print("\n❌ Tables not created properly")
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
    # Load environment
    from dotenv import load_dotenv
    env_path = Path(__file__).parent.parent / '.env'
    if env_path.exists():
        load_dotenv(env_path)
    
    # Override with provided values if needed
    if not os.getenv('DATABASE_URL'):
        os.environ['DATABASE_URL'] = 'postgresql://postgres:Champ20242024+@db.ygsbcrqajkjcvrzixvam.supabase.co:5432/postgres'
    
    success = apply_migration()
    sys.exit(0 if success else 1)

