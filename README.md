# Zeus Glass 🎬⚡

<div align="center">
  
**Premium IPTV & Streaming Platform**

*Sky Glass inspired UI • Real-Debrid Integration • Live TV & VOD • Android TV Ready*

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Made with Expo](https://img.shields.io/badge/Made%20with-Expo-000020.svg?style=flat&logo=expo)](https://expo.dev/)
[![React Native](https://img.shields.io/badge/React%20Native-0.81-61DAFB.svg?style=flat&logo=react)](https://reactnative.dev/)

[Features](#features) • [Screenshots](#screenshots) • [Installation](#installation) • [Configuration](#configuration) • [Building APK](#building-apk)

</div>

---

## 🌟 Features

### 🎨 **Sky Glass Inspired UI**
- Beautiful hero carousel with featured content
- Top navigation tabs (HOME, TV GUIDE, MOVIES, TV SHOWS, VOD, SEARCH, SETTINGS)
- Dark glassmorphic theme with cyan accents
- Professional gradient overlays
- Smooth animations and transitions

### 🎬 **Content Discovery**
- **Thousands of Movies** - Browse by genre, trending, popular, in cinemas
- **TV Shows** - Complete TV show library with episode tracking
- **Universal Search** - Search across all content
- **Favorites System** - Save your favorite movies and shows
- **Continue Watching** - Pick up where you left off (via Trakt)

### 📺 **Live TV & IPTV**
- **TV Guide** - Electronic Program Guide (EPG) with time slots
- **Live Channels** - Category filtering (Entertainment, Sports, News)
- **VOD Content** - Video On Demand from your IPTV provider (conditional tab)
- **User-Specific Login** - Each user uses their own IPTV credentials
- **Xtreme Codes Support** - Compatible with most IPTV providers

### 🎥 **Streaming**
- **Real-Debrid Integration** - Full API integration for premium streaming
- **Smart Torrent Finder** - Intelligent pattern matching (no VPN needed)
- **Quality Selection** - Choose from 4K, 1080p, 720p, SD
- **Built-in Player** - Video player with play/pause, seek, progress bar
- **Multiple Sources** - AllDebrid & Premiumize support (ready)

### 🔐 **Authentication**
- **QR Code Login** - Easy authentication for TV devices
  - Trakt (tracking & sync)
  - Real-Debrid (streaming)
  - AllDebrid (alternative debrid)
  - Premiumize (another option)
- **Manual IPTV Login** - Domain, username, password
- **Account Status** - View expiry dates, days left, account type
- **Secure Storage** - Encrypted token storage

### 📱 **Platform Support**
- ✅ Android (Phones & Tablets)
- ✅ iOS (iPhone & iPad)
- ✅ Android TV
- ✅ Fire TV
- ✅ Web (limited preview)

---

## 🚀 Installation

### Prerequisites
- Node.js 18+ and npm/yarn
- Expo CLI (`npm install -g expo-cli`)
- Python 3.10+ (for backend)

### Quick Start

```bash
# Clone the repository
git clone https://github.com/Zeus768/zeus-glass.git
cd zeus-glass

# Install frontend dependencies
cd frontend
yarn install

# Install backend dependencies
cd ../backend
pip install -r requirements.txt

# Start the backend server
python server.py

# In another terminal, start the frontend
cd ../frontend
yarn start

# Scan QR code with Expo Go app or press 'w' for web
```

---

## ⚙️ Configuration

### API Keys

The app uses the following APIs (keys included in `app.json`):

- **TMDB API** - Movie & TV metadata
- **Trakt API** - User tracking and sync
- **Real-Debrid API** - User authenticates via QR code
- **IPTV** - User provides their own credentials

---

## 📦 Building APK

### For Android

```bash
cd frontend

# Install EAS CLI
npm install -g eas-cli

# Login to Expo account
eas login

# Configure build
eas build:configure

# Build APK
eas build -p android --profile preview

# Or build AAB for Google Play
eas build -p android --profile production
```

---

## 🏗️ Architecture

### Frontend
- **Framework**: Expo 54 + React Native
- **Language**: TypeScript
- **Navigation**: Expo Router (file-based)
- **State**: Zustand
- **UI**: Custom components (Sky Glass inspired)
- **Video**: expo-av

### Backend
- **Framework**: FastAPI (Python)
- **Database**: MongoDB
- **APIs**: TMDB, Trakt, Real-Debrid, AllDebrid, Premiumize
- **Scrapers**: Smart pattern generator

---

## 📄 License

This project is licensed under the MIT License.

---

## ⚠️ Disclaimer

This application is for educational purposes. Users are responsible for:
- Complying with their local laws
- Respecting content copyright
- Using legitimate streaming services
- Obtaining proper licenses for IPTV services

Zeus Glass does not host, store, or distribute any copyrighted content.

---

<div align="center">

**Made with ❤️ by Zeus768**

⭐ Star this repo if you found it helpful!

</div>
