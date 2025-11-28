#!/usr/bin/env python3
"""
Скрипт для проверки подключения к базе данных
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

print("🔍 Проверка подключения к базе данных...")
print(f"📋 DATABASE_URL: {DATABASE_URL[:50]}...")  # Показываем только начало URL

try:
    with psycopg.connect(DATABASE_URL) as conn:
        print("✅ Подключение успешно!")
        
        with conn.cursor() as cur:
            # Проверяем версию PostgreSQL
            cur.execute("SELECT version();")
            version = cur.fetchone()[0]
            print(f"📋 Версия PostgreSQL: {version[:80]}...")
            
            # Проверяем количество организаций
            cur.execute("SELECT COUNT(*) FROM organizations;")
            org_count = cur.fetchone()[0]
            print(f"📋 Количество организаций: {org_count}")
            
            # Проверяем конкретную организацию
            cur.execute(
                '''
                SELECT id, name, verification_status, public_visible
                FROM organizations
                WHERE id = %s
                ''',
                ('31df86da-a3ca-4261-a159-39d7bbc7423e',),
            )
            org = cur.fetchone()
            if org:
                print(f"✅ Организация найдена: {org[1]}")
                print(f"   - ID: {org[0]}")
                print(f"   - Статус верификации: {org[2]}")
                print(f"   - Публичная: {org[3]}")
            else:
                print("❌ Организация не найдена")
            
            # Проверяем структуру таблицы organization_profiles
            print("\n🔍 Проверяем структуру таблицы organization_profiles...")
            cur.execute(
                '''
                SELECT column_name, data_type
                FROM information_schema.columns
                WHERE table_name = 'organization_profiles'
                ORDER BY ordinal_position
                '''
            )
            columns = cur.fetchall()
            print(f"📋 Колонки в organization_profiles ({len(columns)}):")
            for col in columns:
                print(f"   - {col[0]} ({col[1]})")
            
            # Проверяем, есть ли профиль организации
            cur.execute(
                '''
                SELECT p.id, p.organization_id, p.short_description
                FROM organization_profiles p
                WHERE p.organization_id = %s
                ''',
                ('31df86da-a3ca-4261-a159-39d7bbc7423e',),
            )
            profile = cur.fetchone()
            if profile:
                print(f"✅ Профиль организации найден")
                print(f"   - ID профиля: {profile[0]}")
            else:
                print("⚠️  Профиль организации не найден")
            
            # Проверяем запрос, который используется в get_public_organization_details_by_id
            print("\n🔍 Тестируем запрос из get_public_organization_details_by_id...")
            # Сначала проверим, какие колонки есть в organization_profiles
            cur.execute(
                '''
                SELECT column_name
                FROM information_schema.columns
                WHERE table_name = 'organization_profiles'
                  AND column_name IN ('category', 'primary_category')
                '''
            )
            category_cols = [row[0] for row in cur.fetchall()]
            print(f"📋 Колонки категории в organization_profiles: {category_cols}")
            
            # Используем только существующие колонки
            category_select = "NULL as category"  # По умолчанию NULL
            if category_cols:
                category_select = f"p.{category_cols[0]} as category"
            
            cur.execute(
                f'''
                SELECT o.id, o.name, o.slug, o.country, o.city, o.website_url, o.is_verified,
                       o.verification_status, o.tags,
                       p.short_description, p.long_description, p.production_description,
                       p.safety_and_quality, p.video_url, p.gallery, {category_select}, p.founded_year,
                       p.employee_count, p.factory_size, p.certifications, p.sustainability_practices,
                       p.quality_standards, p.buy_links,
                       p.contact_email, p.contact_phone, p.contact_website, p.contact_address,
                       p.contact_telegram, p.contact_whatsapp, p.social_links
                FROM organizations o
                LEFT JOIN organization_profiles p ON p.organization_id = o.id
                WHERE o.id = %s
                  AND o.public_visible = true
                ''',
                ('31df86da-a3ca-4261-a159-39d7bbc7423e',),
            )
            result = cur.fetchone()
            if result:
                print("✅ Запрос выполнен успешно!")
                print(f"   - Название: {result[1]}")
                print(f"   - Slug: {result[2]}")
                print(f"   - Страна: {result[3]}")
                print(f"   - Город: {result[4]}")
                print(f"   - Верифицирована: {result[6]}")
                print(f"   - Статус верификации: {result[7]}")
                print(f"   - Публичная: True")
                # Проверяем проблемные поля
                print(f"   - Gallery: {type(result[14])} - {result[14]}")
                print(f"   - Social links: {type(result[28])} - {result[28]}")
            else:
                print("❌ Запрос не вернул результатов")
                
except psycopg.Error as e:
    print(f"❌ Ошибка подключения к базе данных: {e}")
    sys.exit(1)
except Exception as e:
    print(f"❌ Неожиданная ошибка: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)

print("\n✅ Проверка завершена!")

