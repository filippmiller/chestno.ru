#!/usr/bin/env python3
"""
Создание бизнес-пользователя для тестирования QR-кодов
"""
import os
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent))

from dotenv import load_dotenv
import psycopg
from app.core.supabase import supabase_admin
from app.services.accounts import handle_after_signup
from app.schemas.auth import AfterSignupRequest

# Загружаем переменные окружения
load_dotenv(Path(__file__).parent.parent / '.env')

DATABASE_URL = os.getenv('DATABASE_URL')
if not DATABASE_URL:
    print("❌ Ошибка: DATABASE_URL должен быть установлен")
    sys.exit(1)

email = 'business@test.com'
password = 'business123'
company_name = 'Тестовый Бизнес'
country = 'Россия'
city = 'Москва'

print(f"🔍 Создание бизнес-пользователя {email}...")

try:
    # Создаем пользователя в Supabase
    supabase_user = supabase_admin.create_user(
        email=email,
        password=password,
        user_metadata={'full_name': 'Business Owner'}
    )
    user_id = supabase_user['id']
    print(f"✅ Создан пользователь в Supabase: {email} (ID: {user_id})")
    
    # Создаем запись в app_users и организацию
    payload = AfterSignupRequest(
        auth_user_id=user_id,
        email=email,
        contact_name='Business Owner',
        account_type='producer',
        company_name=company_name,
        country=country,
        city=city,
        website_url='https://test-business.ru',
        phone='+7 (495) 111-22-33',
    )
    session = handle_after_signup(payload)
    print(f"✅ Создан профиль пользователя: {email}")
    if session.organizations:
        org = session.organizations[0]
        print(f"✅ Создана организация: {org.name} (ID: {org.id})")
        
        # Одобряем организацию для тестирования
        with psycopg.connect(DATABASE_URL) as conn:
            with conn.cursor() as cur:
                cur.execute(
                    '''
                    UPDATE organizations
                    SET verification_status = 'verified',
                        is_verified = true,
                        public_visible = true
                    WHERE id = %s
                    ''',
                    (org.id,),
                )
                conn.commit()
                print(f"✅ Организация одобрена и опубликована")
        
        print(f"\n📋 Учетные данные:")
        print(f"  Email: {email}")
        print(f"  Пароль: {password}")
        print(f"  Организация: {org.name}")
        print(f"  Organization ID: {org.id}")
    
    print("\n✅ Готово!")
    
except Exception as e:
    print(f"❌ Ошибка: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)

