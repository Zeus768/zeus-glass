# Zeus Glass - Quick Deploy Guide

## 🚀 One-Time Setup (Do This First)

### 1. Create GitHub Personal Access Token
1. Go to: https://github.com/settings/tokens
2. Click "Generate new token (classic)"
3. Give it a name like "zeus-glass-deploy"
4. Select scopes: `repo` (full control)
5. Click "Generate token"
6. **COPY THE TOKEN NOW** (you won't see it again!)

### 2. Configure Git with Your Token
Run this command (replace YOUR_TOKEN with your actual token):

```bash
git remote set-url origin https://Zeus768:YOUR_TOKEN@github.com/Zeus768/zeus-glass.git
```

Or if the repo doesn't exist yet:
```bash
# First create the repo on GitHub, then:
git remote add origin https://Zeus768:YOUR_TOKEN@github.com/Zeus768/zeus-glass.git
```

### 3. Expo Login (One-Time)
```bash
cd frontend
npx expo login
# Enter your Expo username and password
```

---

## 📤 Quick Push Commands

### Push to GitHub (after setup):
```bash
cd /app
git add -A
git commit -m "Your commit message"
git push origin main
```

### Publish to Expo:
```bash
cd /app/frontend
npx expo publish
```

### Build Android APK:
```bash
cd /app/frontend
npx eas build --platform android --profile preview
```

---

## 🔧 Or Use the Deploy Script

```bash
cd /app
./deploy.sh
```

This interactive script will guide you through:
- Pushing to GitHub
- Publishing to Expo
- Building Android APK

---

## 🔒 Security Notes

- Never commit your GitHub token to the repository
- The token is stored locally in your git config
- You can revoke tokens at: https://github.com/settings/tokens
