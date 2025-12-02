#!/usr/bin/env python3
"""Проверка колонок organization_profiles"""
import os
import sys
from pathlib import Path
from dotenv import load_dotenv
import psycopg
from psycopg.rows import dict_row

load_dotenv(Path(__file__).parent.parent / '.env')
DATABASE_URL = os.getenv('DATABASE_URL')

if not DATABASE_URL:
    print("❌ DATABASE_URL не установлен")
    sys.exit(1)

try:
    with psycopg.connect(DATABASE_URL) as conn:
        with conn.cursor(row_factory=dict_row) as cur:
            cur.execute("""
                SELECT column_name, data_type
                FROM information_schema.columns 
                WHERE table_name = 'organization_profiles'
                AND column_name IN ('category', 'tags')
                ORDER BY column_name
            """)
            cols = cur.fetchall()
            print("Колонки category и tags в organization_profiles:")
            for col in cols:
                print(f"  • {col['column_name']}: {col['data_type']}")
            
            if not cols:
                print("  ⚠️  Колонки не найдены!")
            
except Exception as e:
    print(f"❌ Ошибка: {e}")
    import traceback
    traceback.print_exc()

