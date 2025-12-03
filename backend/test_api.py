import sys
from pathlib import Path

# Add backend directory to sys.path
backend_dir = Path(__file__).parent
sys.path.append(str(backend_dir))

from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_api():
    try:
        print("Testing /api/public/organizations/search...")
        response = client.get("/api/public/organizations/search")
        print(f"Status Code: {response.status_code}")
        if response.status_code == 200:
            data = response.json()
            print(f"Total: {data['total']}")
            print(f"Items: {len(data['items'])}")
            for item in data['items']:
                print(f" - {item['name']}")
        else:
            print(f"Error Response: {response.text}")
            
    except Exception as e:
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    test_api()
