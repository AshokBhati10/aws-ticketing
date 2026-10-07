<#
.SYNOPSIS
  Build the Vue frontend and deploy it to S3 + CloudFront (static hosting).

.DESCRIPTION
  Two-phase, self-driving deployment for the already-deployed backend stack:
    Phase A (only if the frontend distribution does not exist yet):
      updates the CloudFormation stack with DeployedFrontendUrl="https://bootstrap.invalid"
      so the S3 frontend bucket + CloudFront distribution are created.
    Phase B (always):
      1. Builds frontend/ with production VITE_* values. Values come from
         frontend/.env.production when present, otherwise from the -ApiUrl,
         -CognitoDomain and -CognitoClientId parameters. The OAuth redirect and
         logout URIs are ALWAYS derived from the real CloudFront URL.
      2. Syncs frontend/dist/ to the frontend S3 bucket (--delete).
      3. Creates a CloudFront invalidation for "/*".
      4. Updates the stack's DeployedFrontendUrl parameter to the real
         CloudFront URL so Cognito callback/logout URLs and CORS allow it
         (localhost entries are preserved).

  Existing backend resources (Cognito pool/client, API Gateway, Lambda,
  DynamoDB, attachments bucket) are not replaced — the stack update only
  adds/modifies the frontend-hosting pieces.

.EXAMPLE
  .\scripts\deploy-frontend.ps1
  .\scripts\deploy-frontend.ps1 -StackName aws-ticketing-poc -Region us-east-1
  .\scripts\deploy-frontend.ps1 -ApiUrl https://abc.execute-api.us-east-1.amazonaws.com `
      -CognitoDomain https://my-prefix.auth.us-east-1.amazoncognito.com `
      -CognitoClientId 1234567890abcdef
#>
[CmdletBinding()]
param(
  [Parameter(Mandatory = $false)]
  [string]$StackName = "aws-ticketing-poc",

  [Parameter(Mandatory = $false)]
  [string]$Region = "us-east-1",

  [Parameter(Mandatory = $false)]
  [string]$ApiUrl = "",

  [Parameter(Mandatory = $false)]
  [string]$CognitoDomain = "",

  [Parameter(Mandatory = $false)]
  [string]$CognitoClientId = ""
)

$ErrorActionPreference = "Stop"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$RepoRoot = Split-Path -Parent $ScriptDir
$FrontendDir = Join-Path $RepoRoot "frontend"
$TemplateFile = Join-Path $RepoRoot "infra\template.yaml"

if (-not (Test-Path $TemplateFile)) { throw "Template not found: $TemplateFile" }
if (-not (Get-Command npm -ErrorAction SilentlyContinue)) { throw "npm not found on PATH." }

function Get-StackJson {
  $raw = aws cloudformation describe-stacks --stack-name $StackName --region $Region 2>$null
  if ($LASTEXITCODE -ne 0) { throw "Stack '$StackName' not found in $Region. Deploy the backend first (scripts/deploy.sh)." }
  return $raw | ConvertFrom-Json
}

function Get-Output([object]$stack, [string]$key) {
  $o = $stack.Stacks[0].Outputs | Where-Object { $_.OutputKey -eq $key }
  if ($null -eq $o) { return "" }
  return $o.OutputValue
}

function Get-Param([object]$stack, [string]$key) {
  $p = $stack.Stacks[0].Parameters | Where-Object { $_.ParameterKey -eq $key }
  if ($null -eq $p) { return "" }
  return $p.ParameterValue
}

function Invoke-StackDeploy([string]$deployedFrontendUrl, [object]$stack) {
  # Re-send the stack's CURRENT parameter values, overriding only DeployedFrontendUrl.
  $keys = @("ProjectName", "FrontendUrl", "CognitoDomainPrefix", "LambdaCodeBucket", "LambdaCodeKey")
  $overrides = @()
  foreach ($k in $keys) {
    $v = Get-Param $stack $k
    if ([string]::IsNullOrEmpty($v)) { throw "Current stack parameter '$k' is empty — cannot redeploy safely." }
    $overrides += "$k=$v"
  }
  $overrides += "DeployedFrontendUrl=$deployedFrontendUrl"
  Write-Host "Updating stack '$StackName' (DeployedFrontendUrl=$deployedFrontendUrl)..."
  aws cloudformation deploy `
    --template-file $TemplateFile `
    --stack-name $StackName `
    --region $Region `
    --capabilities CAPABILITY_NAMED_IAM `
    --parameter-overrides $overrides
  if ($LASTEXITCODE -ne 0) { throw "Stack update failed." }
  aws cloudformation wait stack-update-complete --stack-name $StackName --region $Region
  if ($LASTEXITCODE -ne 0) { throw "Stack update did not complete." }
}

# ---------- Phase A: ensure the frontend distribution exists ----------
$stack = Get-StackJson
$distId = Get-Output $stack "FrontendDistributionId"

if ([string]::IsNullOrEmpty($distId)) {
  Write-Host "Frontend distribution not found — Phase A: creating S3 bucket + CloudFront distribution..."
  Invoke-StackDeploy "https://bootstrap.invalid" $stack
  $stack = Get-StackJson
  $distId = Get-Output $stack "FrontendDistributionId"
  if ([string]::IsNullOrEmpty($distId)) { throw "Distribution was not created." }
}

$bucket = Get-Output $stack "FrontendBucketName"
$cloudfrontUrl = Get-Output $stack "FrontendCloudFrontUrl"
if ([string]::IsNullOrEmpty($bucket) -or [string]::IsNullOrEmpty($cloudfrontUrl)) {
  throw "Could not read FrontendBucketName / FrontendCloudFrontUrl from stack outputs."
}
Write-Host "Frontend bucket : $bucket"
Write-Host "CloudFront URL  : $cloudfrontUrl"

# ---------- Resolve production VITE_* values ----------
$envFile = Join-Path $FrontendDir ".env.production"
$fileVars = @{}
if (Test-Path $envFile) {
  foreach ($line in (Get-Content $envFile)) {
    $t = $line.Trim()
    if ($t -eq "" -or $t.StartsWith("#")) { continue }
    $i = $t.IndexOf("=")
    if ($i -gt 0) { $fileVars[$t.Substring(0, $i).Trim()] = $t.Substring($i + 1).Trim() }
  }
  Write-Host "Using values from frontend/.env.production (redirect URIs always come from the CloudFront URL)."
}
# (friendly parameter names for the error message)
$apiUrlVal = if ($ApiUrl) { $ApiUrl } elseif ($fileVars["VITE_API_URL"]) { $fileVars["VITE_API_URL"] } else { throw "Missing API URL. Pass -ApiUrl or set VITE_API_URL in frontend/.env.production." }
$domainVal = if ($CognitoDomain) { $CognitoDomain } elseif ($fileVars["VITE_COGNITO_DOMAIN"]) { $fileVars["VITE_COGNITO_DOMAIN"] } else { throw "Missing Cognito domain. Pass -CognitoDomain or set VITE_COGNITO_DOMAIN in frontend/.env.production." }
$clientIdVal = if ($CognitoClientId) { $CognitoClientId } elseif ($fileVars["VITE_COGNITO_CLIENT_ID"]) { $fileVars["VITE_COGNITO_CLIENT_ID"] } else { throw "Missing Cognito client ID. Pass -CognitoClientId or set VITE_COGNITO_CLIENT_ID in frontend/.env.production." }

# Redirect URIs MUST match the deployed origin — environment wins over .env files in Vite.
$env:VITE_API_URL = $apiUrlVal
$env:VITE_COGNITO_DOMAIN = $domainVal
$env:VITE_COGNITO_CLIENT_ID = $clientIdVal
$env:VITE_AWS_REGION = $Region
$env:VITE_COGNITO_REDIRECT_URI = "$cloudfrontUrl/callback"
$env:VITE_LOGOUT_URI = $cloudfrontUrl

# ---------- Phase B: build, sync, invalidate ----------
Push-Location $FrontendDir
try {
  if (-not (Test-Path (Join-Path $FrontendDir "node_modules"))) {
    Write-Host "Installing frontend dependencies..."
    npm install
    if ($LASTEXITCODE -ne 0) { throw "npm install failed." }
  }
  Write-Host "Building frontend (production)..."
  npm run build
  if ($LASTEXITCODE -ne 0) { throw "vite build failed." }

  Write-Host "Syncing frontend/dist/ to s3://$bucket ..."
  aws s3 sync (Join-Path $FrontendDir "dist") "s3://$bucket" --delete --region $Region
  if ($LASTEXITCODE -ne 0) { throw "S3 sync failed." }

  Write-Host "Creating CloudFront invalidation..."
  aws cloudfront create-invalidation --distribution-id $distId --paths "/*" | Out-Null
  if ($LASTEXITCODE -ne 0) { throw "CloudFront invalidation failed." }
} finally {
  Pop-Location
}

# ---------- Phase B (cont.): point Cognito/CORS at the real CloudFront URL ----------
$currentDeployed = Get-Param $stack "DeployedFrontendUrl"
if ($currentDeployed -ne $cloudfrontUrl) {
  Write-Host "Wiring Cognito callback/logout URLs and CORS to $cloudfrontUrl ..."
  Invoke-StackDeploy $cloudfrontUrl $stack
} else {
  Write-Host "Stack already points at $cloudfrontUrl — no update needed."
}

Write-Host ""
Write-Host "Done." -ForegroundColor Green
Write-Host "Open the app at: $cloudfrontUrl"
Write-Host "Local dev (npm run dev on http://localhost:5173) keeps working unchanged."
