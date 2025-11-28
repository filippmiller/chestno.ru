#!/usr/bin/env python3
import os
import sys
from pathlib import Path
from dotenv import load_dotenv
import psycopg

load_dotenv(Path(__file__).parent.parent / '.env')
DATABASE_URL = os.getenv('DATABASE_URL')

with psycopg.connect(DATABASE_URL) as conn:
    with conn.cursor() as cur:
        cur.execute("UPDATE organizations SET verification_status = 'verified', is_verified = true, public_visible = true")
        conn.commit()
        print(f"✅ Updated {cur.rowcount} organizations")

