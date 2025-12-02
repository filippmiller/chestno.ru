#!/usr/bin/env python3
"""Проверка структуры таблицы organizations"""
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
            # Проверяем наличие primary_category
            cur.execute("""
                SELECT column_name 
                FROM information_schema.columns 
                WHERE table_name = 'organizations' 
                AND column_name = 'primary_category'
            """)
            has_primary_category = cur.fetchone() is not None
            
            print(f"🔍 Колонка 'primary_category' существует: {has_primary_category}\n")
            
            # Получаем все колонки таблицы organizations
            cur.execute("""
                SELECT column_name, data_type, is_nullable
                FROM information_schema.columns 
                WHERE table_name = 'organizations'
                ORDER BY ordinal_position
            """)
            columns = cur.fetchall()
            
            print("📋 Все колонки таблицы organizations:")
            print("=" * 80)
            for col in columns:
                nullable = "NULL" if col['is_nullable'] == 'YES' else "NOT NULL"
                print(f"  • {col['column_name']:30} {col['data_type']:20} {nullable}")
            
except Exception as e:
    print(f"❌ Ошибка: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)

