# Скрипт для запуска локальной разработки Chestno.ru

Write-Host "🚀 Запуск Chestno.ru локально..." -ForegroundColor Green

# Проверка зависимостей
Write-Host "`n📦 Проверка зависимостей..." -ForegroundColor Yellow

# Backend
Write-Host "`n🔧 Backend:" -ForegroundColor Cyan
if (-not (Test-Path "backend\.venv")) {
    Write-Host "  Создание виртуального окружения..." -ForegroundColor Yellow
    cd backend
    python -m venv .venv
    cd ..
}

Write-Host "  Установка зависимостей Python..." -ForegroundColor Yellow
cd backend
.venv\Scripts\python.exe -m pip install -q -r requirements.txt
cd ..

# Frontend
Write-Host "`n🎨 Frontend:" -ForegroundColor Cyan
if (-not (Test-Path "frontend\node_modules")) {
    Write-Host "  Установка зависимостей npm..." -ForegroundColor Yellow
    cd frontend
    npm install
    cd ..
}

# Проверка .env файлов
Write-Host "`n⚙️  Проверка конфигурации..." -ForegroundColor Yellow

if (-not (Test-Path "backend\.env")) {
    Write-Host "  Создание backend\.env из примера..." -ForegroundColor Yellow
    Copy-Item backend\env.example backend\.env
    # Обновляем для локальной разработки
    (Get-Content backend\.env) -replace 'ALLOWED_ORIGINS=.*', 'ALLOWED_ORIGINS=http://localhost:5173' -replace 'FRONTEND_URL=.*', 'FRONTEND_URL=http://localhost:5173' | Set-Content backend\.env
}

if (-not (Test-Path "frontend\.env.local")) {
    Write-Host "  Создание frontend\.env.local из примера..." -ForegroundColor Yellow
    Copy-Item frontend\env.example frontend\.env.local
    # Обновляем для локальной разработки
    (Get-Content frontend\.env.local) -replace 'VITE_BACKEND_URL=.*', 'VITE_BACKEND_URL=http://localhost:8000' | Set-Content frontend\.env.local
}

Write-Host "`n✅ Готово! Теперь запустите:" -ForegroundColor Green
Write-Host "`n  Терминал 1 (Backend):" -ForegroundColor Cyan
Write-Host "    cd backend" -ForegroundColor White
Write-Host "    .venv\Scripts\activate" -ForegroundColor White
Write-Host "    uvicorn app.main:app --reload" -ForegroundColor White
Write-Host "`n  Терминал 2 (Frontend):" -ForegroundColor Cyan
Write-Host "    cd frontend" -ForegroundColor White
Write-Host "    npm run dev" -ForegroundColor White
Write-Host "`n  Затем откройте: http://localhost:5173" -ForegroundColor Green

