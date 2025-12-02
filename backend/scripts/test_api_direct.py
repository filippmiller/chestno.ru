#!/usr/bin/env python3
"""Прямой тест API эндпоинта"""
import requests
import json

url = "https://chestnoru-production.up.railway.app/api/public/organizations/search"

# Тест 1: Базовый запрос
print("=" * 80)
print("Тест 1: Базовый запрос без параметров")
print("=" * 80)
try:
    response = requests.get(url, params={"verified_only": False}, timeout=10)
    print(f"Status Code: {response.status_code}")
    print(f"Headers: {dict(response.headers)}")
    if response.status_code == 200:
        data = response.json()
        print(f"Total: {data.get('total', 0)}")
        print(f"Items: {len(data.get('items', []))}")
        if data.get('items'):
            print("\nПервая организация:")
            print(json.dumps(data['items'][0], indent=2, ensure_ascii=False))
    else:
        print(f"Error: {response.text}")
except Exception as e:
    print(f"Exception: {e}")
    import traceback
    traceback.print_exc()

print("\n" + "=" * 80)
print("Тест 2: Запрос с limit=5")
print("=" * 80)
try:
    response = requests.get(url, params={"verified_only": False, "limit": 5}, timeout=10)
    print(f"Status Code: {response.status_code}")
    if response.status_code == 200:
        data = response.json()
        print(f"Total: {data.get('total', 0)}")
        print(f"Items: {len(data.get('items', []))}")
    else:
        print(f"Error: {response.text[:500]}")
except Exception as e:
    print(f"Exception: {e}")

