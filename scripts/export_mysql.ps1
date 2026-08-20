<#
.Synopsis
  Export the configured MySQL database to a SQL dump using `mysqldump`.

.Description
  Uses `DB_HOST`, `DB_USER`, and `DB_NAME` environment variables by default.
  Prompts for the database password if needed. Requires `mysqldump` in PATH.
#>

[CmdletBinding()]
param(
  [string]$Output = ".\store_dump.sql",
  [string]$DbHost = $env:DB_HOST,
  [string]$DbUser = $env:DB_USER,
  [string]$DbName = $env:DB_NAME
)

try {
  if (-not $DbUser -or -not $DbName) { throw 'Please set DB_USER and DB_NAME environment variables (or pass -DbUser and -DbName).' }

  $pw = Read-Host -AsSecureString "Enter DB password (leave blank if none)"
  $pwPlain = ''
  if ($pw.Length -gt 0) {
    $ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($pw)
    $pwPlain = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr)
  }

  $args = @()
  $args += "-u"; $args += $DbUser
  if ($pwPlain -ne '') { $args += "-p$pwPlain" }
  if ($DbHost) { $args += "-h"; $args += $DbHost }
  $args += $DbName

  Write-Host "Running: mysqldump $($args -join ' ') > $Output"

  $psi = New-Object System.Diagnostics.ProcessStartInfo
  $psi.FileName = 'mysqldump'
  $psi.Arguments = $args -join ' '
  $psi.RedirectStandardOutput = $true
  $psi.UseShellExecute = $false
  $psi.CreateNoWindow = $true

  $proc = [System.Diagnostics.Process]::Start($psi)
  $out = $proc.StandardOutput.ReadToEnd()
  $proc.WaitForExit()

  Set-Content -Path $Output -Value $out -Encoding UTF8
  Write-Host "Export complete: $Output"

} catch {
  Write-Error "Export failed: $_"
}
