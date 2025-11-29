"""
Verify Supabase connection and apply Auth V2 migrations
"""
import os
import sys
from pathlib import Path
import psycopg
from psycopg.rows import dict_row

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

def get_db_connection():
    """Get database connection from DATABASE_URL"""
    database_url = os.getenv('DATABASE_URL')
    if not database_url:
        raise ValueError("DATABASE_URL not set in environment")
    
    print(f"Connecting to database...")
    print(f"URL: {database_url.split('@')[1] if '@' in database_url else 'hidden'}")
    
    conn = psycopg.connect(database_url)
    return conn

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
    print("\n" + "="*60)
    print("VERIFYING SUPABASE CONNECTION AND APPLYING MIGRATIONS")
    print("="*60)
    
    try:
        # Connect to database
        conn = get_db_connection()
        print("✅ Connected to Supabase database")
        
        # Check existing tables
        print("\n--- Checking existing tables ---")
        app_profiles_exists = check_table_exists(conn, 'app_profiles')
        sessions_exists = check_table_exists(conn, 'sessions')
        
        print(f"app_profiles table: {'✅ EXISTS' if app_profiles_exists else '❌ NOT FOUND'}")
        print(f"sessions table: {'✅ EXISTS' if sessions_exists else '❌ NOT FOUND'}")
        
        # Read migration file
        migration_file = Path(__file__).parent.parent.parent / 'supabase' / 'migrations' / '0020_auth_rebuild.sql'
        if not migration_file.exists():
            print(f"\n❌ Migration file not found: {migration_file}")
            return False
        
        print(f"\n--- Reading migration file: {migration_file.name} ---")
        migration_sql = migration_file.read_text(encoding='utf-8')
        
        # Apply migration
        if not app_profiles_exists or not sessions_exists:
            print("\n--- Applying migration ---")
            with conn.cursor() as cur:
                # Split migration into individual statements
                statements = [s.strip() for s in migration_sql.split(';') if s.strip() and not s.strip().startswith('--')]
                
                for i, statement in enumerate(statements, 1):
                    if statement:
                        try:
                            print(f"  Executing statement {i}/{len(statements)}...")
                            cur.execute(statement)
                            conn.commit()
                        except Exception as e:
                            # Check if error is "already exists" - that's OK
                            if 'already exists' in str(e).lower() or 'duplicate' in str(e).lower():
                                print(f"    ⚠️  Already exists (OK): {str(e)[:100]}")
                                conn.rollback()
                            else:
                                print(f"    ❌ Error: {str(e)[:200]}")
                                conn.rollback()
                                raise
            
            print("✅ Migration applied successfully")
            
            # Verify tables were created
            app_profiles_exists = check_table_exists(conn, 'app_profiles')
            sessions_exists = check_table_exists(conn, 'sessions')
            print(f"\n--- Verification ---")
            print(f"app_profiles table: {'✅ EXISTS' if app_profiles_exists else '❌ NOT FOUND'}")
            print(f"sessions table: {'✅ EXISTS' if sessions_exists else '❌ NOT FOUND'}")
        else:
            print("\n✅ All tables already exist - migration not needed")
        
        # Check table structure
        print("\n--- Checking table structure ---")
        with conn.cursor(row_factory=dict_row) as cur:
            if app_profiles_exists:
                cur.execute("""
                    SELECT column_name, data_type 
                    FROM information_schema.columns 
                    WHERE table_name = 'app_profiles'
                    ORDER BY ordinal_position;
                """)
                columns = cur.fetchall()
                print(f"app_profiles columns: {[c['column_name'] for c in columns]}")
            
            if sessions_exists:
                cur.execute("""
                    SELECT column_name, data_type 
                    FROM information_schema.columns 
                    WHERE table_name = 'sessions'
                    ORDER BY ordinal_position;
                """)
                columns = cur.fetchall()
                print(f"sessions columns: {[c['column_name'] for c in columns]}")
        
        # Check RLS policies
        print("\n--- Checking RLS policies ---")
        with conn.cursor(row_factory=dict_row) as cur:
            cur.execute("""
                SELECT tablename, policyname 
                FROM pg_policies 
                WHERE schemaname = 'public' 
                AND tablename IN ('app_profiles', 'sessions')
                ORDER BY tablename, policyname;
            """)
            policies = cur.fetchall()
            if policies:
                for policy in policies:
                    print(f"  ✅ {policy['tablename']}.{policy['policyname']}")
            else:
                print("  ⚠️  No RLS policies found")
        
        conn.close()
        print("\n" + "="*60)
        print("✅ VERIFICATION COMPLETE - All migrations applied!")
        print("="*60)
        return True
        
    except Exception as e:
        print(f"\n❌ ERROR: {e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == '__main__':
    # Load environment variables
    from dotenv import load_dotenv
    env_path = Path(__file__).parent.parent / '.env'
    if env_path.exists():
        load_dotenv(env_path)
        print(f"✅ Loaded .env from {env_path}")
    else:
        print(f"⚠️  .env file not found at {env_path}")
    
    success = apply_migration()
    sys.exit(0 if success else 1)

