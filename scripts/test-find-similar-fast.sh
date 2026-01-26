#!/bin/bash
# Fast test script - calls BetaHub API directly
# Usage: ./scripts/test-find-similar-fast.sh [project_id] [issue_id] [limit]

PROJECT_ID="${1:-pr-0690627851}"
ISSUE_ID="${2:-g-1}"
LIMIT="${3:-10}"

if [ -z "$BETAHUB_TOKEN" ]; then
  echo "Error: BETAHUB_TOKEN environment variable not set"
  exit 1
fi

echo "Testing find_similar API directly"
echo "================================="
echo "Project: $PROJECT_ID"
echo "Issue: $ISSUE_ID"
echo "Limit: $LIMIT"
echo ""

curl -s -X GET \
  "https://app.betahub.io/projects/${PROJECT_ID}/issues/${ISSUE_ID}/find_similar.json?limit=${LIMIT}" \
  -H "Authorization: Bearer ${BETAHUB_TOKEN}" \
  -H "Accept: application/json" | jq .
