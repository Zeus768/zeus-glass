#!/bin/bash
# Zeus Glass - Automated Deploy Script
# GitHub: Zeus768/zeus-glass
# Expo: thealphaman

set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  Zeus Glass - Deploy Script${NC}"
echo -e "${GREEN}========================================${NC}"

# Function to push to GitHub
push_github() {
    echo -e "\n${GREEN}📤 Pushing to GitHub...${NC}"
    cd /app
    git add -A
    
    if git diff-index --quiet HEAD --; then
        echo -e "${YELLOW}No changes to commit${NC}"
    else
        git commit -m "${1:-Zeus Glass update - $(date '+%Y-%m-%d %H:%M')}"
    fi
    
    git push origin main
    echo -e "${GREEN}✅ Pushed to GitHub!${NC}"
    echo -e "   https://github.com/Zeus768/zeus-glass"
}

# Function to publish to Expo
publish_expo() {
    echo -e "\n${GREEN}📱 Publishing to Expo...${NC}"
    cd /app/frontend
    npx expo publish --non-interactive
    echo -e "${GREEN}✅ Published to Expo!${NC}"
}

# Function to build APK
build_apk() {
    echo -e "\n${GREEN}🤖 Building Android APK...${NC}"
    cd /app/frontend
    npx eas build --platform android --profile preview --non-interactive
    echo -e "${GREEN}✅ Build started! Check Expo dashboard for status.${NC}"
}

# Main menu
case "${1:-menu}" in
    github)
        push_github "$2"
        ;;
    expo)
        publish_expo
        ;;
    apk)
        build_apk
        ;;
    all)
        push_github "$2"
        publish_expo
        ;;
    menu)
        echo ""
        echo "Options:"
        echo "  ./deploy.sh github [message]  - Push to GitHub"
        echo "  ./deploy.sh expo              - Publish to Expo"
        echo "  ./deploy.sh apk               - Build Android APK"
        echo "  ./deploy.sh all [message]     - GitHub + Expo"
        echo ""
        read -p "Quick action - Push to GitHub now? (y/n): " yn
        if [[ $yn == "y" || $yn == "Y" ]]; then
            push_github
        fi
        ;;
    *)
        echo -e "${RED}Unknown option: $1${NC}"
        exit 1
        ;;
esac

echo -e "\n${GREEN}========================================${NC}"
echo -e "${GREEN}  Done!${NC}"
echo -e "${GREEN}========================================${NC}"
