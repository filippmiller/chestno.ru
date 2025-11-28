#!/usr/bin/env python3
"""
Скрипт для создания тестовых организаций в PRODUCTION БД
Использует DATABASE_URL из переменных окружения (должен быть production)
"""
import os
import sys
from pathlib import Path
from dotenv import load_dotenv
import psycopg
from psycopg.rows import dict_row

def slugify(text: str) -> str:
    """Simple slugify function"""
    import re
    import unicodedata
    text = unicodedata.normalize('NFKD', text)
    text = text.lower()
    text = re.sub(r'[^\w\s-]', '', text)
    text = re.sub(r'[-\s]+', '-', text)
    return text.strip('-')

# Загружаем переменные окружения
# ВАЖНО: Убедитесь, что DATABASE_URL указывает на PRODUCTION БД
load_dotenv(Path(__file__).parent.parent / '.env')

DATABASE_URL = os.getenv('DATABASE_URL')
if not DATABASE_URL:
    print("❌ DATABASE_URL не установлен")
    print("⚠️  Убедитесь, что вы используете PRODUCTION DATABASE_URL!")
    sys.exit(1)

print("🚀 Создание тестовых организаций в PRODUCTION БД...")
print(f"📡 DATABASE_URL: {DATABASE_URL[:50]}...")
print("⚠️  ВНИМАНИЕ: Это PRODUCTION база данных!\n")

businesses = [
    {'name': 'Мастерская «Северный Фарфор»', 'city': 'Архангельск'},
    {'name': 'Сыроварня «Три коровы»', 'city': 'Тверь'},
    {'name': 'Ателье «Русский лён»', 'city': 'Кострома'},
    {'name': 'Мастерская «Деревянная сказка»', 'city': 'Вологда'},
    {'name': 'Тульский самовар', 'city': 'Тула'},
]

try:
    with psycopg.connect(DATABASE_URL) as conn:
        with conn.cursor(row_factory=dict_row) as cur:
            org_slugs = {}
            
            for business in businesses:
                slug = slugify(business['name'])
                
                # Проверяем, существует ли уже
                cur.execute('SELECT id, slug FROM organizations WHERE slug = %s', (slug,))
                existing = cur.fetchone()
                
                if existing:
                    # Обновляем статус
                    cur.execute(
                        '''
                        UPDATE organizations 
                        SET verification_status = 'verified', 
                            is_verified = true, 
                            public_visible = true,
                            name = %s,
                            city = %s
                        WHERE id = %s
                        RETURNING id, slug
                        ''',
                        (business['name'], business['city'], existing['id'])
                    )
                    org = cur.fetchone()
                    print(f"✅ Обновлена организация: {business['name']} (slug: {org['slug']})")
                    org_slugs[business['name']] = {'id': str(org['id']), 'slug': org['slug'], 'city': business['city']}
                else:
                    # Создаем новую
                    cur.execute(
                        '''
                        INSERT INTO organizations (name, slug, country, city, verification_status, is_verified, public_visible)
                        VALUES (%s, %s, 'Россия', %s, 'verified', true, true)
                        RETURNING id, slug
                        ''',
                        (business['name'], slug, business['city'])
                    )
                    org = cur.fetchone()
                    print(f"✅ Создана организация: {business['name']} (slug: {org['slug']})")
                    org_slugs[business['name']] = {'id': str(org['id']), 'slug': org['slug'], 'city': business['city']}
            
            conn.commit()
            
            print("\n" + "=" * 60)
            print("✅ ГОТОВО!")
            print("=" * 60)
            print("\n📋 Созданные организации (для просмотра на сайте):")
            for name, info in org_slugs.items():
                print(f"  • {name}")
                print(f"    URL: https://chestnoru-production.up.railway.app/org/{info['slug']}")
                print(f"    Город: {info['city']}")
                print()
                
except Exception as e:
    print(f"❌ Ошибка: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)

