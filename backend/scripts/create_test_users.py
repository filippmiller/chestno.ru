#!/usr/bin/env python3
"""
Скрипт для создания тестовых пользователей и добавления админ роли
"""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.core.supabase import supabase_admin
from app.core.db import get_connection
from app.services.accounts import handle_after_signup
from app.schemas.auth import AfterSignupRequest

def create_user(email: str, password: str, account_type: str = 'user', company_name: str = None):
    """Создает пользователя в Supabase и в app_users"""
    try:
        # Создаем пользователя в Supabase
        supabase_user = supabase_admin.create_user(
            email=email,
            password=password,
            user_metadata={'full_name': email.split('@')[0]}
        )
        user_id = supabase_user['id']
        print(f"✅ Создан пользователь в Supabase: {email} (ID: {user_id})")
        
        # Создаем запись в app_users и организацию если нужно
        payload = AfterSignupRequest(
            auth_user_id=user_id,
            email=email,
            contact_name=email.split('@')[0],
            account_type=account_type,
            company_name=company_name
        )
        session = handle_after_signup(payload)
        print(f"✅ Создан профиль пользователя: {email}")
        if account_type == 'producer' and session.organizations:
            print(f"✅ Создана организация: {session.organizations[0].name}")
        return user_id
    except Exception as e:
        print(f"❌ Ошибка при создании пользователя {email}: {e}")
        return None

def add_admin_role(user_id: str, role: str = 'platform_admin'):
    """Добавляет platform роль пользователю"""
    try:
        with get_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    '''
                    INSERT INTO platform_roles (user_id, role)
                    VALUES (%s, %s)
                    ON CONFLICT (user_id, role) DO NOTHING
                    ''',
                    (user_id, role)
                )
                conn.commit()
                print(f"✅ Добавлена роль {role} пользователю {user_id}")
    except Exception as e:
        print(f"❌ Ошибка при добавлении роли: {e}")

if __name__ == '__main__':
    print("🚀 Создание тестовых пользователей...\n")
    
    # 1. Обычный пользователь
    print("1. Создание обычного пользователя test@test.com...")
    test_user_id = create_user('test@test.com', 'test123456', 'user')
    
    # 2. Производитель
    print("\n2. Создание производителя manufacturer@test.com...")
    manufacturer_user_id = create_user('manufacturer@test.com', 'manufacturer123', 'producer', 'Тестовый производитель')
    
    # 3. Админ
    print("\n3. Создание админа filippmiller@gmail.com...")
    admin_user_id = create_user('filippmiller@gmail.com', 'Airbus380+', 'user')
    if admin_user_id:
        add_admin_role(admin_user_id, 'platform_admin')
    
    print("\n✅ Готово!")

