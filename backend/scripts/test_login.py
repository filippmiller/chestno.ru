#!/usr/bin/env python3
"""
Скрипт для проверки входа через Supabase Auth
"""
import os
import sys
from pathlib import Path
from dotenv import load_dotenv
import httpx

# Загружаем переменные окружения
load_dotenv(Path(__file__).parent.parent / '.env')

SUPABASE_URL = os.getenv('SUPABASE_URL')
SUPABASE_ANON_KEY = os.getenv('SUPABASE_ANON_KEY')

if not SUPABASE_URL or not SUPABASE_ANON_KEY:
    print("❌ Ошибка: SUPABASE_URL и SUPABASE_ANON_KEY должны быть установлены")
    sys.exit(1)

AUTH_URL = f"{SUPABASE_URL.rstrip('/')}/auth/v1"

email = 'filippmiller@gmail.com'
password = 'Airbus380+'

print(f"🔍 Попытка входа для {email}...")

# Пытаемся войти
response = httpx.post(
    f'{AUTH_URL}/token?grant_type=password',
    headers={
        'apikey': SUPABASE_ANON_KEY,
        'Content-Type': 'application/json',
    },
    json={
        'email': email,
        'password': password,
    },
    timeout=30.0
)

if response.status_code == 200:
    data = response.json()
    print("✅ Вход успешен!")
    print(f"📋 Access token: {data.get('access_token', '')[:50]}...")
    print(f"📋 User ID: {data.get('user', {}).get('id', 'N/A')}")
    print(f"📋 Email: {data.get('user', {}).get('email', 'N/A')}")
else:
    print(f"❌ Ошибка входа: {response.status_code}")
    print(f"   Ответ: {response.text}")

