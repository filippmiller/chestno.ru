#!/usr/bin/env python3
"""Получить ID организаций для использования в URL"""
import os
from pathlib import Path
from dotenv import load_dotenv
import psycopg
from psycopg.rows import dict_row

load_dotenv(Path(__file__).parent.parent / '.env')
DATABASE_URL = os.getenv('DATABASE_URL')

with psycopg.connect(DATABASE_URL) as conn:
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute("SELECT id, name, slug FROM organizations WHERE public_visible = true AND verification_status = 'verified' LIMIT 10")
        rows = cur.fetchall()
        print("📋 Организации с ID для URL:")
        print("=" * 80)
        for r in rows:
            print(f"  • {r['name']}")
            print(f"    ID: {r['id']}")
            print(f"    URL: https://chestnoru-production.up.railway.app/org/{r['id']}")
            print()

