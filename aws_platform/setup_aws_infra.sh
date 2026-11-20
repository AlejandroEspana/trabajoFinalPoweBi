#!/bin/bash
# Script idempotente para crear:
#   1. Bucket S3 privado (con cifrado AES256, versionado y retención de 30 días)
#   2. Distribución CloudFront HTTPS apuntando al EC2 (con caché para frontend y sin caché para /api/*)
#
# Puede ejecutarse en AWS CloudShell o en EC2 (con IAM Role con permisos S3 + CloudFront).
set -euo pipefail

REGION="${AWS_REGION:-us-east-2}"
ORIGIN_DOMAIN="${ORIGIN_DOMAIN:-ec2-3-14-12-13.us-east-2.compute.amazonaws.com}"
ACCOUNT_ID="$(aws sts get-caller-identity --query Account --output text)"
BUCKET_NAME="${S3_BACKUP_BUCKET:-academico-pg-backups-${ACCOUNT_ID}-${REGION}}"

echo "=== Cuenta AWS: ${ACCOUNT_ID} | Región: ${REGION} ==="
echo "=== 1/2 Configurando bucket S3: ${BUCKET_NAME} ==="

if aws s3api head-bucket --bucket "${BUCKET_NAME}" 2>/dev/null; then
  echo "Bucket ${BUCKET_NAME} ya existe."
else
  aws s3api create-bucket \
    --bucket "${BUCKET_NAME}" \
    --region "${REGION}" \
    --create-bucket-configuration LocationConstraint="${REGION}"
  echo "Bucket ${BUCKET_NAME} creado."
fi

aws s3api put-public-access-block \
  --bucket "${BUCKET_NAME}" \
  --public-access-block-configuration "BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true"

aws s3api put-bucket-versioning \
  --bucket "${BUCKET_NAME}" \
  --versioning-configuration Status=Enabled

aws s3api put-bucket-encryption \
  --bucket "${BUCKET_NAME}" \
  --server-side-encryption-configuration '{"Rules":[{"ApplyServerSideEncryptionByDefault":{"SSEAlgorithm":"AES256"}}]}'

aws s3api put-bucket-lifecycle-configuration \
  --bucket "${BUCKET_NAME}" \
  --lifecycle-configuration '{
    "Rules": [{
      "ID": "retener-backups-30-dias",
      "Status": "Enabled",
      "Filter": {"Prefix": "backups/"},
      "Expiration": {"Days": 30},
      "NoncurrentVersionExpiration": {"NoncurrentDays": 14}
    }]
  }'

echo "=== 2/2 Configurando distribución CloudFront para ${ORIGIN_DOMAIN} ==="

EXISTING_CF="$(aws cloudfront list-distributions \
  --query "DistributionList.Items[?Origins.Items[0].DomainName=='${ORIGIN_DOMAIN}'].[Id,DomainName,Status] | [0]" \
  --output text)"

if [ -n "${EXISTING_CF}" ] && [ "${EXISTING_CF}" != "None" ]; then
  echo "Distribución CloudFront ya existente: ${EXISTING_CF}"
else
  # Políticas administradas oficiales de AWS CloudFront:
  # CachingOptimized = 658327ea-f89d-4fab-a63d-7e88639e58f6
  # CachingDisabled  = 4135ea2d-6df8-44a3-9df3-4b5a84be39ad
  # AllViewer        = 216adef6-5c7f-47e4-b989-5492eafa07d3
  CALLER_REF="academico-bi-$(date +%s)"
  cat > /tmp/cf_config.json <<EOF
{
  "CallerReference": "${CALLER_REF}",
  "Comment": "EduAnalytics BI - Rendimiento Academico (EC2 ${ORIGIN_DOMAIN})",
  "Enabled": true,
  "PriceClass": "PriceClass_100",
  "Origins": {
    "Quantity": 1,
    "Items": [
      {
        "Id": "ec2-academico-origin",
        "DomainName": "${ORIGIN_DOMAIN}",
        "CustomOriginConfig": {
          "HTTPPort": 80,
          "HTTPSPort": 443,
          "OriginProtocolPolicy": "http-only",
          "OriginSslProtocols": { "Quantity": 1, "Items": ["TLSv1.2"] },
          "OriginReadTimeout": 60,
          "OriginKeepaliveTimeout": 5
        }
      }
    ]
  },
  "DefaultCacheBehavior": {
    "TargetOriginId": "ec2-academico-origin",
    "ViewerProtocolPolicy": "redirect-to-https",
    "AllowedMethods": {
      "Quantity": 2,
      "Items": ["GET", "HEAD"],
      "CachedMethods": { "Quantity": 2, "Items": ["GET", "HEAD"] }
    },
    "Compress": true,
    "CachePolicyId": "658327ea-f89d-4fab-a63d-7e88639e58f6"
  },
  "CacheBehaviors": {
    "Quantity": 1,
    "Items": [
      {
        "PathPattern": "/api/*",
        "TargetOriginId": "ec2-academico-origin",
        "ViewerProtocolPolicy": "redirect-to-https",
        "AllowedMethods": {
          "Quantity": 7,
          "Items": ["GET", "HEAD", "OPTIONS", "PUT", "POST", "PATCH", "DELETE"],
          "CachedMethods": { "Quantity": 2, "Items": ["GET", "HEAD"] }
        },
        "Compress": true,
        "CachePolicyId": "4135ea2d-6df8-44a3-9df3-4b5a84be39ad",
        "OriginRequestPolicyId": "216adef6-5c7f-47e4-b989-5492eafa07d3"
      }
    ]
  }
}
EOF
  aws cloudfront create-distribution --distribution-config file:///tmp/cf_config.json \
    --query "Distribution.[Id,DomainName,Status]" --output table
  rm -f /tmp/cf_config.json
fi

echo ""
echo "=== RESUMEN ==="
echo "S3_BACKUP_BUCKET=${BUCKET_NAME}"
echo "Guarda S3_BACKUP_BUCKET=${BUCKET_NAME} en ~/academico_aws/.env en tu EC2 y ejecuta:"
echo "  sudo docker compose --profile backup up -d --build backup"
