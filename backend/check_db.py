import os
import sys
from pathlib import Path
import json

# Add backend directory to sys.path
backend_dir = Path(__file__).parent
sys.path.append(str(backend_dir))

from app.core.db import get_connection
from psycopg.rows import dict_row

def check_db():
    try:
        print("Connecting to database...")
        with get_connection() as conn:
            print("Connected!")
            with conn.cursor(row_factory=dict_row) as cur:
                # Test Select Query
                print("\nFetching all organizations to check gallery content...")
                base_query = '''
                    FROM organizations o
                    LEFT JOIN organization_profiles p ON p.organization_id = o.id
                '''
                where_sql = "(o.verification_status = 'verified' OR o.public_visible = true)"
                
                select_query = f'''
                    SELECT o.id, o.name, p.gallery
                    {base_query}
                    WHERE {where_sql}
                '''
                cur.execute(select_query)
                rows = cur.fetchall()
                print(f"Retrieved {len(rows)} rows.")
                
                for row in rows:
                    gallery = row['gallery']
                    print(f" - {row['name']}: Gallery type={type(gallery)}, Content={gallery}")
                    
                    # Simulate processing
                    if gallery:
                        try:
                            if isinstance(gallery, str):
                                gallery_items = json.loads(gallery)
                            else:
                                gallery_items = gallery
                            
                            if gallery_items:
                                item = gallery_items[0]
                                print(f"   First item type: {type(item)}")
                                if isinstance(item, dict):
                                    print(f"   First item url: {item.get('url')}")
                                else:
                                    print(f"   WARNING: First item is not a dict: {item}")
                        except Exception as e:
                            print(f"   ERROR processing gallery: {e}")

    except Exception as e:
        print(f"\nError: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    check_db()
