#!/usr/bin/env python3
"""Проверка статусов всех организаций в базе данных"""
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

print("🔍 Проверка статусов организаций в базе данных...\n")

try:
    with psycopg.connect(DATABASE_URL) as conn:
        with conn.cursor(row_factory=dict_row) as cur:
            # Общее количество организаций
            cur.execute("SELECT COUNT(*) as total FROM organizations")
            total = cur.fetchone()['total']
            print(f"📊 Всего организаций в базе: {total}\n")
            
            if total == 0:
                print("⚠️  В базе данных нет организаций!")
                sys.exit(0)
            
            # Статистика по verification_status
            cur.execute("""
                SELECT verification_status, COUNT(*) as count
                FROM organizations
                GROUP BY verification_status
                ORDER BY verification_status
            """)
            status_stats = cur.fetchall()
            print("📈 Статистика по verification_status:")
            for stat in status_stats:
                print(f"  • {stat['verification_status'] or 'NULL'}: {stat['count']}")
            print()
            
            # Статистика по public_visible
            cur.execute("""
                SELECT public_visible, COUNT(*) as count
                FROM organizations
                GROUP BY public_visible
                ORDER BY public_visible
            """)
            visibility_stats = cur.fetchall()
            print("👁️  Статистика по public_visible:")
            for stat in visibility_stats:
                print(f"  • {stat['public_visible']}: {stat['count']}")
            print()
            
            # Статистика по is_verified
            cur.execute("""
                SELECT is_verified, COUNT(*) as count
                FROM organizations
                GROUP BY is_verified
                ORDER BY is_verified
            """)
            verified_stats = cur.fetchall()
            print("✅ Статистика по is_verified:")
            for stat in verified_stats:
                print(f"  • {stat['is_verified']}: {stat['count']}")
            print()
            
            # Какие организации будут видны в каталоге (по новой логике)
            cur.execute("""
                SELECT COUNT(*) as count
                FROM organizations
                WHERE verification_status = 'verified' OR public_visible = true
            """)
            visible_count = cur.fetchone()['count']
            print(f"🔍 Организаций, видимых в каталоге (verification_status='verified' OR public_visible=true): {visible_count}\n")
            
            # Список всех организаций с детальной информацией
            cur.execute("""
                SELECT 
                    id, name, slug, 
                    verification_status, 
                    public_visible, 
                    is_verified,
                    country, city,
                    created_at
                FROM organizations
                ORDER BY created_at DESC
                LIMIT 50
            """)
            orgs = cur.fetchall()
            
            print(f"📋 Список организаций (последние {len(orgs)}):")
            print("=" * 100)
            
            for org in orgs:
                # Определяем, будет ли видна в каталоге
                visible_in_catalog = (
                    org['verification_status'] == 'verified' or 
                    org['public_visible'] == True
                )
                visible_marker = "✅" if visible_in_catalog else "❌"
                
                print(f"\n{visible_marker} {org['name']}")
                print(f"   ID: {org['id']}")
                print(f"   Slug: {org['slug']}")
                print(f"   Статус: {org['verification_status'] or 'NULL'}")
                print(f"   public_visible: {org['public_visible']}")
                print(f"   is_verified: {org['is_verified']}")
                print(f"   Местоположение: {org['city'] or 'N/A'}, {org['country'] or 'N/A'}")
                print(f"   Создана: {org['created_at']}")
                if not visible_in_catalog:
                    print(f"   ⚠️  НЕ будет видна в каталоге!")
            
            # Организации, которые НЕ будут видны
            cur.execute("""
                SELECT COUNT(*) as count
                FROM organizations
                WHERE verification_status != 'verified' AND public_visible = false
            """)
            hidden_count = cur.fetchone()['count']
            if hidden_count > 0:
                print(f"\n⚠️  Организаций, которые НЕ будут видны в каталоге: {hidden_count}")
                cur.execute("""
                    SELECT name, verification_status, public_visible
                    FROM organizations
                    WHERE verification_status != 'verified' AND public_visible = false
                    ORDER BY created_at DESC
                    LIMIT 10
                """)
                hidden_orgs = cur.fetchall()
                print("   Примеры:")
                for org in hidden_orgs:
                    print(f"     • {org['name']} (status: {org['verification_status']}, public: {org['public_visible']})")
            
except Exception as e:
    print(f"❌ Ошибка: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)

