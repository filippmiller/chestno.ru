#!/usr/bin/env python3
"""
Скрипт для проверки и создания администратора
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

if not DATABASE_URL:
    print("❌ Ошибка: DATABASE_URL должен быть установлен")
    sys.exit(1)

if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
    print("❌ Ошибка: SUPABASE_URL и SUPABASE_SERVICE_ROLE_KEY должны быть установлены")
    sys.exit(1)

AUTH_URL = f"{SUPABASE_URL.rstrip('/')}/auth/v1"
HEADERS = {
    'apikey': SUPABASE_SERVICE_ROLE_KEY,
    'Authorization': f'Bearer {SUPABASE_SERVICE_ROLE_KEY}',
    'Content-Type': 'application/json',
}

email = 'filippmiller@gmail.com'
password = 'Airbus380+'
full_name = 'Филипп Миллер'

print(f"🔍 Проверка пользователя {email}...")

# Проверяем в базе данных
with psycopg.connect(DATABASE_URL) as conn:
    with conn.cursor() as cur:
        cur.execute(
            '''
            SELECT id, email, full_name
            FROM app_users
            WHERE email = %s
            ''',
            (email,),
        )
        user = cur.fetchone()
        
        if user:
            print(f"✅ Пользователь найден в app_users:")
            print(f"   - ID: {user[0]}")
            print(f"   - Email: {user[1]}")
            print(f"   - Имя: {user[2]}")
            
            # Проверяем роли
            cur.execute(
                '''
                SELECT role
                FROM platform_roles
                WHERE user_id = %s
                ''',
                (user[0],),
            )
            roles = [row[0] for row in cur.fetchall()]
            if roles:
                print(f"   - Роли: {', '.join(roles)}")
            else:
                print(f"   ⚠️  Роли не найдены, добавляем platform_admin...")
                cur.execute(
                    '''
                    INSERT INTO platform_roles (user_id, role)
                    VALUES (%s, 'platform_admin')
                    ON CONFLICT (user_id) DO UPDATE SET role = 'platform_admin'
                    ''',
                    (user[0],),
                )
                conn.commit()
                print(f"   ✅ Роль platform_admin добавлена")
        else:
            print(f"❌ Пользователь не найден в app_users")
            print(f"🔍 Проверяем в Supabase Auth...")
            
            # Проверяем в Supabase Auth
            response = httpx.get(
                f'{AUTH_URL}/admin/users',
                headers=HEADERS,
                params={'email': email},
                timeout=30.0
            )
            
            if response.status_code == 200:
                users = response.json().get('users', [])
                if users:
                    auth_user_id = users[0]['id']
                    print(f"✅ Пользователь найден в Supabase Auth (ID: {auth_user_id})")
                    
                    # Создаем запись в app_users
                    cur.execute(
                        '''
                        INSERT INTO app_users (id, email, full_name)
                        VALUES (%s, %s, %s)
                        ON CONFLICT (id) DO UPDATE SET
                            email = EXCLUDED.email,
                            full_name = COALESCE(EXCLUDED.full_name, app_users.full_name)
                        RETURNING id
                        ''',
                        (auth_user_id, email, full_name),
                    )
                    app_user_id = cur.fetchone()[0]
                    conn.commit()
                    print(f"✅ Пользователь добавлен в app_users (ID: {app_user_id})")
                    
                    # Добавляем роль
                    cur.execute(
                        '''
                        INSERT INTO platform_roles (user_id, role)
                        VALUES (%s, 'platform_admin')
                        ON CONFLICT (user_id) DO UPDATE SET role = 'platform_admin'
                        ''',
                        (app_user_id,),
                    )
                    conn.commit()
                    print(f"✅ Роль platform_admin добавлена")
                else:
                    print(f"❌ Пользователь не найден в Supabase Auth")
                    print(f"🔧 Создаем пользователя в Supabase Auth...")
                    
                    # Создаем пользователя в Supabase Auth
                    payload = {
                        'email': email,
                        'password': password,
                        'email_confirm': True,
                        'user_metadata': {
                            'full_name': full_name
                        }
                    }
                    
                    response = httpx.post(
                        f'{AUTH_URL}/admin/users',
                        headers=HEADERS,
                        json=payload,
                        timeout=30.0
                    )
                    
                    if response.status_code == 200:
                        new_user = response.json()
                        auth_user_id = new_user['id']
                        print(f"✅ Пользователь создан в Supabase Auth (ID: {auth_user_id})")
                        
                        # Создаем запись в app_users
                        cur.execute(
                            '''
                            INSERT INTO app_users (id, email, full_name)
                            VALUES (%s, %s, %s)
                            RETURNING id
                            ''',
                            (auth_user_id, email, full_name),
                        )
                        app_user_id = cur.fetchone()[0]
                        conn.commit()
                        print(f"✅ Пользователь добавлен в app_users (ID: {app_user_id})")
                        
                        # Добавляем роль
                        cur.execute(
                            '''
                            INSERT INTO platform_roles (user_id, role)
                            VALUES (%s, 'platform_admin')
                            ''',
                            (app_user_id,),
                        )
                        conn.commit()
                        print(f"✅ Роль platform_admin добавлена")
                    else:
                        print(f"❌ Ошибка создания пользователя: {response.status_code}")
                        print(f"   Ответ: {response.text}")
                        sys.exit(1)

print("\n✅ Проверка завершена!")

