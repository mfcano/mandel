#!/bin/bash
# src/scripts/create-candidate-repo.sh

set -e  # Exit on any error

if [ "$#" -ne 2 ]; then
    echo "Usage: $0 candidate_name candidate_github_username"
    echo "Example: $0 alice-smith alice-gh"
    exit 1
fi

CANDIDATE_NAME=$1
GITHUB_USERNAME=$2
REPO_NAME="mandelbrot-exercise-${CANDIDATE_NAME}"
ORIG_DIR=$(pwd)
TEMP_DIR=$(mktemp -d)

echo "Creating repository for candidate: $CANDIDATE_NAME ($GITHUB_USERNAME)"

# Create new repository on GitHub
echo "Creating GitHub repository: $REPO_NAME"
gh repo create "$REPO_NAME" --private --description "Mandelbrot Set Viewer Exercise for $CANDIDATE_NAME" || {
    echo "Failed to create repository"
    exit 1
}

# Clone current repository to temp directory
echo "Creating clean copy of exercise..."
cp -r . "$TEMP_DIR"
cd "$TEMP_DIR"

# Remove files that shouldn't go to candidates
rm -rf .git

# Initialize new git repository
git init
git add .
git commit -m "Initial commit of Mandelbrot exercise"

# Set remote and push
echo "Pushing to new repository..."
git remote add origin "https://github.com/$(gh api user -q .login)/$REPO_NAME.git"
git push -u origin main

# Add candidate as collaborator
echo "Adding $GITHUB_USERNAME as collaborator..."
gh api --method PUT "repos/$(gh api user -q .login)/$REPO_NAME/collaborators/$GITHUB_USERNAME" -f permission=write

# Generate invitation link
INVITE_URL="https://github.com/$(gh api user -q .login)/$REPO_NAME/invitations"

# Clean up
cd "$ORIG_DIR"
rm -rf "$TEMP_DIR"

echo "=================================="
echo "Repository created successfully!"
echo "=================================="
echo "Repository: https://github.com/$(gh api user -q .login)/$REPO_NAME"
echo "Invitation URL: $INVITE_URL"
echo ""
echo "Next steps:"
echo "1. Send the repository URL to the candidate"
echo "2. Ask them to accept the collaboration invitation at $INVITE_URL"
echo "3. Remind them to:"
echo "   - Create a new branch for their work"
echo "   - Make regular, well-documented commits"
echo "   - Submit their changes as a pull request"
echo "   - Include their documentation as specified in the README"
echo "   - Complete the exercise within 8 hours"
