param(
  [Parameter(Mandatory = $true)]
  [string]$P12Path,

  [Parameter(Mandatory = $true)]
  [string]$P12Password,

  [Parameter(Mandatory = $true)]
  [string]$ProvisioningProfilePath,

  [Parameter(Mandatory = $true)]
  [string]$TeamId,

  [Parameter(Mandatory = $true)]
  [string]$BundleIdentifier,

  [string]$KeychainPassword = "temp-keychain-password-change-me",

  [switch]$SetGithubSecrets,

  [string]$OutputDir = ".\\.ios-secrets-output"
)

$ErrorActionPreference = "Stop"

function Convert-FileToBase64 {
  param([Parameter(Mandatory = $true)][string]$Path)

  if (-not (Test-Path -LiteralPath $Path)) {
    throw "File not found: $Path"
  }

  $bytes = [System.IO.File]::ReadAllBytes((Resolve-Path -LiteralPath $Path))
  return [System.Convert]::ToBase64String($bytes)
}

$p12Base64 = Convert-FileToBase64 -Path $P12Path
$profileBase64 = Convert-FileToBase64 -Path $ProvisioningProfilePath

if (-not (Test-Path -LiteralPath $OutputDir)) {
  New-Item -ItemType Directory -Path $OutputDir | Out-Null
}

Set-Content -Path (Join-Path $OutputDir "IOS_P12_BASE64.txt") -Value $p12Base64 -NoNewline
Set-Content -Path (Join-Path $OutputDir "IOS_PROFILE_BASE64.txt") -Value $profileBase64 -NoNewline
Set-Content -Path (Join-Path $OutputDir "IOS_P12_PASSWORD.txt") -Value $P12Password -NoNewline
Set-Content -Path (Join-Path $OutputDir "IOS_TEAM_ID.txt") -Value $TeamId -NoNewline
Set-Content -Path (Join-Path $OutputDir "IOS_BUNDLE_IDENTIFIER.txt") -Value $BundleIdentifier -NoNewline
Set-Content -Path (Join-Path $OutputDir "IOS_KEYCHAIN_PASSWORD.txt") -Value $KeychainPassword -NoNewline

Write-Host "Saved secret values to: $OutputDir"
Write-Host "- IOS_P12_BASE64.txt"
Write-Host "- IOS_PROFILE_BASE64.txt"
Write-Host "- IOS_P12_PASSWORD.txt"
Write-Host "- IOS_TEAM_ID.txt"
Write-Host "- IOS_BUNDLE_IDENTIFIER.txt"
Write-Host "- IOS_KEYCHAIN_PASSWORD.txt"

if ($SetGithubSecrets) {
  $gh = Get-Command gh -ErrorAction SilentlyContinue
  if (-not $gh) {
    throw "GitHub CLI (gh) is not installed. Install it or rerun without -SetGithubSecrets."
  }

  gh secret set IOS_P12_BASE64 --body $p12Base64 | Out-Null
  gh secret set IOS_PROFILE_BASE64 --body $profileBase64 | Out-Null
  gh secret set IOS_P12_PASSWORD --body $P12Password | Out-Null
  gh secret set IOS_TEAM_ID --body $TeamId | Out-Null
  gh secret set IOS_BUNDLE_IDENTIFIER --body $BundleIdentifier | Out-Null
  gh secret set IOS_KEYCHAIN_PASSWORD --body $KeychainPassword | Out-Null

  Write-Host "GitHub repository secrets have been updated."
}
