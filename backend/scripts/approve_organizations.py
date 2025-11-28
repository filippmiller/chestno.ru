#!/usr/bin/env python3
"""
Скрипт для одобрения организаций, ожидающих модерации
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

print("🔍 Поиск организаций, ожидающих модерации...")

# Подключаемся к базе данных
with psycopg.connect(DATABASE_URL) as conn:
    with conn.cursor() as cur:
        # Пытаемся найти пользователя filippmiller@gmail.com
        cur.execute(
            '''
            SELECT id FROM app_users WHERE email = %s
            ''',
            ('filippmiller@gmail.com',),
        )
        admin_user = cur.fetchone()
        admin_user_id = admin_user[0] if admin_user else None
        if admin_user_id:
            print(f"✅ Найден администратор: {admin_user_id}")
        else:
            print("⚠️  Пользователь filippmiller@gmail.com не найден, одобряем без verified_by")

        # Находим все организации и их статусы
        cur.execute(
            '''
            SELECT id, name, verification_status, public_visible, created_at
            FROM organizations
            ORDER BY created_at DESC
            LIMIT 20
            '''
        )
        all_orgs = cur.fetchall()
        
        print(f"\n📋 Всего организаций в базе: {len(all_orgs)}")
        for org in all_orgs:
            print(f"  - {org[1]} (ID: {org[0]}, статус: {org[2]}, публичная: {org[3]}, создана: {org[4]})")
        
        # Находим организации со статусом pending или непубличные
        cur.execute(
            '''
            SELECT id, name, verification_status, public_visible
            FROM organizations
            WHERE verification_status = 'pending' OR public_visible = false
            ORDER BY created_at DESC
            '''
        )
        orgs = cur.fetchall()
        
        if not orgs:
            print("\n✅ Нет организаций, ожидающих модерации")
            # Проверяем, есть ли организации, которые нужно сделать публичными
            cur.execute(
                '''
                SELECT id, name, verification_status, public_visible
                FROM organizations
                WHERE public_visible = false
                ORDER BY created_at DESC
                '''
            )
            non_public = cur.fetchall()
            if non_public:
                print(f"\n📋 Найдено непубличных организаций: {len(non_public)}")
                for org in non_public:
                    print(f"  - {org[1]} (ID: {org[0]}, статус: {org[2]}, публичная: {org[3]})")
                orgs = non_public
            else:
                sys.exit(0)
        
        print(f"\n📋 Найдено организаций: {len(orgs)}")
        for org in orgs:
            print(f"  - {org[1]} (ID: {org[0]}, статус: {org[2]}, публичная: {org[3]})")
        
        # Одобряем все организации
        print("\n✅ Одобряем организации...")
        for org in orgs:
            if admin_user_id:
                cur.execute(
                    '''
                    UPDATE organizations
                    SET verification_status = 'verified',
                        is_verified = true,
                        public_visible = true,
                        verified_at = now(),
                        verified_by = %s
                    WHERE id = %s
                    RETURNING id, name, verification_status
                    ''',
                    (admin_user_id, org[0]),
                )
            else:
                cur.execute(
                    '''
                    UPDATE organizations
                    SET verification_status = 'verified',
                        is_verified = true,
                        public_visible = true,
                        verified_at = now()
                    WHERE id = %s
                    RETURNING id, name, verification_status
                    ''',
                    (org[0],),
                )
            updated = cur.fetchone()
            if updated:
                print(f"  ✅ Одобрена: {updated[1]} (ID: {updated[0]})")
            else:
                print(f"  ❌ Не удалось одобрить: {org[1]}")
        
        conn.commit()
        print("\n✅ Все организации одобрены!")

