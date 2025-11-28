#!/usr/bin/env python3
"""
Создание тестовых организаций для проверки модерации
"""
import os
import sys
from pathlib import Path
from dotenv import load_dotenv
import psycopg
from uuid import uuid4

# Загружаем переменные окружения
load_dotenv(Path(__file__).parent.parent / '.env')

DATABASE_URL = os.getenv('DATABASE_URL')
if not DATABASE_URL:
    print("❌ Ошибка: DATABASE_URL должен быть установлен")
    sys.exit(1)

test_organizations = [
    {
        'name': 'ООО "Русские Сладости"',
        'slug': 'russkie-sladosti',
        'country': 'Россия',
        'city': 'Москва',
        'website_url': 'https://russkie-sladosti.ru',
        'phone': '+7 (495) 123-45-67',
    },
    {
        'name': 'ИП Иванов "Домашний Хлеб"',
        'slug': 'domashniy-hleb',
        'country': 'Россия',
        'city': 'Санкт-Петербург',
        'website_url': 'https://domashniy-hleb.ru',
        'phone': '+7 (812) 234-56-78',
    },
    {
        'name': 'ООО "Сибирские Ягоды"',
        'slug': 'sibirskie-yagody',
        'country': 'Россия',
        'city': 'Новосибирск',
        'website_url': 'https://sibirskie-yagody.ru',
        'phone': '+7 (383) 345-67-89',
    },
]

print("🔍 Создание тестовых организаций...")

with psycopg.connect(DATABASE_URL) as conn:
    with conn.cursor() as cur:
        for org_data in test_organizations:
            # Проверяем, существует ли уже организация с таким slug
            cur.execute('SELECT id FROM organizations WHERE slug = %s', (org_data['slug'],))
            existing = cur.fetchone()
            
            if existing:
                print(f"⚠️  Организация {org_data['name']} уже существует (slug: {org_data['slug']})")
                continue
            
            # Создаем организацию со статусом pending
            cur.execute(
                '''
                INSERT INTO organizations (id, name, slug, country, city, website_url, phone, verification_status, public_visible)
                VALUES (gen_random_uuid(), %s, %s, %s, %s, %s, %s, 'pending', false)
                RETURNING id, name, verification_status
                ''',
                (
                    org_data['name'],
                    org_data['slug'],
                    org_data['country'],
                    org_data['city'],
                    org_data['website_url'],
                    org_data['phone'],
                ),
            )
            org = cur.fetchone()
            print(f"✅ Создана организация: {org[1]} (ID: {org[0]}, статус: {org[2]})")
        
        conn.commit()
        print("\n✅ Все организации созданы!")

