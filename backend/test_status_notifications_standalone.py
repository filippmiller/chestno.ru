#!/usr/bin/env python3
"""
Standalone Test Suite for Status Levels Notification Service
Tests template files and basic functionality without database connection.
"""
import os
import sys
from pathlib import Path

# Add backend directory to sys.path
backend_dir = Path(__file__).parent
sys.path.append(str(backend_dir))


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


# ============================================================
# TEST 1: Service File Exists
# ============================================================

def test_service_file_exists():
    """Test that the notification service file exists"""
    print_header('TEST 1: Service File Exists')

    service_path = backend_dir / 'app' / 'services' / 'status_notification_service.py'
    exists = service_path.exists()

    if exists:
        size = service_path.stat().st_size
        print_test('Service file exists', True, f'{service_path.name} ({size} bytes)')
        return True
    else:
        print_test('Service file exists', False, f'Not found at {service_path}')
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
# TEST 3: Template Content Validation
# ============================================================

def test_template_content():
    """Test that templates contain required elements"""
    print_header('TEST 3: Template Content Validation')

    templates_dir = backend_dir / 'app' / 'templates' / 'email'
    templates = [
        ('status_granted.html', ['{{org_name}}', '{{level_name}}', '{{recipient_name}}']),
        ('status_expiring.html', ['{{days_left}}', '{{expiry_date}}', '{{org_name}}']),
        ('status_revoked.html', ['{{reason}}', '{{level_name}}', '{{org_name}}']),
        ('upgrade_request_reviewed.html', ['{{is_approved}}', '{{review_notes}}', '{{target_level}}']),
    ]

    all_valid = True
    for template_name, required_vars in templates:
        template_path = templates_dir / template_name
        if not template_path.exists():
            print_test(f'Content: {template_name}', False, 'File not found')
            all_valid = False
            continue

        with open(template_path, 'r', encoding='utf-8') as f:
            content = f.read()

        # Check required variables
        missing = [var for var in required_vars if var not in content]
        has_html = '<!DOCTYPE html>' in content
        has_body = '<body>' in content
        has_header = 'Работаем Честно' in content

        passed = len(missing) == 0 and has_html and has_body and has_header

        if passed:
            print_test(f'Content: {template_name}', True, f'{len(content)} chars, all variables present')
        else:
            details = []
            if missing:
                details.append(f'Missing: {missing}')
            if not has_html:
                details.append('No DOCTYPE')
            if not has_body:
                details.append('No body tag')
            if not has_header:
                details.append('No header')
            print_test(f'Content: {template_name}', False, ', '.join(details))

        all_valid = all_valid and passed

    return all_valid


# ============================================================
# TEST 4: Template HTML Validation
# ============================================================

def test_template_html_structure():
    """Test that templates have valid HTML structure"""
    print_header('TEST 4: Template HTML Structure')

    templates_dir = backend_dir / 'app' / 'templates' / 'email'
    templates = ['status_granted.html', 'status_expiring.html', 'status_revoked.html', 'upgrade_request_reviewed.html']

    all_valid = True
    for template_name in templates:
        template_path = templates_dir / template_name
        if not template_path.exists():
            print_test(f'HTML: {template_name}', False, 'File not found')
            all_valid = False
            continue

        with open(template_path, 'r', encoding='utf-8') as f:
            content = f.read()

        # Check HTML structure
        checks = {
            'DOCTYPE': '<!DOCTYPE html>' in content,
            '<html>': '<html' in content,
            '<head>': '<head>' in content,
            '<body>': '<body>' in content,
            '</html>': '</html>' in content,
            'charset': 'charset' in content or 'UTF-8' in content,
            'viewport': 'viewport' in content,
        }

        passed = all(checks.values())
        failed = [key for key, value in checks.items() if not value]

        if passed:
            print_test(f'HTML: {template_name}', True, 'Valid structure')
        else:
            print_test(f'HTML: {template_name}', False, f'Missing: {failed}')

        all_valid = all_valid and passed

    return all_valid


# ============================================================
# TEST 5: Template Styling
# ============================================================

def test_template_styling():
    """Test that templates have proper styling"""
    print_header('TEST 5: Template Styling')

    templates_dir = backend_dir / 'app' / 'templates' / 'email'
    templates = ['status_granted.html', 'status_expiring.html', 'status_revoked.html', 'upgrade_request_reviewed.html']

    all_valid = True
    for template_name in templates:
        template_path = templates_dir / template_name
        if not template_path.exists():
            print_test(f'Style: {template_name}', False, 'File not found')
            all_valid = False
            continue

        with open(template_path, 'r', encoding='utf-8') as f:
            content = f.read()

        # Check styling elements
        checks = {
            '<style>': '<style>' in content,
            'font-family': 'font-family' in content,
            'color': 'color:' in content or 'color :' in content,
            'padding': 'padding' in content,
            'margin': 'margin' in content,
            'max-width': 'max-width' in content,
        }

        passed = all(checks.values())
        failed = [key for key, value in checks.items() if not value]

        if passed:
            print_test(f'Style: {template_name}', True, 'Has proper styling')
        else:
            print_test(f'Style: {template_name}', False, f'Missing: {failed}')

        all_valid = all_valid and passed

    return all_valid


# ============================================================
# TEST 6: Template Links and CTAs
# ============================================================

def test_template_links():
    """Test that templates have proper links and CTAs"""
    print_header('TEST 6: Template Links and CTAs')

    templates_dir = backend_dir / 'app' / 'templates' / 'email'
    templates = ['status_granted.html', 'status_expiring.html', 'status_revoked.html', 'upgrade_request_reviewed.html']

    all_valid = True
    for template_name in templates:
        template_path = templates_dir / template_name
        if not template_path.exists():
            print_test(f'Links: {template_name}', False, 'File not found')
            all_valid = False
            continue

        with open(template_path, 'r', encoding='utf-8') as f:
            content = f.read()

        # Check links
        has_cta_button = 'cta-button' in content or 'class="cta' in content
        has_href = 'href=' in content
        has_chestno_link = 'chestno.ru' in content
        has_org_slug = '{{org_slug}}' in content

        passed = has_cta_button and has_href and has_chestno_link and has_org_slug

        if passed:
            print_test(f'Links: {template_name}', True, 'Has CTA and proper links')
        else:
            details = []
            if not has_cta_button:
                details.append('No CTA button')
            if not has_href:
                details.append('No links')
            if not has_chestno_link:
                details.append('No chestno.ru link')
            if not has_org_slug:
                details.append('No org_slug variable')
            print_test(f'Links: {template_name}', False, ', '.join(details))

        all_valid = all_valid and passed

    return all_valid


# ============================================================
# TEST 7: Service Code Quality
# ============================================================

def test_service_code():
    """Test service code quality"""
    print_header('TEST 7: Service Code Quality')

    service_path = backend_dir / 'app' / 'services' / 'status_notification_service.py'
    if not service_path.exists():
        print_test('Service code', False, 'File not found')
        return False

    with open(service_path, 'r', encoding='utf-8') as f:
        content = f.read()

    # Check required functions
    functions = [
        'notify_status_granted',
        'notify_status_expiring',
        'notify_status_revoked',
        'notify_upgrade_request_reviewed',
        'process_expiring_statuses',
    ]

    all_present = True
    for func in functions:
        present = f'async def {func}' in content or f'def {func}' in content
        print_test(f'Function: {func}', present)
        all_present = all_present and present

    # Check for docstrings
    has_docstrings = '"""' in content
    print_test('Has docstrings', has_docstrings)

    # Check imports
    has_email_import = 'email' in content.lower() and 'import' in content
    print_test('Imports email service', has_email_import)

    # Check error handling
    has_try_except = 'try:' in content and 'except' in content
    print_test('Has error handling', has_try_except)

    return all_present and has_docstrings and has_email_import and has_try_except


# ============================================================
# TEST 8: Directory Structure
# ============================================================

def test_directory_structure():
    """Test that directory structure is correct"""
    print_header('TEST 8: Directory Structure')

    paths = [
        ('app', True),
        ('app/services', True),
        ('app/templates', True),
        ('app/templates/email', True),
    ]

    all_exist = True
    for path, should_exist in paths:
        full_path = backend_dir / path
        exists = full_path.exists() and full_path.is_dir()
        passed = exists == should_exist

        if passed:
            print_test(f'Directory: {path}', True, 'Exists' if exists else 'Correctly absent')
        else:
            print_test(f'Directory: {path}', False, 'Missing' if should_exist else 'Should not exist')

        all_exist = all_exist and passed

    return all_exist


# ============================================================
# MAIN TEST RUNNER
# ============================================================

def run_all_tests():
    """Run all tests and report results"""
    from datetime import datetime

    print(f'\n{Colors.BOLD}Status Levels Notification Service - Standalone Test Suite{Colors.RESET}')
    print(f'{Colors.YELLOW}Date: {datetime.now().strftime("%Y-%m-%d %H:%M:%S")}{Colors.RESET}\n')

    tests = [
        ('Service File Exists', test_service_file_exists),
        ('Template Files', test_template_files),
        ('Template Content', test_template_content),
        ('HTML Structure', test_template_html_structure),
        ('Template Styling', test_template_styling),
        ('Template Links', test_template_links),
        ('Service Code Quality', test_service_code),
        ('Directory Structure', test_directory_structure),
    ]

    results = []
    for test_name, test_func in tests:
        try:
            result = test_func()
            results.append((test_name, result))
        except Exception as e:
            print(f'{Colors.RED}ERROR in {test_name}: {e}{Colors.RESET}')
            import traceback
            traceback.print_exc()
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
        print(f'{Colors.YELLOW}Note: These are file and structure tests only.{Colors.RESET}')
        print(f'{Colors.YELLOW}Full integration tests require database connection.{Colors.RESET}\n')
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
