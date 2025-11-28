#!/usr/bin/env python3
"""
Создание бизнес-пользователя для тестирования QR-кодов (простая версия через SQL)
"""
import os
import sys
from pathlib import Path
from dotenv import load_dotenv
import psycopg
import httpx

# Загружаем переменные окружения
load_dotenv(Path(__file__).parent.parent / '.env')

DATABASE_URL = os.getenv('DATABASE_URL')
SUPABASE_URL = os.getenv('SUPABASE_URL')
SUPABASE_SERVICE_ROLE_KEY = os.getenv('SUPABASE_SERVICE_ROLE_KEY')

if not DATABASE_URL or not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
    print("❌ Ошибка: DATABASE_URL, SUPABASE_URL и SUPABASE_SERVICE_ROLE_KEY должны быть установлены")
    sys.exit(1)

email = 'business@test.com'
password = 'business123'
company_name = 'Тестовый Бизнес'
country = 'Россия'
city = 'Москва'

print(f"🔍 Создание бизнес-пользователя {email}...")

# Создаем пользователя в Supabase
AUTH_URL = f"{SUPABASE_URL.rstrip('/')}/auth/v1"
HEADERS = {
    'apikey': SUPABASE_SERVICE_ROLE_KEY,
    'Authorization': f'Bearer {SUPABASE_SERVICE_ROLE_KEY}',
    'Content-Type': 'application/json',
}

try:
    # Проверяем, существует ли пользователь
    response = httpx.get(f'{AUTH_URL}/admin/users', headers=HEADERS, params={'email': email}, timeout=30.0)
    existing_user = None
    if response.status_code == 200:
        users = response.json().get('users', [])
        if users:
            existing_user = users[0]
    
    if existing_user:
        print(f"⚠️  Пользователь {email} уже существует (ID: {existing_user['id']})")
        user_id = existing_user['id']
    else:
        # Создаем пользователя
        payload = {
            'email': email,
            'password': password,
            'email_confirm': True,
            'user_metadata': {'full_name': 'Business Owner'}
        }
        response = httpx.post(f'{AUTH_URL}/admin/users', headers=HEADERS, json=payload, timeout=30.0)
        if response.status_code != 200:
            print(f"❌ Ошибка создания пользователя: {response.text}")
            sys.exit(1)
        user_id = response.json()['id']
        print(f"✅ Создан пользователь в Supabase: {email} (ID: {user_id})")
    
    # Создаем запись в app_users и организацию
    with psycopg.connect(DATABASE_URL) as conn:
        with conn.cursor() as cur:
            # Проверяем, есть ли запись в app_users
            cur.execute('SELECT id FROM app_users WHERE id = %s', (user_id,))
            if not cur.fetchone():
                cur.execute(
                    '''
                    INSERT INTO app_users (id, email, full_name)
                    VALUES (%s, %s, %s)
                    ''',
                    (user_id, email, 'Business Owner'),
                )
                print(f"✅ Создана запись в app_users")
            
            # Создаем организацию
            from slugify import slugify
            slug = slugify(company_name, lowercase=True)
            cur.execute('SELECT id FROM organizations WHERE slug = %s', (slug,))
            existing_org = cur.fetchone()
            
            if existing_org:
                org_id = existing_org[0]
                print(f"⚠️  Организация {company_name} уже существует (ID: {org_id})")
            else:
                cur.execute(
                    '''
                    INSERT INTO organizations (id, name, slug, country, city, website_url, phone, verification_status, public_visible)
                    VALUES (gen_random_uuid(), %s, %s, %s, %s, %s, %s, 'verified', true)
                    RETURNING id
                    ''',
                    (company_name, slug, country, city, 'https://test-business.ru', '+7 (495) 111-22-33'),
                )
                org_id = cur.fetchone()[0]
                print(f"✅ Создана организация: {company_name} (ID: {org_id})")
            
            # Создаем membership
            cur.execute(
                '''
                SELECT id FROM organization_members 
                WHERE organization_id = %s AND user_id = %s
                ''',
                (org_id, user_id),
            )
            if not cur.fetchone():
                cur.execute(
                    '''
                    INSERT INTO organization_members (id, organization_id, user_id, role)
                    VALUES (gen_random_uuid(), %s, %s, 'owner')
                    ''',
                    (org_id, user_id),
                )
                print(f"✅ Создан membership (owner)")
            
            conn.commit()
    
    print(f"\n📋 Учетные данные:")
    print(f"  Email: {email}")
    print(f"  Пароль: {password}")
    print(f"  Организация: {company_name}")
    print(f"  Organization ID: {org_id}")
    print("\n✅ Готово!")
    
except Exception as e:
    print(f"❌ Ошибка: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)

