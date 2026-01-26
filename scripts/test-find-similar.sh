#!/bin/bash
# Test script for findSimilarIssues tool
# Usage: ./scripts/test-find-similar.sh [project_id] [issue_id]

PROJECT_ID="${1:-pr-0690627851}"
ISSUE_ID="${2:-g-1}"

echo "Testing findSimilarIssues tool"
echo "=============================="
echo "Project: $PROJECT_ID"
echo "Issue: $ISSUE_ID"
echo ""

# Test via claude CLI with the betahub MCP server
claude -p "Use the findSimilarIssues tool to find similar issues for issue $ISSUE_ID in project $PROJECT_ID. Return the raw results."
