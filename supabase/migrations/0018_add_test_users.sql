-- Миграция для добавления тестовых пользователей и админ роли
-- ВНИМАНИЕ: Этот скрипт нужно запустить вручную после регистрации пользователей через UI

-- Функция для добавления platform_admin роли пользователю по email
-- Использование: SELECT add_admin_role_by_email('filippmiller@gmail.com');
CREATE OR REPLACE FUNCTION add_admin_role_by_email(user_email text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    target_user_id uuid;
BEGIN
    -- Находим user_id по email
    SELECT id INTO target_user_id
    FROM public.app_users
    WHERE email = user_email;
    
    IF target_user_id IS NULL THEN
        RAISE EXCEPTION 'User with email % not found', user_email;
    END IF;
    
    -- Добавляем platform_admin роль
    INSERT INTO public.platform_roles (user_id, role)
    VALUES (target_user_id, 'platform_admin')
    ON CONFLICT (user_id, role) DO NOTHING;
    
    RAISE NOTICE 'Added platform_admin role to user % (email: %)', target_user_id, user_email;
END;
$$;

-- Комментарий для использования
COMMENT ON FUNCTION add_admin_role_by_email IS 'Добавляет platform_admin роль пользователю по email. Использование: SELECT add_admin_role_by_email(''email@example.com'');';

