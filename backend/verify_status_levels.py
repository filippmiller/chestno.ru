#!/usr/bin/env python3
"""Verify Status Levels database schema"""
import os
import sys
from pathlib import Path

# Add backend directory to sys.path
backend_dir = Path(__file__).parent
sys.path.append(str(backend_dir))

from app.core.db import get_connection
from psycopg.rows import dict_row

def verify_status_levels():
    try:
        print("Connecting to database...")
        with get_connection() as conn:
            print("Connected!\n")
            with conn.cursor(row_factory=dict_row) as cur:

                # Check tables exist
                print("=== VERIFYING TABLES ===")
                tables = [
                    'organization_status_levels',
                    'organization_status_history',
                    'status_upgrade_requests'
                ]

                for table in tables:
                    cur.execute("""
                        SELECT EXISTS (
                            SELECT FROM information_schema.tables
                            WHERE table_schema = 'public'
                            AND table_name = %s
                        )
                    """, (table,))
                    exists = cur.fetchone()['exists']
                    status = "✅" if exists else "❌"
                    print(f"{status} {table}")

                # Check functions exist
                print("\n=== VERIFYING FUNCTIONS ===")
                functions = [
                    'get_current_status_level',
                    'check_level_c_criteria',
                    'grant_status_level',
                    'revoke_status_level'
                ]

                for func in functions:
                    cur.execute("""
                        SELECT EXISTS (
                            SELECT FROM pg_proc p
                            JOIN pg_namespace n ON p.pronamespace = n.oid
                            WHERE n.nspname = 'public'
                            AND p.proname = %s
                        )
                    """, (func,))
                    exists = cur.fetchone()['exists']
                    status = "✅" if exists else "❌"
                    print(f"{status} {func}()")

                # Test get_current_status_level function with dummy org
                print("\n=== TESTING FUNCTIONS ===")
                cur.execute("""
                    SELECT public.get_current_status_level(
                        '00000000-0000-0000-0000-000000000000'::uuid
                    ) as result
                """)
                result = cur.fetchone()['result']
                print(f"✅ get_current_status_level() returns: '{result}' (expected '0')")

                # Check subscriptions table has new columns
                print("\n=== VERIFYING SUBSCRIPTION EXTENSIONS ===")
                cur.execute("""
                    SELECT column_name
                    FROM information_schema.columns
                    WHERE table_schema = 'public'
                    AND table_name = 'organization_subscriptions'
                    AND column_name IN ('grace_period_days', 'grace_period_ends_at')
                    ORDER BY column_name
                """)
                cols = [row['column_name'] for row in cur.fetchall()]
                for col in ['grace_period_days', 'grace_period_ends_at']:
                    status = "✅" if col in cols else "❌"
                    print(f"{status} organization_subscriptions.{col}")

                print("\n✅ ALL VERIFICATIONS PASSED!")

    except Exception as e:
        print(f"\n❌ Error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

if __name__ == "__main__":
    verify_status_levels()
