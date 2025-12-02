#!/usr/bin/env python3
"""Тест фильтрации по категории"""
import os
import sys
from pathlib import Path
from dotenv import load_dotenv

sys.path.insert(0, str(Path(__file__).parent.parent))
load_dotenv(Path(__file__).parent.parent / '.env')

from app.services.organization_profiles import search_public_organizations

print("🧪 Тестирование фильтрации по категории...\n")

try:
    # Тест: Поиск с фильтром по категории
    print("=" * 80)
    print("Тест: Поиск с category='текстиль'")
    print("=" * 80)
    items, total = search_public_organizations(
        q=None,
        country=None,
        category='текстиль',
        verified_only=False,
        limit=20,
        offset=0,
        include_non_public=False,
    )
    print(f"✅ Найдено организаций с категорией 'текстиль': {total}")
    print(f"✅ Возвращено элементов: {len(items)}")
    if items:
        print("\nСписок организаций:")
        for org in items:
            print(f"  • {org.name} (ID: {org.id})")
    else:
        print("⚠️  Организации не найдены (возможно, нет организаций с такой категорией в tags)")
    print()
    
    # Тест: Поиск без фильтра по категории для сравнения
    print("=" * 80)
    print("Тест: Поиск без фильтра по категории (для сравнения)")
    print("=" * 80)
    items_all, total_all = search_public_organizations(
        q=None,
        country=None,
        category=None,
        verified_only=False,
        limit=20,
        offset=0,
        include_non_public=False,
    )
    print(f"✅ Всего организаций без фильтра: {total_all}")
    print(f"✅ Возвращено элементов: {len(items_all)}")
    print()
    
    if total_all > total:
        print(f"✅ Фильтрация работает! Без фильтра: {total_all}, с фильтром 'текстиль': {total}")
    elif total_all == total and total > 0:
        print(f"⚠️  Фильтр не сработал - одинаковое количество результатов ({total})")
        print("   Это может означать, что все организации содержат 'текстиль' в tags")
    else:
        print(f"ℹ️  Нет данных для сравнения")
    
    print("=" * 80)
    print("✅ Тест завершен!")
    print("=" * 80)
    
except Exception as e:
    print(f"❌ Ошибка при тестировании: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)

