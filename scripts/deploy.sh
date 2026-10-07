#!/usr/bin/env bash
# Deploy the AWS serverless ticketing system POC.
#
# Prereqs: AWS CLI v2 configured with credentials, Node 20+, zip.
#
# Required env vars:
#   COGNITO_DOMAIN_PREFIX  globally unique prefix for the Cognito Hosted UI domain
#   STAGING_BUCKET          an S3 bucket you own, used to stage the Lambda zip
# Optional env vars:
#   STACK_NAME   (default: aws-ticketing-poc)
#   AWS_REGION   (default: us-east-1)
#   FRONTEND_URL (default: http://localhost:5173)
#
# Example:
#   COGNITO_DOMAIN_PREFIX=my-ticketing-poc-12345 STAGING_BUCKET=my-staging-bucket ./scripts/deploy.sh
set -euo pipefail

STACK_NAME="${STACK_NAME:-aws-ticketing-poc}"
REGION="${AWS_REGION:-us-east-1}"
FRONTEND_URL="${FRONTEND_URL:-http://localhost:5173}"
: "${COGNITO_DOMAIN_PREFIX:?set COGNITO_DOMAIN_PREFIX (must be globally unique)}"
: "${STAGING_BUCKET:?set STAGING_BUCKET (an S3 bucket you own for Lambda code staging)}"

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo "==> Packaging Lambda (backend/)..."
pushd "$ROOT/backend" >/dev/null
npm ci --omit=dev
rm -f /tmp/aws-ticketing-lambda.zip
# Zip root must contain src/ so the handler resolves as src/handler.handler.
zip -qr /tmp/aws-ticketing-lambda.zip src node_modules package.json
popd >/dev/null

CODE_KEY="aws-ticketing/lambda-$(date +%Y%m%d%H%M%S).zip"
echo "==> Uploading Lambda zip to s3://${STAGING_BUCKET}/${CODE_KEY} ..."
aws s3 cp /tmp/aws-ticketing-lambda.zip "s3://${STAGING_BUCKET}/${CODE_KEY}" --region "$REGION" --quiet

echo "==> Deploying CloudFormation stack ${STACK_NAME} ..."
aws cloudformation deploy \
  --template-file "$ROOT/infra/template.yaml" \
  --stack-name "$STACK_NAME" \
  --region "$REGION" \
  --capabilities CAPABILITY_IAM \
  --parameter-overrides \
    ProjectName="$STACK_NAME" \
    FrontendUrl="$FRONTEND_URL" \
    CognitoDomainPrefix="$COGNITO_DOMAIN_PREFIX" \
    LambdaCodeBucket="$STAGING_BUCKET" \
    LambdaCodeKey="$CODE_KEY"

echo "==> Stack outputs:"
aws cloudformation describe-stacks --stack-name "$STACK_NAME" --region "$REGION" \
  --query "Stacks[0].Outputs" --output table

cat <<EOF

Next steps:
  1. Copy frontend/.env.example to frontend/.env and fill in values from the
     Outputs above (ApiUrl -> VITE_API_URL, CognitoDomain -> VITE_COGNITO_DOMAIN,
     UserPoolClientId -> VITE_COGNITO_CLIENT_ID).
  2. cd frontend && npm install && npm run dev
  3. Sign up via the Hosted UI, then promote a user to agent (see README).
EOF
