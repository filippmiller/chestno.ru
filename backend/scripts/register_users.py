#!/usr/bin/env python3
"""
Простой скрипт для регистрации тестовых пользователей через Supabase API
"""
import os
import sys
import httpx
from pathlib import Path

# Добавляем путь к корню проекта
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

# Загружаем переменные окружения
from dotenv import load_dotenv
load_dotenv(Path(__file__).parent.parent / '.env')

SUPABASE_URL = os.getenv('SUPABASE_URL')
SUPABASE_SERVICE_ROLE_KEY = os.getenv('SUPABASE_SERVICE_ROLE_KEY')

if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
    print("❌ Ошибка: SUPABASE_URL и SUPABASE_SERVICE_ROLE_KEY должны быть установлены")
    sys.exit(1)

AUTH_URL = f"{SUPABASE_URL.rstrip('/')}/auth/v1"
HEADERS = {
    'apikey': SUPABASE_SERVICE_ROLE_KEY,
    'Authorization': f'Bearer {SUPABASE_SERVICE_ROLE_KEY}',
    'Content-Type': 'application/json',
}

def get_user_by_email(email: str):
    """Находит пользователя по email"""
    response = httpx.get(f'{AUTH_URL}/admin/users', headers=HEADERS, params={'email': email}, timeout=30.0)
    if response.status_code == 200:
        users = response.json().get('users', [])
        if users:
            return users[0]['id']
    return None

def create_user(email: str, password: str, full_name: str = None):
    """Создает пользователя в Supabase"""
    # Сначала проверяем, существует ли пользователь
    existing_id = get_user_by_email(email)
    if existing_id:
        print(f"⚠️  Пользователь {email} уже существует (ID: {existing_id})")
        return existing_id
    
    payload = {
        'email': email,
        'password': password,
        'email_confirm': True,
    }
    if full_name:
        payload['user_metadata'] = {'full_name': full_name}
    
    response = httpx.post(f'{AUTH_URL}/admin/users', headers=HEADERS, json=payload, timeout=30.0)
    if response.status_code == 200:
        data = response.json()
        print(f"✅ Создан пользователь: {email} (ID: {data['id']})")
        return data['id']
    else:
        error = response.text
        print(f"❌ Ошибка создания пользователя {email}: {error}")
        return None

def add_admin_role(user_id: str):
    """Добавляет platform_admin роль через SQL"""
    import psycopg
    database_url = os.getenv('DATABASE_URL')
    if not database_url:
        print("❌ DATABASE_URL не установлен")
        return False
    
    try:
        with psycopg.connect(database_url) as conn:
            with conn.cursor() as cur:
                # Проверяем, есть ли уже роль
                cur.execute(
                    'SELECT 1 FROM platform_roles WHERE user_id = %s AND role = %s',
                    (user_id, 'platform_admin')
                )
                if cur.fetchone():
                    print(f"⚠️  Роль platform_admin уже есть у пользователя {user_id}")
                    return True
                
                # Добавляем роль
                cur.execute(
                    'INSERT INTO platform_roles (user_id, role) VALUES (%s, %s)',
                    (user_id, 'platform_admin')
                )
                conn.commit()
                print(f"✅ Добавлена platform_admin роль пользователю {user_id}")
                return True
    except Exception as e:
        print(f"❌ Ошибка добавления роли: {e}")
        return False

def complete_signup(auth_user_id: str, email: str, account_type: str, company_name: str = None):
    """Завершает регистрацию через after-signup API или напрямую в БД"""
    import psycopg
    database_url = os.getenv('DATABASE_URL')
    if not database_url:
        print("❌ DATABASE_URL не установлен")
        return False
    
    try:
        with psycopg.connect(database_url) as conn:
            with conn.cursor() as cur:
                # Проверяем, есть ли уже запись в app_users
                cur.execute('SELECT id FROM app_users WHERE id = %s', (auth_user_id,))
                if cur.fetchone():
                    print(f"⚠️  Пользователь {email} уже есть в app_users")
                    return True
                
                # Создаем запись в app_users
                contact_name = email.split('@')[0]
                cur.execute(
                    'INSERT INTO app_users (id, email, full_name) VALUES (%s, %s, %s)',
                    (auth_user_id, email, contact_name)
                )
                
                # Если производитель, создаем организацию
                if account_type == 'producer':
                    from psycopg.sql import SQL, Identifier
                    from python_slugify import slugify
                    
                    org_name = company_name or f"{contact_name} Production"
                    org_slug = slugify(org_name)
                    
                    cur.execute(
                        '''
                        INSERT INTO organizations (name, slug, country, city)
                        VALUES (%s, %s, 'Россия', 'Москва')
                        ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name
                        RETURNING id
                        ''',
                        (org_name, org_slug)
                    )
                    org_row = cur.fetchone()
                    if org_row:
                        org_id = org_row[0]
                        # Добавляем пользователя как owner
                        cur.execute(
                            '''
                            INSERT INTO organization_members (organization_id, user_id, role)
                            VALUES (%s, %s, 'owner')
                            ON CONFLICT (organization_id, user_id) DO NOTHING
                            ''',
                            (org_id, auth_user_id)
                        )
                        print(f"✅ Создана организация: {org_name}")
                
                conn.commit()
                print(f"✅ Завершена регистрация: {email}")
                return True
    except Exception as e:
        print(f"❌ Ошибка завершения регистрации {email}: {e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == '__main__':
    print("🚀 Регистрация тестовых пользователей...\n")
    
    # 1. Обычный пользователь
    print("1. Регистрация test@test.com...")
    test_user_id = create_user('test@test.com', 'test123456', 'Test User')
    if test_user_id:
        complete_signup(test_user_id, 'test@test.com', 'user')
    
    # 2. Производитель
    print("\n2. Регистрация manufacturer@test.com...")
    manufacturer_user_id = create_user('manufacturer@test.com', 'manufacturer123', 'Manufacturer User')
    if manufacturer_user_id:
        complete_signup(manufacturer_user_id, 'manufacturer@test.com', 'producer', 'Тестовый производитель')
    
    # 3. Админ
    print("\n3. Регистрация filippmiller@gmail.com...")
    admin_user_id = create_user('filippmiller@gmail.com', 'Airbus380+', 'Filipp Miller')
    if admin_user_id:
        complete_signup(admin_user_id, 'filippmiller@gmail.com', 'user')
        print("\n4. Добавление platform_admin роли filippmiller@gmail.com...")
        add_admin_role(admin_user_id)
    
    print("\n✅ Готово!")
    print("\n📋 Учетные данные:")
    print("  • test@test.com / test123456")
    print("  • manufacturer@test.com / manufacturer123")
    print("  • filippmiller@gmail.com / Airbus380+ (admin)")

