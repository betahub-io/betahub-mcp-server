#!/bin/bash

# Script to install git hooks for the project

echo "📦 Installing git hooks..."

# Set the hooks path to our custom directory
git config core.hooksPath .githooks

# Make sure the pre-commit hook is executable
chmod +x .githooks/pre-commit

echo "✅ Git hooks installed successfully!"
echo ""
echo "The following hooks are now active:"
echo "  • pre-commit: Checks for PAT tokens before committing"
echo ""
echo "To bypass hooks temporarily (use with caution):"
echo "  git commit --no-verify"
echo ""
echo "To uninstall hooks:"
echo "  git config --unset core.hooksPath"