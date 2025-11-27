param (
    [string]$DatabaseUrl = $env:DATABASE_URL
)

if (-not $DatabaseUrl) {
    Write-Error "DATABASE_URL не задан. Укажите параметр -DatabaseUrl или переменную окружения."
    exit 1
}

$migrationsPath = Join-Path $PSScriptRoot "..\\supabase\\migrations"
$files = Get-ChildItem -Path $migrationsPath -Filter "*.sql" | Sort-Object Name

if ($files.Count -eq 0) {
    Write-Host "Файлы миграций не найдены в $migrationsPath"
    exit 0
}

foreach ($file in $files) {
    Write-Host "Применяем $($file.Name)..."
    & psql $DatabaseUrl -f $file.FullName
    if ($LASTEXITCODE -ne 0) {
        Write-Error "Ошибка при выполнении $($file.Name)"
        exit $LASTEXITCODE
    }
}

Write-Host "Все миграции применены"

