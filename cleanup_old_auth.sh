#!/bin/bash
# Cleanup script for old authentication files
# Run this AFTER confirming the new auth system works

echo "🧹 Cleaning up old authentication files..."
echo ""

# Frontend cleanup
echo "📁 Frontend:"
echo "  Deleting old Login page..."
rm -f frontend/src/pages/Login.tsx

echo "  Deleting old Register page..."
rm -f frontend/src/pages/Register.tsx

echo "  Deleting old AuthCallback page..."
rm -f frontend/src/pages/AuthCallback.tsx

echo "  Deleting old authService..."
rm -f frontend/src/api/authService.ts

echo "  Deleting old userStore..."
rm -f frontend/src/store/userStore.ts

echo ""

# Backend cleanup
echo "📁 Backend:"
echo "  Deleting old auth router..."
rm -f backend/app/api/routes/auth.py

echo ""
echo "✅ Cleanup complete!"
echo ""
echo "Note: get_session_data in accounts.py is still used by the new system."
echo "      You may want to remove password_sign_in from supabase.py manually."
