#!/usr/bin/env python3
import os
import sys
from pathlib import Path
from dotenv import load_dotenv
import psycopg
from psycopg.rows import dict_row

load_dotenv(Path(__file__).parent.parent / '.env')
DATABASE_URL = os.getenv('DATABASE_URL')

with psycopg.connect(DATABASE_URL) as conn:
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute("SELECT slug, name, verification_status, public_visible, is_verified FROM organizations WHERE slug LIKE '%фарфор%' LIMIT 5")
        rows = cur.fetchall()
        print('Организации в БД:')
        for r in rows:
            print(f"  slug: {r['slug']}")
            print(f"  name: {r['name']}")
            print(f"  verification_status: {r['verification_status']}")
            print(f"  public_visible: {r['public_visible']}")
            print(f"  is_verified: {r['is_verified']}")
            print()

