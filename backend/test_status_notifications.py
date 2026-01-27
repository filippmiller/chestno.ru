#!/usr/bin/env python3
"""
Test suite for Status Levels Notification Service
Tests all notification functions and email template rendering.
"""
import asyncio
import os
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path
from uuid import uuid4

# Add backend directory to sys.path
backend_dir = Path(__file__).parent
sys.path.append(str(backend_dir))

from app.core.db import get_connection
from app.services import status_notification_service
from psycopg.rows import dict_row


class Colors:
    """ANSI color codes for terminal output"""
    GREEN = '\033[92m'
    RED = '\033[91m'
    YELLOW = '\033[93m'
    BLUE = '\033[94m'
    RESET = '\033[0m'
    BOLD = '\033[1m'


def print_header(text: str):
    """Print section header"""
    print(f'\n{Colors.BOLD}{Colors.BLUE}{"=" * 60}{Colors.RESET}')
    print(f'{Colors.BOLD}{Colors.BLUE}{text}{Colors.RESET}')
    print(f'{Colors.BOLD}{Colors.BLUE}{"=" * 60}{Colors.RESET}\n')


def print_test(test_name: str, passed: bool, details: str = ''):
    """Print test result"""
    status = f'{Colors.GREEN}✅ PASS' if passed else f'{Colors.RED}❌ FAIL'
    print(f'{status}{Colors.RESET} - {test_name}')
    if details:
        print(f'  {Colors.YELLOW}└─{Colors.RESET} {details}')


def print_info(message: str):
    """Print info message"""
    print(f'{Colors.YELLOW}ℹ{Colors.RESET}  {message}')


# ============================================================
# TEST 1: Service Module Import
# ============================================================

def test_service_import():
    """Test that the notification service can be imported"""
    print_header('TEST 1: Service Module Import')

    try:
        # Check if service exists
        assert hasattr(status_notification_service, 'notify_status_granted')
        assert hasattr(status_notification_service, 'notify_status_expiring')
        assert hasattr(status_notification_service, 'notify_status_revoked')
        assert hasattr(status_notification_service, 'notify_upgrade_request_reviewed')
        print_test('Service functions exist', True)

        # Check helper functions
        assert hasattr(status_notification_service, '_render_template')
        assert hasattr(status_notification_service, '_render_text_version')
        print_test('Helper functions exist', True)

        # Check constants
        assert hasattr(status_notification_service, 'STATUS_LEVEL_CONFIG')
        config = status_notification_service.STATUS_LEVEL_CONFIG
        assert 'A' in config and 'B' in config and 'C' in config
        print_test('Status level configuration exists', True, f'Levels: {list(config.keys())}')

        return True
    except AssertionError as e:
        print_test('Service import', False, str(e))
        return False
    except Exception as e:
        print_test('Service import', False, f'Error: {e}')
        return False


# ============================================================
# TEST 2: Email Template Files
# ============================================================

def test_template_files():
    """Test that all email template files exist"""
    print_header('TEST 2: Email Template Files')

    templates_dir = backend_dir / 'app' / 'templates' / 'email'
    required_templates = [
        'status_granted.html',
        'status_expiring.html',
        'status_revoked.html',
        'upgrade_request_reviewed.html',
    ]

    all_exist = True
    for template in required_templates:
        template_path = templates_dir / template
        exists = template_path.exists()
        all_exist = all_exist and exists

        if exists:
            size = template_path.stat().st_size
            print_test(f'Template: {template}', True, f'{size} bytes')
        else:
            print_test(f'Template: {template}', False, 'File not found')

    return all_exist


# ============================================================
# TEST 3: Template Rendering
# ============================================================

def test_template_rendering():
    """Test template rendering with sample data"""
    print_header('TEST 3: Template Rendering')

    test_context = {
        'org_name': 'Test Company LLC',
        'recipient_name': 'Иван Иванов',
        'level': 'B',
        'level_name': 'Проверенный',
        'level_color': '#3B82F6',
        'level_emoji': '✓',
        'org_slug': 'test-company',
    }

    all_passed = True

    # Test each template
    templates = ['status_granted', 'status_expiring', 'status_revoked', 'upgrade_request_reviewed']

    for template_name in templates:
        try:
            # Add template-specific context
            context = test_context.copy()
            if template_name == 'status_expiring':
                context['days_left'] = 7
                context['expiry_date'] = '01.02.2026'
                context['urgency'] = 'высокий'
            elif template_name == 'status_revoked':
                context['reason'] = 'Test revocation reason'
            elif template_name == 'upgrade_request_reviewed':
                context['is_approved'] = True
                context['review_notes'] = 'Test review notes'
                context['reviewed_at'] = '27.01.2026 15:30'

            # Render HTML
            html = status_notification_service._render_template(template_name, context)
            html_valid = len(html) > 100 and 'Test Company LLC' in html
            print_test(f'Render {template_name} (HTML)', html_valid, f'{len(html)} chars')

            # Render text
            text = status_notification_service._render_text_version(template_name, context)
            text_valid = len(text) > 50 and 'Test Company LLC' in text
            print_test(f'Render {template_name} (Text)', text_valid, f'{len(text)} chars')

            all_passed = all_passed and html_valid and text_valid

        except Exception as e:
            print_test(f'Render {template_name}', False, str(e))
            all_passed = False

    return all_passed


# ============================================================
# TEST 4: Helper Functions
# ============================================================

def test_helper_functions():
    """Test helper functions"""
    print_header('TEST 4: Helper Functions')

    all_passed = True

    # Test _pluralize_days
    try:
        pluralize = status_notification_service._pluralize_days

        cases = [
            (1, 'день'),
            (2, 'дня'),
            (5, 'дней'),
            (11, 'дней'),
            (21, 'день'),
            (22, 'дня'),
            (25, 'дней'),
        ]

        for days, expected in cases:
            result = pluralize(days)
            passed = result == expected
            print_test(f'Pluralize {days} days', passed, f'Expected "{expected}", got "{result}"')
            all_passed = all_passed and passed

    except Exception as e:
        print_test('Pluralize days function', False, str(e))
        all_passed = False

    return all_passed


# ============================================================
# TEST 5: Database Integration (Read-only)
# ============================================================

def test_database_integration():
    """Test database schema and tables"""
    print_header('TEST 5: Database Integration (Read-only)')

    try:
        with get_connection() as conn, conn.cursor(row_factory=dict_row) as cur:
            # Check required tables exist
            tables = [
                'organizations',
                'organization_members',
                'app_users',
                'organization_status_levels',
                'organization_status_history',
                'status_upgrade_requests',
            ]

            all_exist = True
            for table in tables:
                cur.execute(
                    '''
                    SELECT EXISTS (
                        SELECT FROM information_schema.tables
                        WHERE table_schema = 'public'
                        AND table_name = %s
                    )
                    ''',
                    (table,)
                )
                exists = cur.fetchone()['exists']
                print_test(f'Table: {table}', exists)
                all_exist = all_exist and exists

            return all_exist

    except Exception as e:
        print_test('Database integration', False, str(e))
        return False


# ============================================================
# TEST 6: Notification Function Signatures
# ============================================================

def test_function_signatures():
    """Test that notification functions have correct signatures"""
    print_header('TEST 6: Function Signatures')

    try:
        import inspect

        # Test notify_status_granted signature
        sig = inspect.signature(status_notification_service.notify_status_granted)
        params = list(sig.parameters.keys())
        expected = ['org_id', 'level', 'granted_by', 'valid_until']
        passed = all(p in params for p in expected)
        print_test('notify_status_granted signature', passed, f'Params: {params}')

        # Test notify_status_expiring signature
        sig = inspect.signature(status_notification_service.notify_status_expiring)
        params = list(sig.parameters.keys())
        expected = ['org_id', 'level', 'days_left']
        passed = all(p in params for p in expected)
        print_test('notify_status_expiring signature', passed, f'Params: {params}')

        # Test notify_status_revoked signature
        sig = inspect.signature(status_notification_service.notify_status_revoked)
        params = list(sig.parameters.keys())
        expected = ['org_id', 'level', 'reason']
        passed = all(p in params for p in expected)
        print_test('notify_status_revoked signature', passed, f'Params: {params}')

        # Test notify_upgrade_request_reviewed signature
        sig = inspect.signature(status_notification_service.notify_upgrade_request_reviewed)
        params = list(sig.parameters.keys())
        expected = ['request_id', 'status']
        passed = all(p in params for p in expected)
        print_test('notify_upgrade_request_reviewed signature', passed, f'Params: {params}')

        return True

    except Exception as e:
        print_test('Function signatures', False, str(e))
        return False


# ============================================================
# TEST 7: Background Worker Function
# ============================================================

def test_background_worker():
    """Test background worker function exists and is callable"""
    print_header('TEST 7: Background Worker Function')

    try:
        assert hasattr(status_notification_service, 'process_expiring_statuses')
        print_test('Worker function exists', True)

        # Check it's an async function
        import inspect
        is_async = inspect.iscoroutinefunction(status_notification_service.process_expiring_statuses)
        print_test('Worker function is async', is_async)

        return is_async

    except Exception as e:
        print_test('Background worker', False, str(e))
        return False


# ============================================================
# TEST 8: Email Service Integration
# ============================================================

def test_email_service_integration():
    """Test integration with existing email service"""
    print_header('TEST 8: Email Service Integration')

    try:
        from app.services import email as email_service

        # Check email service has required function
        assert hasattr(email_service, 'send_email')
        print_test('email.send_email exists', True)

        # Check it has the right signature
        import inspect
        sig = inspect.signature(email_service.send_email)
        params = list(sig.parameters.keys())
        expected = ['to_email', 'subject', 'body_text', 'body_html']
        passed = all(p in params for p in expected)
        print_test('email.send_email signature', passed, f'Params: {params}')

        return passed

    except Exception as e:
        print_test('Email service integration', False, str(e))
        return False


# ============================================================
# MAIN TEST RUNNER
# ============================================================

def run_all_tests():
    """Run all tests and report results"""
    print(f'\n{Colors.BOLD}Status Levels Notification Service - Test Suite{Colors.RESET}')
    print(f'{Colors.YELLOW}Date: {datetime.now().strftime("%Y-%m-%d %H:%M:%S")}{Colors.RESET}\n')

    tests = [
        ('Service Import', test_service_import),
        ('Template Files', test_template_files),
        ('Template Rendering', test_template_rendering),
        ('Helper Functions', test_helper_functions),
        ('Database Integration', test_database_integration),
        ('Function Signatures', test_function_signatures),
        ('Background Worker', test_background_worker),
        ('Email Service Integration', test_email_service_integration),
    ]

    results = []
    for test_name, test_func in tests:
        try:
            result = test_func()
            results.append((test_name, result))
        except Exception as e:
            print(f'{Colors.RED}ERROR in {test_name}: {e}{Colors.RESET}')
            results.append((test_name, False))

    # Summary
    print_header('TEST SUMMARY')

    passed = sum(1 for _, result in results if result)
    total = len(results)

    for test_name, result in results:
        status = f'{Colors.GREEN}✅ PASS' if result else f'{Colors.RED}❌ FAIL'
        print(f'{status}{Colors.RESET} - {test_name}')

    print(f'\n{Colors.BOLD}Results: {passed}/{total} tests passed{Colors.RESET}')

    if passed == total:
        print(f'{Colors.GREEN}{Colors.BOLD}✅ ALL TESTS PASSED!{Colors.RESET}\n')
        return 0
    else:
        print(f'{Colors.RED}{Colors.BOLD}❌ SOME TESTS FAILED{Colors.RESET}\n')
        return 1


if __name__ == '__main__':
    try:
        exit_code = run_all_tests()
        sys.exit(exit_code)
    except KeyboardInterrupt:
        print(f'\n{Colors.YELLOW}Tests interrupted by user{Colors.RESET}')
        sys.exit(1)
    except Exception as e:
        print(f'\n{Colors.RED}Fatal error: {e}{Colors.RESET}')
        import traceback
        traceback.print_exc()
        sys.exit(1)
