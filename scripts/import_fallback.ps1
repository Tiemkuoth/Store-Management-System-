<#
.Synopsis
  Import a transferred fallback JSON store or MySQL SQL dump on the target machine.

.Parameters
  -FallbackFile: path to `fallback-store.json` to copy into `server/db`.
  -SqlDump: path to a MySQL dump `.sql` file to import into the configured DB.

Example
  .\import_fallback.ps1 -FallbackFile C:\transfer\fallback-store.json
  .\import_fallback.ps1 -SqlDump C:\transfer\store_dump.sql
#>

[CmdletBinding()]
param(
  [string]$FallbackFile,
  [string]$SqlDump
)

try {
  $root = Split-Path -Parent $MyInvocation.MyCommand.Definition
  Push-Location $root

  if ($FallbackFile) {
    if (-not (Test-Path $FallbackFile -PathType Leaf)) { throw "Fallback file not found: $FallbackFile" }
    $target = Join-Path $root 'server\db\fallback-store.json'
    Copy-Item -Path $FallbackFile -Destination $target -Force
    Write-Host "Copied fallback-store.json to $target"
    Write-Host 'Running scripts/init_db.js to ensure the app recognizes the fallback store...'
    node scripts/init_db.js
  }

  if ($SqlDump) {
    if (-not (Test-Path $SqlDump -PathType Leaf)) { throw "SQL dump not found: $SqlDump" }
    Write-Host 'Importing SQL dump into MySQL (requires mysql in PATH and DB env vars configured)'
    $dbHost = $env:DB_HOST
    $dbUser = $env:DB_USER
    $dbName = $env:DB_NAME
    if (-not $dbUser -or -not $dbName) { throw 'Please set DB_USER and DB_NAME environment variables before importing SQL dump.' }
    & mysql -u $dbUser -p -h $dbHost $dbName < $SqlDump
  }

  if (-not $FallbackFile -and -not $SqlDump) { Write-Host 'Nothing to import. Provide -FallbackFile or -SqlDump.' }

} catch {
  Write-Error "Import failed: $_"
} finally {
  Pop-Location -ErrorAction SilentlyContinue
}
