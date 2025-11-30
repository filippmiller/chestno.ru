# Railway Deploy Fix - Supabase Settings Issue

## Problem Found
Railway logs showed the app was starting, but there was a potential runtime error in `supabase.py`.

## Root Cause
In `backend/app/core/supabase.py`, the method `get_user_by_access_token()` was using `settings.supabase_anon_key` but `settings` was not defined in that method scope. The `settings` variable was removed from module level to avoid initialization issues.

## Fix Applied

### File: `backend/app/core/supabase.py`

**Before:**
```python
def get_user_by_access_token(self, token: str) -> Dict[str, Any]:
    headers = {
        'Authorization': f'Bearer {token}',
        'apikey': settings.supabase_anon_key,  # ❌ settings not defined
    }
```

**After:**
```python
def get_user_by_access_token(self, token: str) -> Dict[str, Any]:
    settings = get_settings()  # ✅ Get settings in method scope
    headers = {
        'Authorization': f'Bearer {token}',
        'apikey': settings.supabase_anon_key,
    }
```

## Verification

✅ Fixed `settings` reference in `get_user_by_access_token()`
✅ All methods now properly get settings when needed
✅ Code compiles without errors
✅ Changes pushed to git

## Status

**Fixed and pushed to git.**
Railway should now deploy successfully without runtime errors.

