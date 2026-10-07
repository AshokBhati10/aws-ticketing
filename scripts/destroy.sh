#!/usr/bin/env bash
# Tear down the AWS serverless ticketing system POC.
# Empties the attachments bucket (required before stack deletion), then deletes
# the CloudFormation stack.
#
# Optional env vars:
#   STACK_NAME (default: aws-ticketing-poc)
#   AWS_REGION (default: us-east-1)
set -euo pipefail

STACK_NAME="${STACK_NAME:-aws-ticketing-poc}"
REGION="${AWS_REGION:-us-east-1}"

BUCKET="$(aws cloudformation describe-stacks --stack-name "$STACK_NAME" --region "$REGION" \
  --query "Stacks[0].Outputs[?OutputKey=='AttachmentsBucketName'].OutputValue" \
  --output text 2>/dev/null || true)"

if [ -n "$BUCKET" ] && [ "$BUCKET" != "None" ]; then
  echo "==> Emptying attachments bucket ${BUCKET} ..."
  aws s3 rm "s3://${BUCKET}" --recursive --region "$REGION" --quiet || true
fi

echo "==> Deleting stack ${STACK_NAME} ..."
aws cloudformation delete-stack --stack-name "$STACK_NAME" --region "$REGION"
aws cloudformation wait stack-delete-complete --stack-name "$STACK_NAME" --region "$REGION"
echo "Deleted."
