#!/usr/bin/env python3
"""Тестирует получение деталей организации"""
import os
import sys
from pathlib import Path
from dotenv import load_dotenv
import psycopg
from psycopg.rows import dict_row

sys.path.insert(0, str(Path(__file__).parent.parent))
from app.services.organization_profiles import get_public_organization_details_by_slug

load_dotenv(Path(__file__).parent.parent / '.env')
DATABASE_URL = os.getenv('DATABASE_URL')

slug = 'мастерская-северныи-фарфор'
print(f"🔍 Тестирую получение деталей для slug: {slug}\n")

try:
    details = get_public_organization_details_by_slug(slug)
    print("✅ Успешно получены детали:")
    print(f"  Название: {details.name}")
    print(f"  Город: {details.city}")
    print(f"  Slug: {details.slug}")
    print(f"  Verified: {details.is_verified}")
    print(f"  Gallery items: {len(details.gallery)}")
    print(f"  Products: {len(details.products)}")
except Exception as e:
    print(f"❌ Ошибка: {e}")
    import traceback
    traceback.print_exc()

