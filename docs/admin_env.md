# Admin Panel Environment Variables

This document describes the environment variables required to access and test the admin panel on production.

## Required Environment Variables

### For E2E Tests

| Variable | Description | Required | Example |
|----------|-------------|----------|---------|
| `E2E_BASE_URL` | Base URL of production site | No (has default) | `https://chestnoru-production.up.railway.app` |
| `E2E_ADMIN_EMAIL` | Admin user email for testing | **Yes** | `e2e-admin-*@chestno.ru` |
| `E2E_ADMIN_PASSWORD` | Admin user password | **Yes** | (set securely) |

### For Manual Testing

No environment variables needed - use the admin credentials directly in the browser.

## Setting Environment Variables

### Windows PowerShell

```powershell
$env:E2E_BASE_URL="https://chestnoru-production.up.railway.app"
$env:E2E_ADMIN_EMAIL="e2e-admin-20251130123223@chestno.ru"
$env:E2E_ADMIN_PASSWORD="your-password-here"
```

### Linux/macOS

```bash
export E2E_BASE_URL="https://chestnoru-production.up.railway.app"
export E2E_ADMIN_EMAIL="e2e-admin-20251130123223@chestno.ru"
export E2E_ADMIN_PASSWORD="your-password-here"
```

### Railway Environment Variables

To set in Railway Dashboard:

1. Go to your Railway project
2. Navigate to **Variables** tab
3. Add:
   - `E2E_BASE_URL` = `https://chestnoru-production.up.railway.app`
   - `E2E_ADMIN_EMAIL` = `e2e-admin-*@chestno.ru`
   - `E2E_ADMIN_PASSWORD` = (your admin password)

**Note:** These variables are for testing purposes only. Do not commit them to the repository.

## Creating Admin Test Account

Use the script to create a new E2E admin account:

```bash
cd backend
python scripts/create_e2e_admin.py
```

The script will output credentials that you can use for testing.

## Security Notes

⚠️ **IMPORTANT:**

- Never commit admin credentials to the repository
- Never expose credentials in logs or error messages
- Use environment variables or secure secret management
- Rotate admin passwords regularly
- Use different credentials for production vs. staging

## Admin Panel URLs

Once you have admin credentials, you can access:

- **Admin Panel:** `{E2E_BASE_URL}/admin`
- **Admin Dashboard:** `{E2E_BASE_URL}/dashboard/admin`
- **Moderation Dashboard:** `{E2E_BASE_URL}/dashboard/moderation/organizations`
- **Database Explorer:** `{E2E_BASE_URL}/admin/db`

## Troubleshooting

### Cannot Connect to Production

If you get connection errors:

1. Verify the production URL is correct
2. Check if the site is accessible in a browser
3. Verify network connectivity
4. Check for firewall/VPN issues
5. Verify SSL certificate is valid

### Admin Login Fails

1. Verify credentials are correct
2. Check user has `platform_admin` or `platform_owner` role in database
3. Verify session cookies are being set
4. Check browser console for errors
5. Try clearing cookies and logging in again

### Tests Fail with 401 Unauthorized

1. Verify admin credentials are set correctly
2. Check that user role is `admin` in `app_profiles` table
3. Verify session cookies are being sent with requests
4. Check `withCredentials: true` is set in httpClient


