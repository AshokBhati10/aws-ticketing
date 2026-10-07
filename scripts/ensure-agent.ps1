<#
.SYNOPSIS
  One-time bootstrap: ensure a user belongs to the Cognito "Agents" group.

.DESCRIPTION
  Idempotent. Safe to run multiple times.
  - If the user does not exist in the User Pool, the script prints instructions
    and exits WITHOUT creating anything (sign up once via the app's Cognito
    Hosted UI, then re-run this script).
  - If the user already belongs to "Agents", it reports that and does nothing.
  - Otherwise it adds the user to "Agents".

  The application derives the Agent/Customer role from the Cognito
  "cognito:groups" claim at sign-in, so no frontend or backend change is needed.
  This script never handles, stores, or prints passwords or secrets.

.EXAMPLE
  .\scripts\ensure-agent.ps1 -UserPoolId us-east-1_AbCdEfGhI
  .\scripts\ensure-agent.ps1 -UserPoolId us-east-1_AbCdEfGhI -Email someone@example.com -Region eu-west-1
#>
[CmdletBinding()]
param(
  [Parameter(Mandatory = $true, HelpMessage = "Cognito User Pool ID (see CloudFormation stack output 'UserPoolId')")]
  [string]$UserPoolId,

  [Parameter(Mandatory = $false)]
  [string]$Email = "ashok.fun99@gmail.com",

  [Parameter(Mandatory = $false)]
  [string]$Region = "us-east-1"
)

$ErrorActionPreference = "Stop"

function Get-UserExists {
  # NOTE: the AWS CLI is a native command; a non-zero exit does not throw in
  # PowerShell, so we inspect $LASTEXITCODE instead of try/catch.
  $null = aws cognito-idp admin-get-user `
    --user-pool-id $UserPoolId `
    --username $Email `
    --region $Region 2>$null
  return $LASTEXITCODE -eq 0
}

Write-Host "Checking user '$Email' in pool '$UserPoolId' ($Region)..."

if (-not (Get-UserExists)) {
  Write-Host ""
  Write-Host "User '$Email' does not exist in this User Pool yet." -ForegroundColor Yellow
  Write-Host "This script will NOT create users. Please do this once:"
  Write-Host "  1. Open the deployed app (or http://localhost:5173 during dev)."
  Write-Host "  2. Sign up with the email '$Email' via the Cognito Hosted UI"
  Write-Host "     (complete the email verification code step)."
  Write-Host "  3. Re-run this script:"
  Write-Host "       .\scripts\ensure-agent.ps1 -UserPoolId $UserPoolId -Email $Email -Region $Region"
  exit 0
}

$groupsRaw = aws cognito-idp admin-list-groups-for-user `
  --user-pool-id $UserPoolId `
  --username $Email `
  --region $Region 2>$null
if ($LASTEXITCODE -ne 0) {
  Write-Host "Could not list groups for '$Email' (aws exit code $LASTEXITCODE)." -ForegroundColor Red
  Write-Host "Check that the User Pool ID and your AWS permissions are correct, then re-run."
  exit 1
}
$groupsJson = $groupsRaw | ConvertFrom-Json

$isAgent = ($groupsJson.Groups | Where-Object { $_.GroupName -eq "Agents" } | Measure-Object).Count -gt 0

if ($isAgent) {
  Write-Host "'$Email' is already a member of the 'Agents' group. Nothing to do." -ForegroundColor Green
  exit 0
}

$null = aws cognito-idp admin-add-user-to-group `
  --user-pool-id $UserPoolId `
  --username $Email `
  --group-name Agents `
  --region $Region 2>&1

if ($LASTEXITCODE -ne 0) {
  Write-Host "Failed to add '$Email' to the 'Agents' group (aws exit code $LASTEXITCODE)." -ForegroundColor Red
  Write-Host "Check that the User Pool ID, email, and your AWS permissions are correct, then re-run."
  exit 1
}

Write-Host "'$Email' has been added to the 'Agents' group." -ForegroundColor Green
Write-Host "The user must sign out and sign back in for the Agent role to take effect."
