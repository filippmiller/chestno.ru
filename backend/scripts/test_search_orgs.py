#!/usr/bin/env python3
"""Тестирование функции search_public_organizations"""
import os
import sys
from pathlib import Path
from dotenv import load_dotenv

sys.path.insert(0, str(Path(__file__).parent.parent))
load_dotenv(Path(__file__).parent.parent / '.env')

from app.services.organization_profiles import search_public_organizations

print("🧪 Тестирование функции search_public_organizations...\n")

try:
    # Тест 1: Поиск без фильтров (должно показать все видимые организации)
    print("=" * 80)
    print("Тест 1: Поиск без фильтров")
    print("=" * 80)
    items, total = search_public_organizations(
        q=None,
        country=None,
        category=None,
        verified_only=False,
        limit=20,
        offset=0,
        include_non_public=False,
    )
    print(f"✅ Найдено организаций: {total}")
    print(f"✅ Возвращено элементов: {len(items)}")
    if items:
        print("\nСписок организаций:")
        for org in items:
            print(f"  • {org.name} (ID: {org.id}, verified: {org.is_verified})")
    else:
        print("⚠️  Организации не найдены!")
    print()
    
    # Тест 2: Поиск только проверенных
    print("=" * 80)
    print("Тест 2: Поиск только проверенных (verified_only=True)")
    print("=" * 80)
    items, total = search_public_organizations(
        q=None,
        country=None,
        category=None,
        verified_only=True,
        limit=20,
        offset=0,
        include_non_public=False,
    )
    print(f"✅ Найдено проверенных организаций: {total}")
    print(f"✅ Возвращено элементов: {len(items)}")
    if items:
        print("\nСписок проверенных организаций:")
        for org in items:
            print(f"  • {org.name} (ID: {org.id})")
    print()
    
    # Тест 3: Поиск с include_non_public=True (для админа)
    print("=" * 80)
    print("Тест 3: Поиск всех организаций (include_non_public=True)")
    print("=" * 80)
    items, total = search_public_organizations(
        q=None,
        country=None,
        category=None,
        verified_only=False,
        limit=20,
        offset=0,
        include_non_public=True,
    )
    print(f"✅ Найдено всех организаций: {total}")
    print(f"✅ Возвращено элементов: {len(items)}")
    if items:
        print("\nСписок всех организаций:")
        for org in items:
            print(f"  • {org.name} (ID: {org.id}, verified: {org.is_verified})")
    print()
    
    print("=" * 80)
    print("✅ Все тесты завершены успешно!")
    print("=" * 80)
    
except Exception as e:
    print(f"❌ Ошибка при тестировании: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)

