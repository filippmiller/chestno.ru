#!/usr/bin/env python3
"""
Скрипт для создания тестовых организаций и пользователей для тестирования отзывов
"""
import os
import sys
import httpx
from pathlib import Path
from dotenv import load_dotenv
import psycopg
from psycopg.rows import dict_row
def slugify(text: str) -> str:
    """Simple slugify function"""
    import re
    import unicodedata
    # Normalize unicode
    text = unicodedata.normalize('NFKD', text)
    # Convert to lowercase
    text = text.lower()
    # Remove non-alphanumeric characters except spaces and hyphens
    text = re.sub(r'[^\w\s-]', '', text)
    # Replace spaces and multiple hyphens with single hyphen
    text = re.sub(r'[-\s]+', '-', text)
    # Remove leading/trailing hyphens
    return text.strip('-')

# Добавляем путь к корню проекта
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

# Загружаем переменные окружения
load_dotenv(Path(__file__).parent.parent / '.env')

SUPABASE_URL = os.getenv('SUPABASE_URL')
SUPABASE_SERVICE_ROLE_KEY = os.getenv('SUPABASE_SERVICE_ROLE_KEY')
DATABASE_URL = os.getenv('DATABASE_URL')
BACKEND_URL = os.getenv('VITE_BACKEND_URL', 'http://localhost:8000')

if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
    print("❌ Ошибка: SUPABASE_URL и SUPABASE_SERVICE_ROLE_KEY должны быть установлены")
    sys.exit(1)

if not DATABASE_URL:
    print("❌ Ошибка: DATABASE_URL должен быть установлен")
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

def complete_signup(auth_user_id: str, email: str, account_type: str = 'user', company_name: str = None):
    """Завершает регистрацию в БД"""
    try:
        with psycopg.connect(DATABASE_URL) as conn:
            with conn.cursor(row_factory=dict_row) as cur:
                # Проверяем, есть ли уже запись в app_users
                cur.execute('SELECT id FROM app_users WHERE id = %s', (auth_user_id,))
                if cur.fetchone():
                    print(f"⚠️  Пользователь {email} уже есть в app_users")
                else:
                    # Создаем запись в app_users
                    contact_name = email.split('@')[0].replace('.', ' ').title()
                    cur.execute(
                        'INSERT INTO app_users (id, email, full_name) VALUES (%s, %s, %s)',
                        (auth_user_id, email, contact_name)
                    )
                    print(f"✅ Создан профиль пользователя: {email}")
                
                # Если производитель, создаем организацию
                if account_type == 'producer':
                    org_name = company_name or f"{contact_name} Production"
                    org_slug = slugify(org_name)
                    
                    # Проверяем, существует ли уже организация с таким slug
                    cur.execute('SELECT id FROM organizations WHERE slug = %s', (org_slug,))
                    existing_org = cur.fetchone()
                    
                    if existing_org:
                        org_id = existing_org['id']
                        print(f"⚠️  Организация {org_name} уже существует (ID: {org_id})")
                        # Обновляем статус на verified и public_visible
                        cur.execute(
                            '''
                            UPDATE organizations 
                            SET verification_status = 'verified', is_verified = true, public_visible = true
                            WHERE id = %s
                            ''',
                            (org_id,)
                        )
                    else:
                        cur.execute(
                            '''
                            INSERT INTO organizations (name, slug, country, city, verification_status, is_verified, public_visible)
                            VALUES (%s, %s, 'Россия', 'Москва', 'verified', true, true)
                            RETURNING id
                            ''',
                            (org_name, org_slug)
                        )
                        org_row = cur.fetchone()
                        if org_row:
                            org_id = org_row['id']
                            print(f"✅ Создана организация: {org_name} (ID: {org_id}, slug: {org_slug})")
                    
                    # Добавляем пользователя как owner
                    cur.execute(
                        '''
                        INSERT INTO organization_members (organization_id, user_id, role)
                        VALUES (%s, %s, 'owner')
                        ON CONFLICT (organization_id, user_id) DO NOTHING
                        ''',
                        (org_id, auth_user_id)
                    )
                
                conn.commit()
                return True
    except Exception as e:
        print(f"❌ Ошибка завершения регистрации {email}: {e}")
        import traceback
        traceback.print_exc()
        return False

def create_organization_directly(name: str, slug: str, city: str = 'Москва', country: str = 'Россия'):
    """Создает организацию напрямую в БД"""
    try:
        with psycopg.connect(DATABASE_URL) as conn:
            with conn.cursor(row_factory=dict_row) as cur:
                # Проверяем, существует ли уже
                cur.execute('SELECT id, slug FROM organizations WHERE slug = %s', (slug,))
                existing = cur.fetchone()
                if existing:
                    print(f"⚠️  Организация {name} уже существует (ID: {existing['id']}, slug: {existing['slug']})")
                    return existing['id']
                
                cur.execute(
                    '''
                    INSERT INTO organizations (name, slug, country, city, verification_status)
                    VALUES (%s, %s, %s, %s, 'verified')
                    RETURNING id, slug
                    ''',
                    (name, slug, country, city)
                )
                org = cur.fetchone()
                conn.commit()
                print(f"✅ Создана организация: {name} (ID: {org['id']}, slug: {org['slug']})")
                return org['id']
    except Exception as e:
        print(f"❌ Ошибка создания организации {name}: {e}")
        import traceback
        traceback.print_exc()
        return None

def main():
    print("🚀 Создание тестовых организаций и пользователей...\n")
    
    # 1. Создаем тестовые организации напрямую в БД
    print("=" * 60)
    print("1. СОЗДАНИЕ ТЕСТОВЫХ ОРГАНИЗАЦИЙ")
    print("=" * 60)
    
    businesses = [
        {'name': 'Мастерская «Северный Фарфор»', 'city': 'Архангельск'},
        {'name': 'Сыроварня «Три коровы»', 'city': 'Тверь'},
        {'name': 'Ателье «Русский лён»', 'city': 'Кострома'},
        {'name': 'Мастерская «Деревянная сказка»', 'city': 'Вологда'},
        {'name': 'Тульский самовар', 'city': 'Тула'},
    ]
    
    org_slugs = {}
    for business in businesses:
        slug = slugify(business['name'])
        org_id = create_organization_directly(business['name'], slug, business['city'])
        if org_id:
            org_slugs[business['name']] = {'id': str(org_id), 'slug': slug, 'city': business['city']}
    
    print("\n" + "=" * 60)
    print("2. СОЗДАНИЕ ТЕСТОВЫХ ПОЛЬЗОВАТЕЛЕЙ")
    print("=" * 60)
    
    # 2. Создаем тестового пользователя для отзывов
    print("\n2.1. Регистрация reviewer@test.com (для оставления отзывов)...")
    reviewer_user_id = create_user('reviewer@test.com', 'reviewer123', 'Reviewer User')
    if reviewer_user_id:
        complete_signup(reviewer_user_id, 'reviewer@test.com', 'user')
    
    # 3. Создаем производителей для организаций
    print("\n2.2. Создание производителей для организаций...")
    producer_emails = [
        ('producer1@test.com', 'Мастерская «Северный Фарфор»'),
        ('producer2@test.com', 'Сыроварня «Три коровы»'),
        ('producer3@test.com', 'Ателье «Русский лён»'),
    ]
    
    for email, org_name in producer_emails:
        print(f"\n   Регистрация {email} для {org_name}...")
        producer_id = create_user(email, 'producer123', org_name.split('«')[1].split('»')[0] if '«' in org_name else org_name)
        if producer_id:
            complete_signup(producer_id, email, 'producer', org_name)
    
    print("\n" + "=" * 60)
    print("✅ ГОТОВО!")
    print("=" * 60)
    print("\n📋 Созданные организации (для просмотра на сайте):")
    for name, info in org_slugs.items():
        print(f"  • {name}")
        print(f"    URL: /org/{info['slug']}")
        print(f"    Город: {info['city']}")
    
    print("\n📋 Учетные данные для тестирования:")
    print("  • reviewer@test.com / reviewer123 (для оставления отзывов)")
    print("  • producer1@test.com / producer123 (владелец Мастерская «Северный Фарфор»)")
    print("  • producer2@test.com / producer123 (владелец Сыроварня «Три коровы»)")
    print("  • producer3@test.com / producer123 (владелец Ателье «Русский лён»)")
    
    print("\n🔗 Пример URL для тестирования:")
    if org_slugs:
        first_slug = list(org_slugs.values())[0]['slug']
        print(f"  http://localhost:5173/org/{first_slug}")

if __name__ == '__main__':
    main()

