# Скрипт для создания bucket'ов в Supabase Storage
# Требуется: Supabase CLI установлен и настроен

param(
    [string]$SupabaseUrl = $env:SUPABASE_URL,
    [string]$SupabaseServiceKey = $env:SUPABASE_SERVICE_ROLE_KEY
)

if (-not $SupabaseUrl -or -not $SupabaseServiceKey) {
    Write-Host "❌ SUPABASE_URL и SUPABASE_SERVICE_ROLE_KEY должны быть заданы" -ForegroundColor Red
    Write-Host "`nИли используйте Supabase Dashboard:" -ForegroundColor Yellow
    Write-Host "   1. Откройте https://app.supabase.com" -ForegroundColor White
    Write-Host "   2. Выберите ваш проект" -ForegroundColor White
    Write-Host "   3. Перейдите в Storage → Create bucket" -ForegroundColor White
    Write-Host "   4. Создайте bucket 'org-media' (public)" -ForegroundColor White
    Write-Host "   5. Создайте bucket 'review-media' (public)" -ForegroundColor White
    exit 1
}

Write-Host "`n📦 Создание bucket'ов в Supabase Storage..." -ForegroundColor Cyan

# Проверка наличия Supabase CLI
$supabaseCli = Get-Command supabase -ErrorAction SilentlyContinue
if (-not $supabaseCli) {
    Write-Host "❌ Supabase CLI не найден. Установите: npm install -g supabase" -ForegroundColor Red
    Write-Host "`nИли создайте bucket'ы через Dashboard (см. инструкцию выше)" -ForegroundColor Yellow
    exit 1
}

# Создание bucket'ов через Supabase Management API
$headers = @{
    "apikey" = $SupabaseServiceKey
    "Authorization" = "Bearer $SupabaseServiceKey"
    "Content-Type" = "application/json"
}

# Bucket 1: org-media
Write-Host "`n📦 Создаю bucket 'org-media'..." -ForegroundColor Yellow
$body1 = @{
    name = "org-media"
    public = $true
    file_size_limit = 3145728000  # 3 GB в байтах
    allowed_mime_types = @("image/jpeg", "image/png", "image/webp", "video/mp4", "video/webm")
} | ConvertTo-Json

try {
    $response1 = Invoke-RestMethod -Uri "$SupabaseUrl/storage/v1/bucket" -Method POST -Headers $headers -Body $body1
    Write-Host "✅ Bucket 'org-media' создан" -ForegroundColor Green
} catch {
    if ($_.Exception.Response.StatusCode -eq 409) {
        Write-Host "⚠️  Bucket 'org-media' уже существует" -ForegroundColor Yellow
    } else {
        Write-Host "❌ Ошибка создания bucket 'org-media': $($_.Exception.Message)" -ForegroundColor Red
    }
}

# Bucket 2: review-media
Write-Host "`n📦 Создаю bucket 'review-media'..." -ForegroundColor Yellow
$body2 = @{
    name = "review-media"
    public = $true
    file_size_limit = 3145728000  # 3 GB в байтах
    allowed_mime_types = @("image/jpeg", "image/png", "image/webp", "video/mp4", "video/webm")
} | ConvertTo-Json

try {
    $response2 = Invoke-RestMethod -Uri "$SupabaseUrl/storage/v1/bucket" -Method POST -Headers $headers -Body $body2
    Write-Host "✅ Bucket 'review-media' создан" -ForegroundColor Green
} catch {
    if ($_.Exception.Response.StatusCode -eq 409) {
        Write-Host "⚠️  Bucket 'review-media' уже существует" -ForegroundColor Yellow
    } else {
        Write-Host "❌ Ошибка создания bucket 'review-media': $($_.Exception.Message)" -ForegroundColor Red
    }
}

Write-Host "`n✅ Готово!" -ForegroundColor Green
Write-Host "`n📝 Проверьте bucket'ы в Supabase Dashboard:" -ForegroundColor Cyan
Write-Host "   https://app.supabase.com/project/_/storage/buckets" -ForegroundColor White

