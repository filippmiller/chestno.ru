#!/usr/bin/env python3
"""
Проверка и исправление админ пользователя
"""
import os
import sys
from pathlib import Path
from dotenv import load_dotenv
import psycopg

# Загружаем переменные окружения
load_dotenv(Path(__file__).parent.parent / '.env')

DATABASE_URL = os.getenv('DATABASE_URL')
if not DATABASE_URL:
    print("❌ Ошибка: DATABASE_URL должен быть установлен")
    sys.exit(1)

email = 'filippmiller@gmail.com'

print(f"🔍 Проверка пользователя {email}...")

with psycopg.connect(DATABASE_URL) as conn:
    with conn.cursor() as cur:
        # Находим пользователя
        cur.execute(
            '''
            SELECT id, email FROM app_users WHERE email = %s
            ''',
            (email,),
        )
        user = cur.fetchone()
        if not user:
            print(f"❌ Пользователь {email} не найден в app_users")
            sys.exit(1)
        
        user_id = user[0]
        print(f"✅ Найден пользователь: {user_id} ({user[1]})")
        
        # Проверяем platform_roles
        cur.execute(
            '''
            SELECT role FROM platform_roles WHERE user_id = %s
            ''',
            (user_id,),
        )
        roles = cur.fetchall()
        print(f"📋 Platform roles: {[r[0] for r in roles]}")
        
        if not roles or 'platform_admin' not in [r[0] for r in roles]:
            print("⚠️  У пользователя нет роли platform_admin, добавляем...")
            cur.execute(
                '''
                INSERT INTO platform_roles (user_id, role)
                VALUES (%s, 'platform_admin')
                ON CONFLICT (user_id) DO UPDATE SET role = 'platform_admin'
                ''',
                (user_id,),
            )
            conn.commit()
            print("✅ Роль platform_admin добавлена")
        else:
            print("✅ Роль platform_admin уже есть")
        
        # Проверяем memberships
        cur.execute(
            '''
            SELECT om.id, om.organization_id, om.role, o.name
            FROM organization_members om
            JOIN organizations o ON o.id = om.organization_id
            WHERE om.user_id = %s
            ''',
            (user_id,),
        )
        memberships = cur.fetchall()
        print(f"\n📋 Memberships ({len(memberships)}):")
        for mem in memberships:
            print(f"  - {mem[3]} (ID: {mem[1]}, роль: {mem[2]})")
        
        if memberships:
            print("\n⚠️  Пользователь является членом организаций, но не должен быть!")
            print("Удаляем memberships...")
            for mem in memberships:
                cur.execute(
                    '''
                    DELETE FROM organization_members WHERE id = %s
                    ''',
                    (mem[0],),
                )
                print(f"  ✅ Удален membership для {mem[3]}")
            conn.commit()
            print("✅ Все memberships удалены")
        
        print("\n✅ Проверка завершена!")

