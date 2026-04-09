param(
  [string]$WorkflowFile = "ios-release.yml",
  [string]$Ref = "main"
)

$ErrorActionPreference = "Stop"

$gh = Get-Command gh -ErrorAction SilentlyContinue
if (-not $gh) {
  throw "GitHub CLI (gh) is not installed. Install it first: https://cli.github.com/"
}

gh workflow run $WorkflowFile --ref $Ref
Write-Host "Triggered workflow: $WorkflowFile on ref: $Ref"
Write-Host "Open Actions tab or run: gh run list --workflow $WorkflowFile"
