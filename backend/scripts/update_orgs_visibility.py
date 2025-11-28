#!/usr/bin/env python3
"""Обновляет существующие организации для публичной видимости"""
import os
import sys
from pathlib import Path
from dotenv import load_dotenv
import psycopg
from psycopg.rows import dict_row

sys.path.insert(0, str(Path(__file__).parent.parent.parent))
load_dotenv(Path(__file__).parent.parent / '.env')

DATABASE_URL = os.getenv('DATABASE_URL')
if not DATABASE_URL:
    print("❌ DATABASE_URL не установлен")
    sys.exit(1)

print("🔧 Обновление организаций для публичной видимости...\n")

try:
    with psycopg.connect(DATABASE_URL) as conn:
        with conn.cursor(row_factory=dict_row) as cur:
            # Обновляем все организации
            cur.execute(
                '''
                UPDATE organizations 
                SET verification_status = 'verified', 
                    is_verified = true, 
                    public_visible = true
                WHERE verification_status != 'verified' OR is_verified = false OR public_visible = false
                RETURNING id, name, slug
                '''
            )
            updated = cur.fetchall()
            conn.commit()
            
            if updated:
                print(f"✅ Обновлено {len(updated)} организаций:")
                for org in updated:
                    print(f"  • {org['name']} (slug: {org['slug']})")
            else:
                print("ℹ️  Все организации уже обновлены")
                
except Exception as e:
    print(f"❌ Ошибка: {e}")
    import traceback
    traceback.print_exc()

