#!/bin/bash
# Zeus Glass - GitHub & Expo Deploy Script
# Run: chmod +x deploy.sh && ./deploy.sh

set -e

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  Zeus Glass - Deploy Script${NC}"
echo -e "${GREEN}========================================${NC}"

# Check if git is configured
if [ -z "$(git config user.name)" ]; then
    echo -e "${YELLOW}Setting up Git user...${NC}"
    git config user.name "Zeus768"
    git config user.email "zeus768@users.noreply.github.com"
fi

# Function to push to GitHub
push_to_github() {
    echo -e "\n${GREEN}📤 Pushing to GitHub...${NC}"
    
    # Check if remote exists
    if ! git remote | grep -q "origin"; then
        echo -e "${YELLOW}No remote 'origin' found. Adding it...${NC}"
        read -p "Enter your GitHub repo URL (e.g., https://github.com/Zeus768/zeus-glass.git): " REPO_URL
        git remote add origin "$REPO_URL"
    fi
    
    # Get current branch
    BRANCH=$(git rev-parse --abbrev-ref HEAD)
    
    # Add all changes
    git add -A
    
    # Commit if there are changes
    if ! git diff-index --quiet HEAD --; then
        read -p "Enter commit message (or press Enter for default): " COMMIT_MSG
        if [ -z "$COMMIT_MSG" ]; then
            COMMIT_MSG="Zeus Glass update - $(date '+%Y-%m-%d %H:%M')"
        fi
        git commit -m "$COMMIT_MSG"
    else
        echo -e "${YELLOW}No changes to commit${NC}"
    fi
    
    # Push
    echo -e "${GREEN}Pushing to $BRANCH...${NC}"
    git push -u origin "$BRANCH"
    
    echo -e "${GREEN}✅ Pushed to GitHub successfully!${NC}"
}

# Function to publish to Expo
publish_to_expo() {
    echo -e "\n${GREEN}📱 Publishing to Expo...${NC}"
    
    cd frontend
    
    # Check if logged in
    if ! npx expo whoami 2>/dev/null; then
        echo -e "${YELLOW}Please log in to Expo:${NC}"
        npx expo login
    fi
    
    # Publish
    echo -e "${GREEN}Publishing update...${NC}"
    npx expo publish
    
    echo -e "${GREEN}✅ Published to Expo successfully!${NC}"
    cd ..
}

# Function to build for Android
build_android() {
    echo -e "\n${GREEN}🤖 Building Android APK...${NC}"
    
    cd frontend
    
    # Check if logged in
    if ! npx eas whoami 2>/dev/null; then
        echo -e "${YELLOW}Please log in to EAS:${NC}"
        npx eas login
    fi
    
    # Build
    echo -e "${GREEN}Starting Android build...${NC}"
    npx eas build --platform android --profile preview
    
    echo -e "${GREEN}✅ Android build started!${NC}"
    cd ..
}

# Main menu
echo ""
echo "What would you like to do?"
echo "1) Push to GitHub"
echo "2) Publish to Expo"
echo "3) Build Android APK"
echo "4) Do all (GitHub + Expo)"
echo "5) Exit"
echo ""
read -p "Enter your choice [1-5]: " choice

case $choice in
    1)
        push_to_github
        ;;
    2)
        publish_to_expo
        ;;
    3)
        build_android
        ;;
    4)
        push_to_github
        publish_to_expo
        ;;
    5)
        echo "Goodbye!"
        exit 0
        ;;
    *)
        echo -e "${RED}Invalid choice${NC}"
        exit 1
        ;;
esac

echo -e "\n${GREEN}========================================${NC}"
echo -e "${GREEN}  Deploy Complete!${NC}"
echo -e "${GREEN}========================================${NC}"
