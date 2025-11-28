#!/usr/bin/env python3
import os
import sys
from pathlib import Path
from dotenv import load_dotenv
import psycopg
from psycopg.rows import dict_row
import json

load_dotenv(Path(__file__).parent.parent / '.env')
DATABASE_URL = os.getenv('DATABASE_URL')

slug = 'мастерская-северныи-фарфор'
print(f"🔍 Тестирую SQL запрос для slug: {slug}\n")

with psycopg.connect(DATABASE_URL) as conn:
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            '''
            SELECT o.id, o.name, o.slug, o.country, o.city, o.website_url, o.is_verified,
                   o.verification_status, o.primary_category, o.tags,
                   p.short_description, p.long_description, p.production_description,
                   p.safety_and_quality, p.video_url, p.gallery, p.category, p.founded_year,
                   p.employee_count, p.factory_size, p.certifications, p.sustainability_practices,
                   p.quality_standards, p.buy_links,
                   p.contact_email, p.contact_phone, p.contact_website, p.contact_address,
                   p.contact_telegram, p.contact_whatsapp, p.social_links
            FROM organizations o
            LEFT JOIN organization_profiles p ON p.organization_id = o.id
            WHERE o.slug = %s
              AND o.public_visible = true
              AND o.verification_status = 'verified'
            ''',
            (slug,),
        )
        org = cur.fetchone()
        if org:
            print("✅ Организация найдена:")
            print(f"  ID: {org['id']}")
            print(f"  Name: {org['name']}")
            print(f"  Slug: {org['slug']}")
            print(f"  Gallery type: {type(org.get('gallery'))}")
            print(f"  Gallery value: {org.get('gallery')}")
            print(f"  Social links type: {type(org.get('social_links'))}")
            print(f"  Social links value: {org.get('social_links')}")
            print(f"  Certifications type: {type(org.get('certifications'))}")
            print(f"  Certifications value: {org.get('certifications')}")
        else:
            print("❌ Организация не найдена")

