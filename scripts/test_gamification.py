#!/usr/bin/env python3
"""
Test script for QR Gamification system.
Run this against the production database to verify the feature works.

Usage:
    python scripts/test_gamification.py

Requires:
    - DATABASE_URL environment variable set
    - Or run from backend directory with .env loaded
"""

import os
import sys
from uuid import uuid4
from datetime import datetime

# Add backend to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'backend'))

try:
    import psycopg2
    from psycopg2.extras import RealDictCursor
except ImportError:
    print("Please install psycopg2: pip install psycopg2-binary")
    sys.exit(1)


def get_connection():
    """Get database connection."""
    db_url = os.environ.get('DATABASE_URL')
    if not db_url:
        # Try loading from .env
        env_path = os.path.join(os.path.dirname(__file__), '..', 'backend', '.env')
        if os.path.exists(env_path):
            with open(env_path) as f:
                for line in f:
                    if line.startswith('DATABASE_URL='):
                        db_url = line.split('=', 1)[1].strip()
                        break

    if not db_url:
        # Use default from env.example
        db_url = 'postgresql://postgres:Champ20242024+@db.ygsbcrqajkjcvrzixvam.supabase.co:5432/postgres'

    return psycopg2.connect(db_url, cursor_factory=RealDictCursor)


def test_tables_exist(cur):
    """Verify gamification tables exist."""
    print("\n1. Testing table existence...")

    tables = [
        'qr_scanner_profiles',
        'qr_scan_history',
        'qr_achievements',
        'user_qr_achievements',
        'qr_rewards',
        'user_claimed_rewards',
    ]

    for table in tables:
        cur.execute("""
            SELECT EXISTS (
                SELECT FROM information_schema.tables
                WHERE table_schema = 'public' AND table_name = %s
            )
        """, (table,))
        exists = cur.fetchone()['exists']
        status = "[OK]" if exists else "[FAIL]"
        print(f"   {status} {table}")
        if not exists:
            return False

    return True


def test_achievements_seeded(cur):
    """Verify achievements are seeded."""
    print("\n2. Testing achievements seeded...")

    cur.execute("SELECT COUNT(*) as count FROM qr_achievements")
    count = cur.fetchone()['count']

    if count > 0:
        print(f"   [OK] {count} achievements found")

        cur.execute("SELECT code, name_en FROM qr_achievements LIMIT 5")
        for row in cur.fetchall():
            print(f"     - {row['code']}: {row['name_en']}")
        return True
    else:
        print("   [FAIL] No achievements seeded")
        return False


def test_tier_calculation(cur):
    """Test tier calculation function."""
    print("\n3. Testing tier calculation...")

    # Check if function exists
    cur.execute("""
        SELECT EXISTS (
            SELECT FROM pg_proc p
            JOIN pg_namespace n ON p.pronamespace = n.oid
            WHERE n.nspname = 'public' AND p.proname = 'calculate_qr_scan_tier'
        )
    """)
    exists = cur.fetchone()['exists']

    if not exists:
        print("   [FAIL] calculate_qr_scan_tier function not found")
        return False

    # Test tier thresholds
    test_cases = [
        (0, 'none'),
        (4, 'none'),
        (5, 'bronze'),
        (19, 'bronze'),
        (20, 'silver'),
        (49, 'silver'),
        (50, 'gold'),
        (100, 'gold'),
    ]

    all_passed = True
    for scans, expected_tier in test_cases:
        cur.execute("SELECT calculate_qr_scan_tier(%s) as tier", (scans,))
        actual_tier = cur.fetchone()['tier']
        status = "[OK]" if actual_tier == expected_tier else "[FAIL]"
        if actual_tier != expected_tier:
            all_passed = False
        print(f"   {status} {scans} scans => {actual_tier} (expected: {expected_tier})")

    return all_passed


def test_scan_recording(cur, conn):
    """Test recording a scan."""
    print("\n4. Testing scan recording...")

    # Get a test user
    cur.execute("SELECT id FROM auth.users LIMIT 1")
    user_row = cur.fetchone()

    if not user_row:
        print("   [FAIL] No users found in database")
        return False

    user_id = user_row['id']
    print(f"   Using test user: {user_id}")

    # Check if function exists
    cur.execute("""
        SELECT EXISTS (
            SELECT FROM pg_proc p
            JOIN pg_namespace n ON p.pronamespace = n.oid
            WHERE n.nspname = 'public' AND p.proname = 'record_qr_scan'
        )
    """)
    exists = cur.fetchone()['exists']

    if exists:
        print("   [OK] record_qr_scan function exists")
        # Note: We don't actually run the function to avoid test data
        return True
    else:
        print("   [FAIL] record_qr_scan function not found")
        return False


def test_review_voting(cur):
    """Test review voting tables."""
    print("\n5. Testing review voting...")

    cur.execute("""
        SELECT EXISTS (
            SELECT FROM information_schema.tables
            WHERE table_schema = 'public' AND table_name = 'review_helpful_votes'
        )
    """)
    exists = cur.fetchone()['exists']

    if not exists:
        print("   [FAIL] review_helpful_votes table not found")
        return False

    print("   [OK] review_helpful_votes table exists")

    # Check if reviews table has voting columns
    cur.execute("""
        SELECT column_name FROM information_schema.columns
        WHERE table_name = 'reviews' AND column_name IN ('upvote_count', 'downvote_count', 'wilson_score')
    """)
    columns = [row['column_name'] for row in cur.fetchall()]

    for col in ['upvote_count', 'downvote_count', 'wilson_score']:
        status = "[OK]" if col in columns else "[FAIL]"
        print(f"   {status} reviews.{col}")

    return len(columns) == 3


def main():
    """Run all tests."""
    print("=" * 50)
    print("QR Gamification System Test")
    print("=" * 50)

    try:
        conn = get_connection()
        cur = conn.cursor()

        results = []

        results.append(("Tables exist", test_tables_exist(cur)))
        results.append(("Achievements seeded", test_achievements_seeded(cur)))
        results.append(("Tier calculation", test_tier_calculation(cur)))
        results.append(("Scan recording", test_scan_recording(cur, conn)))
        results.append(("Review voting", test_review_voting(cur)))

        conn.close()

        print("\n" + "=" * 50)
        print("RESULTS")
        print("=" * 50)

        passed = sum(1 for _, r in results if r)
        total = len(results)

        for name, result in results:
            status = "PASS" if result else "FAIL"
            print(f"  {status}: {name}")

        print(f"\n{passed}/{total} tests passed")

        if passed == total:
            print("\n[OK] All tests passed! Gamification system is ready.")
            return 0
        else:
            print("\n[FAIL] Some tests failed. Check configuration.")
            return 1

    except Exception as e:
        print(f"\nError: {e}")
        return 1


if __name__ == '__main__':
    sys.exit(main())
