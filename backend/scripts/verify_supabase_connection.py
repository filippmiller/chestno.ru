"""
Verify Supabase connection and check Auth V2 setup
"""
import os
import sys
from pathlib import Path
import psycopg
from psycopg.rows import dict_row
# from supabase import create_client, Client  # Not needed for DB check

def check_database():
    """Check database tables and structure"""
    print("="*70)
    print("CHECKING DATABASE CONNECTION AND TABLES")
    print("="*70)
    
    database_url = os.getenv('DATABASE_URL')
    if not database_url:
        print("❌ DATABASE_URL not set")
        return False
    
    try:
        conn = psycopg.connect(database_url)
        print("✅ Connected to Supabase database")
        
        # Check tables
        with conn.cursor(row_factory=dict_row) as cur:
            # Check app_profiles
            cur.execute("""
                SELECT EXISTS (
                    SELECT FROM information_schema.tables 
                    WHERE table_schema = 'public' 
                    AND table_name = 'app_profiles'
                );
            """)
            app_profiles_exists = cur.fetchone()['exists']
            
            cur.execute("""
                SELECT EXISTS (
                    SELECT FROM information_schema.tables 
                    WHERE table_schema = 'public' 
                    AND table_name = 'sessions'
                );
            """)
            sessions_exists = cur.fetchone()['exists']
            
            print(f"\nTables:")
            print(f"  app_profiles: {'✅ EXISTS' if app_profiles_exists else '❌ NOT FOUND'}")
            print(f"  sessions: {'✅ EXISTS' if sessions_exists else '❌ NOT FOUND'}")
            
            if app_profiles_exists:
                # Get columns
                cur.execute("""
                    SELECT column_name, data_type, is_nullable
                    FROM information_schema.columns 
                    WHERE table_name = 'app_profiles'
                    ORDER BY ordinal_position;
                """)
                columns = cur.fetchall()
                print(f"\n  app_profiles columns:")
                for col in columns:
                    print(f"    - {col['column_name']} ({col['data_type']}) {'NULL' if col['is_nullable'] == 'YES' else 'NOT NULL'}")
                
                # Check RLS
                cur.execute("""
                    SELECT tablename, rowsecurity 
                    FROM pg_tables 
                    WHERE schemaname = 'public' 
                    AND tablename = 'app_profiles';
                """)
                rls = cur.fetchone()
                print(f"  RLS enabled: {'✅ YES' if rls and rls['rowsecurity'] else '❌ NO'}")
                
                # Count records
                cur.execute("SELECT COUNT(*) as count FROM public.app_profiles;")
                count = cur.fetchone()['count']
                print(f"  Records: {count}")
            
            if sessions_exists:
                # Get columns
                cur.execute("""
                    SELECT column_name, data_type, is_nullable
                    FROM information_schema.columns 
                    WHERE table_name = 'sessions'
                    ORDER BY ordinal_position;
                """)
                columns = cur.fetchall()
                print(f"\n  sessions columns:")
                for col in columns:
                    print(f"    - {col['column_name']} ({col['data_type']}) {'NULL' if col['is_nullable'] == 'YES' else 'NOT NULL'}")
                
                # Count records
                cur.execute("SELECT COUNT(*) as count FROM public.sessions;")
                count = cur.fetchone()['count']
                print(f"  Records: {count}")
        
        conn.close()
        return True
        
    except Exception as e:
        print(f"❌ Database error: {e}")
        import traceback
        traceback.print_exc()
        return False

def check_supabase_api():
    """Check Supabase API configuration"""
    print("\n" + "="*70)
    print("CHECKING SUPABASE API CONFIGURATION")
    print("="*70)
    
    supabase_url = os.getenv('SUPABASE_URL')
    supabase_key = os.getenv('SUPABASE_SERVICE_ROLE_KEY')
    
    if not supabase_url or not supabase_key:
        print("❌ SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not set")
        return False
    
    print(f"✅ Supabase URL: {supabase_url}")
    print(f"✅ Service role key configured (length: {len(supabase_key)})")
    print("  (API connection test skipped - requires supabase-py module)")
    return True

def check_env_vars():
    """Check required environment variables"""
    print("\n" + "="*70)
    print("CHECKING ENVIRONMENT VARIABLES")
    print("="*70)
    
    required_vars = [
        'SUPABASE_URL',
        'SUPABASE_SERVICE_ROLE_KEY',
        'SUPABASE_ANON_KEY',
        'SUPABASE_JWT_SECRET',
        'DATABASE_URL',
    ]
    
    all_ok = True
    for var in required_vars:
        value = os.getenv(var)
        if value:
            # Mask sensitive values
            if 'SECRET' in var or 'KEY' in var or 'PASSWORD' in var:
                display_value = value[:10] + "..." + value[-5:] if len(value) > 15 else "***"
            else:
                display_value = value
            print(f"  ✅ {var}: {display_value}")
        else:
            print(f"  ❌ {var}: NOT SET")
            all_ok = False
    
    return all_ok

if __name__ == '__main__':
    # Load environment
    from dotenv import load_dotenv
    env_path = Path(__file__).parent.parent / '.env'
    if env_path.exists():
        load_dotenv(env_path)
        print(f"✅ Loaded .env from {env_path}")
    else:
        print(f"⚠️  .env file not found at {env_path}")
    
    # Set from provided values
    os.environ['SUPABASE_URL'] = 'https://ygsbcrqajkjcvrzixvam.supabase.co'
    os.environ['SUPABASE_SERVICE_ROLE_KEY'] = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inlnc2JjcnFhamtqY3Zyeml4dmFtIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NDI0OTk1MSwiZXhwIjoyMDc5ODI1OTUxfQ.cEX-VF4auaZGPD2xOPgG2t3_3445CAGGVYgM9CMM5hA'
    os.environ['SUPABASE_ANON_KEY'] = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inlnc2JjcnFhamtqY3Zyeml4dmFtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQyNDk5NTEsImV4cCI6MjA3OTgyNTk1MX0.ZKdGVGCxWoy6JWmHWPpwrvtlaYNecgpUYqm1rSW7NNc'
    os.environ['SUPABASE_JWT_SECRET'] = 'UlWm0TJPieLP8VIC4nUeNxxBfjisNXqxT9jZ5VDtXT7h7OgVxhZjG1QucKdlTI1fAfQCvmez9K07DCOAoKd50w=='
    os.environ['DATABASE_URL'] = 'postgresql://postgres:Champ20242024+@db.ygsbcrqajkjcvrzixvam.supabase.co:5432/postgres'
    
    print("\n")
    env_ok = check_env_vars()
    db_ok = check_database()
    api_ok = check_supabase_api()
    
    print("\n" + "="*70)
    if env_ok and db_ok and api_ok:
        print("✅ ALL CHECKS PASSED - Supabase connection verified!")
    else:
        print("❌ SOME CHECKS FAILED - See details above")
    print("="*70)
    
    sys.exit(0 if (env_ok and db_ok and api_ok) else 1)

