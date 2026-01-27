#!/usr/bin/env python3
"""
Verification Script: Status Levels × Subscription Integration

Verifies that all components are properly deployed and configured.
"""
import sys
from pathlib import Path

# Add backend to path
backend_dir = Path(__file__).parent
sys.path.insert(0, str(backend_dir))

from app.core.db import get_connection
from psycopg.rows import dict_row


def verify_database():
    """Verify database schema and functions"""
    print("=" * 60)
    print("VERIFYING DATABASE SCHEMA")
    print("=" * 60)

    try:
        with get_connection() as conn, conn.cursor(row_factory=dict_row) as cur:
            # Check grace period columns
            cur.execute("""
                SELECT column_name
                FROM information_schema.columns
                WHERE table_schema = 'public'
                  AND table_name = 'organization_subscriptions'
                  AND column_name IN ('grace_period_days', 'grace_period_ends_at')
            """)
            grace_cols = [row['column_name'] for row in cur.fetchall()]

            if len(grace_cols) == 2:
                print("✅ Grace period columns exist in organization_subscriptions")
            else:
                print(f"❌ Missing grace period columns: {grace_cols}")
                return False

            # Check status levels tables
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

                if exists:
                    print(f"✅ Table exists: {table}")
                else:
                    print(f"❌ Table missing: {table}")
                    return False

            # Check SQL functions
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

                if exists:
                    print(f"✅ Function exists: {func}()")
                else:
                    print(f"❌ Function missing: {func}()")
                    return False

            return True

    except Exception as e:
        print(f"❌ Database verification failed: {e}")
        return False


def verify_services():
    """Verify service functions are importable"""
    print("\n" + "=" * 60)
    print("VERIFYING SERVICE FUNCTIONS")
    print("=" * 60)

    try:
        from app.services import status_levels

        required_functions = [
            'ensure_level_a',
            'start_grace_period',
            'is_grace_period_ended',
            'revoke_level_a_for_subscription',
            'handle_subscription_status_change',
            'get_organization_status',
            'check_level_c_eligibility',
            'grant_status_level',
            'revoke_status_level'
        ]

        for func_name in required_functions:
            if hasattr(status_levels, func_name):
                print(f"✅ Function exists: status_levels.{func_name}")
            else:
                print(f"❌ Function missing: status_levels.{func_name}")
                return False

        # Check subscriptions service
        from app.services import subscriptions

        if hasattr(subscriptions, 'update_subscription_status'):
            print("✅ Function exists: subscriptions.update_subscription_status")
        else:
            print("❌ Function missing: subscriptions.update_subscription_status")
            return False

        return True

    except ImportError as e:
        print(f"❌ Service import failed: {e}")
        return False


def verify_routes():
    """Verify webhook routes are registered"""
    print("\n" + "=" * 60)
    print("VERIFYING WEBHOOK ROUTES")
    print("=" * 60)

    try:
        from app.api.routes import webhooks

        if hasattr(webhooks, 'router'):
            print("✅ Webhook router exists")
        else:
            print("❌ Webhook router missing")
            return False

        # Check if router has the subscription endpoint
        routes = [route.path for route in webhooks.router.routes]

        if '/subscription-status-changed' in routes:
            print("✅ Subscription webhook endpoint registered")
        else:
            print(f"❌ Subscription webhook endpoint missing. Routes: {routes}")
            return False

        return True

    except ImportError as e:
        print(f"❌ Routes import failed: {e}")
        return False


def verify_tests():
    """Verify test files exist"""
    print("\n" + "=" * 60)
    print("VERIFYING TEST FILES")
    print("=" * 60)

    test_file = backend_dir / 'tests' / 'test_status_levels_integration.py'

    if test_file.exists():
        print(f"✅ Test file exists: {test_file}")

        # Count test functions
        with open(test_file, 'r', encoding='utf-8') as f:
            content = f.read()
            test_count = content.count('def test_')

        print(f"✅ Found {test_count} test functions")

        return True
    else:
        print(f"❌ Test file missing: {test_file}")
        return False


def verify_documentation():
    """Verify documentation files exist"""
    print("\n" + "=" * 60)
    print("VERIFYING DOCUMENTATION")
    print("=" * 60)

    docs_dir = backend_dir / 'docs'
    required_docs = [
        'STATUS_LEVELS_SUBSCRIPTION_INTEGRATION.md',
        'SUBSCRIPTION_STATUS_FLOW_DIAGRAM.txt',
        'STATUS_LEVELS_QUICK_REFERENCE.md',
        'IMPLEMENTATION_SUMMARY_STATUS_SUBSCRIPTION.md'
    ]

    all_exist = True
    for doc in required_docs:
        doc_path = docs_dir / doc
        if doc_path.exists():
            print(f"✅ Documentation exists: {doc}")
        else:
            print(f"❌ Documentation missing: {doc}")
            all_exist = False

    return all_exist


def main():
    """Run all verifications"""
    print("\n" + "=" * 60)
    print("STATUS LEVELS × SUBSCRIPTION INTEGRATION VERIFICATION")
    print("=" * 60 + "\n")

    results = {
        'Database Schema': verify_database(),
        'Service Functions': verify_services(),
        'Webhook Routes': verify_routes(),
        'Test Files': verify_tests(),
        'Documentation': verify_documentation()
    }

    print("\n" + "=" * 60)
    print("VERIFICATION SUMMARY")
    print("=" * 60)

    for component, passed in results.items():
        status = "✅ PASSED" if passed else "❌ FAILED"
        print(f"{component:.<40} {status}")

    all_passed = all(results.values())

    print("\n" + "=" * 60)
    if all_passed:
        print("🎉 ALL VERIFICATIONS PASSED!")
        print("=" * 60)
        print("\nIntegration is complete and ready for deployment.")
        print("\nNext steps:")
        print("1. Run unit tests: pytest tests/test_status_levels_integration.py")
        print("2. Deploy to staging environment")
        print("3. Test webhook endpoint manually")
        print("4. Set up cron jobs for grace period checks")
        print("5. Configure monitoring and alerts")
        print("6. Deploy to production")
        return 0
    else:
        print("❌ SOME VERIFICATIONS FAILED")
        print("=" * 60)
        print("\nPlease fix the issues above before deployment.")
        return 1


if __name__ == "__main__":
    sys.exit(main())
