#!/usr/bin/env python3
"""
Quick verification that status_levels service imports correctly.

Run: python backend/test_status_levels_import.py
"""

import sys

try:
    print("Testing status_levels service import...")

    # Test service import
    from app.services import status_levels
    print("✓ Service module imported successfully")

    # Test schema imports
    from app.schemas.status_levels import (
        StatusLevel,
        OrganizationStatus,
        LevelCProgress,
        LevelCEligibility,
        GrantStatusLevelRequest,
        RevokeStatusLevelRequest,
    )
    print("✓ Schema classes imported successfully")

    # Verify core functions exist
    required_functions = [
        'get_organization_status',
        'check_level_c_eligibility',
        'get_level_c_progress',
        'grant_status_level',
        'revoke_status_level',
        'ensure_level_a',
        'revoke_level_a_for_subscription',
        'start_grace_period',
        'is_grace_period_ended',
        'handle_subscription_status_change',
        'create_upgrade_request',
        'get_upgrade_requests_for_org',
        'get_status_history',
        'get_status_levels_info',
    ]

    for func_name in required_functions:
        if not hasattr(status_levels, func_name):
            print(f"✗ Missing function: {func_name}")
            sys.exit(1)

    print(f"✓ All {len(required_functions)} required functions present")

    # Test cache utilities
    assert hasattr(status_levels, '_cache')
    assert hasattr(status_levels, '_get_cached')
    assert hasattr(status_levels, '_set_cache')
    assert hasattr(status_levels, '_invalidate_cache')
    print("✓ Cache utilities present")

    print("\n" + "="*50)
    print("SUCCESS: Status Levels Service ready for use!")
    print("="*50)
    print("\nNext steps:")
    print("1. Run unit tests: pytest backend/tests/test_status_levels.py -v")
    print("2. Create API endpoints (see STATUS_LEVELS_SERVICE_README.md)")
    print("3. Integrate with frontend")

except ImportError as e:
    print(f"✗ Import error: {e}")
    sys.exit(1)
except Exception as e:
    print(f"✗ Unexpected error: {e}")
    sys.exit(1)
