<#
.Synopsis
  Import a MySQL dump file into the configured database using `mysql` client.

.Description
  Uses `DB_HOST`, `DB_USER`, and `DB_NAME` environment variables by default.
  Prompts for DB password as needed. Requires `mysql` in PATH.
#>

[CmdletBinding()]
param(
  [string]$SqlDump,
  [string]$DbHost = $env:DB_HOST,
  [string]$DbUser = $env:DB_USER,
  [string]$DbName = $env:DB_NAME
)

try {
  if (-not $SqlDump) { throw 'Provide -SqlDump path to a .sql file to import.' }
  if (-not (Test-Path $SqlDump -PathType Leaf)) { throw "SQL dump not found: $SqlDump" }
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

  Write-Host "Importing $SqlDump into $DbName on $DbHost"

  $psi = New-Object System.Diagnostics.ProcessStartInfo
  $psi.FileName = 'mysql'
  $psi.Arguments = $args -join ' '
  $psi.RedirectStandardInput = $true
  $psi.RedirectStandardOutput = $true
  $psi.UseShellExecute = $false
  $psi.CreateNoWindow = $true

  $proc = [System.Diagnostics.Process]::Start($psi)
  $in = Get-Content -Path $SqlDump -Raw
  $proc.StandardInput.Write($in)
  $proc.StandardInput.Close()
  $output = $proc.StandardOutput.ReadToEnd()
  $proc.WaitForExit()

  Write-Host "Import finished. mysql exit code: $($proc.ExitCode)"
  if ($proc.ExitCode -ne 0) { Write-Error "mysql returned exit code $($proc.ExitCode)" }

} catch {
  Write-Error "Import failed: $_"
}
