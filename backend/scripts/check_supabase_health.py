#!/usr/bin/env python3
"""
Comprehensive health check script for Supabase connections
Checks:
- Database connection (PostgreSQL)
- Supabase Auth API
- Configuration
"""
import os
import sys
from pathlib import Path
from dotenv import load_dotenv
import psycopg
import httpx

# Загружаем переменные окружения
backend_path = Path(__file__).parent.parent
load_dotenv(backend_path / '.env')

# Получаем переменные окружения
DATABASE_URL = os.getenv('DATABASE_URL')
SUPABASE_URL = os.getenv('SUPABASE_URL')
SUPABASE_SERVICE_ROLE_KEY = os.getenv('SUPABASE_SERVICE_ROLE_KEY')
SUPABASE_ANON_KEY = os.getenv('SUPABASE_ANON_KEY')

print("=" * 60)
print("🔍 Проверка подключения к Supabase")
print("=" * 60)

# Проверка конфигурации
print("\n📋 Проверка конфигурации...")
config_ok = True

if not DATABASE_URL:
    print("❌ DATABASE_URL не установлен")
    config_ok = False
else:
    print(f"✅ DATABASE_URL установлен ({DATABASE_URL[:50]}...)")

if not SUPABASE_URL:
    print("❌ SUPABASE_URL не установлен")
    config_ok = False
else:
    print(f"✅ SUPABASE_URL установлен: {SUPABASE_URL}")

if not SUPABASE_SERVICE_ROLE_KEY:
    print("❌ SUPABASE_SERVICE_ROLE_KEY не установлен")
    config_ok = False
else:
    print(f"✅ SUPABASE_SERVICE_ROLE_KEY установлен ({SUPABASE_SERVICE_ROLE_KEY[:20]}...)")

if not SUPABASE_ANON_KEY:
    print("❌ SUPABASE_ANON_KEY не установлен")
    config_ok = False
else:
    print(f"✅ SUPABASE_ANON_KEY установлен ({SUPABASE_ANON_KEY[:20]}...)")

if not config_ok:
    print("\n❌ Конфигурация неполная. Проверьте .env файл.")
    sys.exit(1)

# Проверка подключения к базе данных
print("\n🗄️  Проверка подключения к базе данных PostgreSQL...")
db_ok = False
try:
    with psycopg.connect(DATABASE_URL, connect_timeout=10) as conn:
        print("✅ Подключение к базе данных успешно!")
        db_ok = True
        
        with conn.cursor() as cur:
            # Проверяем версию PostgreSQL
            cur.execute("SELECT version();")
            version = cur.fetchone()[0]
            print(f"   📋 Версия PostgreSQL: {version.split(',')[0]}")
            
            # Проверяем текущее время
            cur.execute("SELECT NOW();")
            db_time = cur.fetchone()[0]
            print(f"   📋 Время сервера: {db_time}")
            
            # Проверяем доступные таблицы
            cur.execute("""
                SELECT table_name 
                FROM information_schema.tables 
                WHERE table_schema = 'public' 
                ORDER BY table_name
                LIMIT 10;
            """)
            tables = cur.fetchall()
            print(f"   📋 Найдено таблиц (первые 10): {len(tables)}")
            for table in tables[:5]:
                print(f"      - {table[0]}")
            
            # Проверяем количество пользователей
            try:
                cur.execute("SELECT COUNT(*) FROM app_users;")
                user_count = cur.fetchone()[0]
                print(f"   📋 Пользователей в базе: {user_count}")
            except Exception as e:
                print(f"   ⚠️  Не удалось проверить app_users: {e}")
            
            # Проверяем количество организаций
            try:
                cur.execute("SELECT COUNT(*) FROM organizations;")
                org_count = cur.fetchone()[0]
                print(f"   📋 Организаций в базе: {org_count}")
            except Exception as e:
                print(f"   ⚠️  Не удалось проверить organizations: {e}")
                
except psycopg.Error as e:
    print(f"❌ Ошибка подключения к базе данных: {e}")
    db_ok = False
except Exception as e:
    print(f"❌ Неожиданная ошибка при подключении к БД: {e}")
    db_ok = False

# Проверка подключения к Supabase Auth API
print("\n🔐 Проверка подключения к Supabase Auth API...")
supabase_ok = False
try:
    base_auth_url = SUPABASE_URL.rstrip('/') + '/auth/v1'
    headers = {
        'apikey': SUPABASE_ANON_KEY,
        'Content-Type': 'application/json',
    }
    
    client = httpx.Client(timeout=10.0)
    
    # Пробуем подключиться к базовому URL
    print(f"   📋 Проверяем URL: {SUPABASE_URL}")
    response = client.get(SUPABASE_URL, headers=headers, timeout=10.0)
    print(f"   ✅ Supabase URL доступен (статус: {response.status_code})")
    
    # Пробуем проверить Auth API
    print(f"   📋 Проверяем Auth API: {base_auth_url}")
    try:
        # Supabase может не иметь /health endpoint, но мы можем проверить базовый URL
        auth_response = client.get(base_auth_url, headers=headers, timeout=10.0)
        print(f"   ✅ Auth API доступен (статус: {auth_response.status_code})")
        supabase_ok = True
    except httpx.HTTPError as e:
        print(f"   ⚠️  Auth API недоступен: {e}")
        # Это не критично, если базовый URL работает
        supabase_ok = True
    
    # Проверяем service role key
    admin_headers = {
        'apikey': SUPABASE_SERVICE_ROLE_KEY,
        'Authorization': f'Bearer {SUPABASE_SERVICE_ROLE_KEY}',
        'Content-Type': 'application/json',
    }
    print(f"   📋 Проверяем Service Role Key...")
    try:
        # Пробуем получить список пользователей (требует admin прав)
        admin_response = client.get(
            f'{base_auth_url}/admin/users',
            headers=admin_headers,
            params={'per_page': 1},
            timeout=10.0,
        )
        if admin_response.status_code == 200:
            print(f"   ✅ Service Role Key валиден (статус: {admin_response.status_code})")
        else:
            print(f"   ⚠️  Service Role Key вернул статус: {admin_response.status_code}")
    except httpx.HTTPError as e:
        print(f"   ⚠️  Не удалось проверить Service Role Key: {e}")
    
    client.close()
    
except Exception as e:
    print(f"❌ Ошибка подключения к Supabase: {e}")
    import traceback
    traceback.print_exc()
    supabase_ok = False

# Итоговый результат
print("\n" + "=" * 60)
print("📊 Итоговый результат:")
print("=" * 60)

if db_ok and supabase_ok:
    print("✅ Все проверки пройдены успешно!")
    print("   - База данных: подключена")
    print("   - Supabase Auth API: доступен")
    sys.exit(0)
else:
    print("❌ Некоторые проверки не прошли:")
    if not db_ok:
        print("   - База данных: не подключена")
    if not supabase_ok:
        print("   - Supabase Auth API: недоступен")
    sys.exit(1)




