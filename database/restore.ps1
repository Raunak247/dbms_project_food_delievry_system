param(
  [string]$InputFile = "backup.sql"
)

if (-not (Test-Path $InputFile)) {
  throw "Backup file not found: $InputFile"
}

$envFile = Join-Path $PSScriptRoot "..\backend\.env"
if (Test-Path $envFile) {
  Get-Content $envFile | ForEach-Object {
    if ($_ -match '^(?<key>[A-Z_]+)=(?<value>.*)$') {
      Set-Item -Path "Env:$($Matches.key)" -Value $Matches.value
    }
  }
}

$hostName = $env:DB_HOST
$userName = $env:DB_USER
$password = $env:DB_PASSWORD
$database = $env:DB_NAME

if (-not $hostName) { $hostName = "localhost" }
if (-not $userName) { $userName = "root" }
if (-not $database) { $database = "food_ordering" }

Get-Content $InputFile | mysql -h $hostName -u $userName -p$password $database
