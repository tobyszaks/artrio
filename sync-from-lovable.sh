#!/bin/bash

# Manual sync script to pull changes from Toby's Lovable repo
# Run this anytime you need an immediate sync

echo "🔄 Starting sync from Lovable (tobyszaks/artrio)..."

# Add Toby's repo as remote if not exists
git remote add lovable https://github.com/tobyszaks/artrio.git 2>/dev/null || true

# Fetch latest from Toby's repo
echo "📥 Fetching latest changes from Lovable..."
git fetch lovable main

# Check if there are changes
LOCAL_COMMIT=$(git rev-parse HEAD)
REMOTE_COMMIT=$(git rev-parse lovable/main)

if [ "$LOCAL_COMMIT" = "$REMOTE_COMMIT" ]; then
    echo "✅ Already up to date with Lovable!"
    exit 0
fi

# Show what's different
echo "📊 Changes found. Comparing..."
git log --oneline HEAD..lovable/main

# Ask for confirmation
read -p "Do you want to merge these changes? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "❌ Sync cancelled"
    exit 1
fi

# Try to merge
echo "🔀 Merging changes..."
if git merge lovable/main -m "🔄 Manual sync from Lovable"; then
    echo "✅ Merge successful!"
    
    # Push to your repo
    echo "📤 Pushing to GitHub (Railway will auto-deploy)..."
    if git push origin main; then
        echo "🚀 Successfully synced and pushed!"
        echo "Railway will deploy these changes in ~2-3 minutes"
        echo "Check: https://artrio-production.up.railway.app"
    else
        echo "❌ Push failed. Please check and push manually."
    fi
else
    echo "⚠️  Merge conflict detected!"
    echo "Options:"
    echo "1. Resolve conflicts manually and commit"
    echo "2. Run: git merge --abort (to cancel)"
    echo "3. Run: git merge lovable/main -X theirs (to take Lovable's version)"
fi