<#
.Synopsis
  Create a transfer ZIP of the project including the fallback JSON store.

.Description
  This script creates a portable ZIP archive of the repository suitable for
  copying to another machine. It excludes large folders like `node_modules`
  and `.git` by default but always includes `server/db/fallback-store.json` if present.

.Parameters
  -Output: path to resulting zip (default: .\transfer-package.zip)

Example
  .\package_for_transfer.ps1 -Output C:\temp\store-transfer.zip
#>

[CmdletBinding()]
param(
  [string]$Output = ".\transfer-package.zip"
)

try {
  $root = Split-Path -Parent $MyInvocation.MyCommand.Definition
  Push-Location $root

  Write-Host "Creating transfer package at: $Output"

  # Collect files excluding node_modules and .git
  $files = Get-ChildItem -Path $root -Recurse -Force | Where-Object {
    -not ($_.FullName -match '\\node_modules\\' -or $_.FullName -match '\\.git\\')
  } | Where-Object { -not $_.PSIsContainer }

  if (-not $files) { throw 'No files found to archive.' }

  # Ensure fallback-store.json is included if present
  $fallback = Join-Path $root 'server\db\fallback-store.json'
  if (Test-Path $fallback -PathType Leaf) {
    if (-not ($files.FullName -contains (Get-Item $fallback).FullName)) {
      $files = $files + (Get-Item $fallback)
    }
    Write-Host 'Including fallback-store.json in archive.'
  } else {
    Write-Host 'No fallback-store.json found — archive will contain repository files only.'
  }

  # Prepare list of literal paths for Compress-Archive
  $paths = $files | ForEach-Object { $_.FullName }

  if (Test-Path $Output) { Remove-Item $Output -Force }
  Compress-Archive -LiteralPath $paths -DestinationPath $Output -Force

  Write-Host "Package created: $Output"
} catch {
  Write-Error "Failed to create package: $_"
} finally {
  Pop-Location -ErrorAction SilentlyContinue
}
