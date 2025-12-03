import sys
import asyncio
from pathlib import Path

# Add backend directory to sys.path
backend_dir = Path(__file__).parent
sys.path.append(str(backend_dir))

from app.services.organization_profiles import search_public_organizations

async def test_service():
    try:
        print("Calling search_public_organizations...")
        items, total = search_public_organizations(
            q=None,
            country=None,
            category=None,
            verified_only=False,
            limit=20,
            offset=0,
            include_non_public=False
        )
        print(f"Success! Total: {total}, Items: {len(items)}")
        for item in items:
            print(f" - {item.name} ({item.id})")
    except Exception as e:
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    try:
        asyncio.run(test_service())
    except Exception as e:
        print(f"Main Error: {e}")
