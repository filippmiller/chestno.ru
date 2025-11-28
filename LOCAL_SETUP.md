# Локальный запуск Chestno.ru

## Варианты запуска

### Вариант 1: Гибридный (рекомендуется)
- **Frontend**: локально на `http://localhost:5173`
- **Backend**: локально на `http://localhost:8000`
- **База данных**: Supabase (удалённая)
- **Auth**: Supabase (удалённый)

**Преимущества:**
- Не нужно настраивать локальную PostgreSQL
- Все миграции уже применены на Supabase
- Быстрый старт

### Вариант 2: Полностью локально
- **Frontend**: локально
- **Backend**: локально
- **База данных**: локальная PostgreSQL
- **Auth**: локальный Supabase (требует Docker)

**Недостатки:**
- Нужно настроить локальный Supabase
- Применить все миграции локально
- Сложнее в настройке

---

## Быстрый старт (Гибридный вариант)

### 1. Настройка Backend

```powershell
cd backend

# Создайте .env файл из примера
copy env.example .env

# Отредактируйте .env:
# - DATABASE_URL должен указывать на Supabase
# - ALLOWED_ORIGINS=http://localhost:5173
# - FRONTEND_URL=http://localhost:5173

# Установите зависимости (если ещё не установлены)
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt

# Запустите сервер
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### 2. Настройка Frontend

```powershell
cd frontend

# Создайте .env.local файл
copy env.example .env.local

# Отредактируйте .env.local:
# - VITE_BACKEND_URL=http://localhost:8000
# - VITE_SUPABASE_URL и VITE_SUPABASE_ANON_KEY из Supabase

# Установите зависимости (если ещё не установлены)
npm install

# Запустите dev сервер
npm run dev
```

### 3. Проверка

- Frontend: http://localhost:5173
- Backend API: http://localhost:8000
- Backend Docs: http://localhost:8000/docs

---

## Переменные окружения

### Backend (.env)

```env
# Supabase (используйте ваши реальные ключи)
SUPABASE_URL=https://ygsbcrqajkjcvrzixvam.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# База данных (Supabase direct connection)
DATABASE_URL=postgresql://postgres:password@db.ygsbcrqajkjcvrzixvam.supabase.co:5432/postgres

# Локальные настройки
ALLOWED_ORIGINS=http://localhost:5173
FRONTEND_URL=http://localhost:5173
BACKEND_HOST=0.0.0.0
BACKEND_PORT=8000

# Остальные настройки (можно оставить пустыми для локальной разработки)
QR_IP_HASH_SALT=local-dev-salt-12345
SOCIAL_LOGIN_SALT=local-dev-salt-67890
SOCIAL_STATE_SECRET=local-dev-secret
```

### Frontend (.env.local)

```env
VITE_SUPABASE_URL=https://ygsbcrqajkjcvrzixvam.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_BACKEND_URL=http://localhost:8000
```

---

## Troubleshooting

### Backend не запускается

1. Проверьте, что Python 3.11+ установлен:
   ```powershell
   python --version
   ```

2. Проверьте, что все зависимости установлены:
   ```powershell
   pip list
   ```

3. Проверьте .env файл:
   ```powershell
   type .env
   ```

### Frontend не подключается к Backend

1. Проверьте, что backend запущен на порту 8000
2. Проверьте CORS настройки в backend/.env:
   ```
   ALLOWED_ORIGINS=http://localhost:5173
   ```

3. Проверьте VITE_BACKEND_URL в frontend/.env.local

### Ошибки подключения к БД

1. Проверьте DATABASE_URL в backend/.env
2. Убедитесь, что Supabase доступен
3. Проверьте, что миграции применены на Supabase

---

## Полезные команды

### Backend

```powershell
# Запуск с автоперезагрузкой
uvicorn app.main:app --reload

# Запуск на другом порту
uvicorn app.main:app --port 8001

# Проверка синтаксиса
python -m compileall app
```

### Frontend

```powershell
# Dev сервер
npm run dev

# Сборка для продакшена
npm run build

# Линтинг
npm run lint
```

---

## Примечания

- **База данных**: Используется удалённая Supabase. Все данные будут в облаке.
- **Auth**: Используется Supabase Auth. Пользователи будут общими для всех разработчиков.
- **Backend на Railway**: Можно использовать Railway backend вместо локального, просто измените `VITE_BACKEND_URL` на URL Railway.

