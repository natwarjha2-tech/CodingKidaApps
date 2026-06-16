# CodingKida Mobile App

Cross-platform mobile application for CodingKida learning platform built with React Native & Expo SDK 56.

## Tech Stack

| Technology | Version | Purpose |
|-----------|---------|---------|
| React Native | 0.85.3 | Core framework |
| Expo | SDK 56 | Development platform |
| TypeScript | 6.0 | Type safety |
| Expo Router | 56.2.9 | File-based navigation |
| Zustand | 5.0.3 | State management |
| TanStack Query | 5.62 | Data fetching & caching |
| Axios | 1.7.9 | HTTP client |
| Expo Secure Store | 56.0.4 | Secure token storage |
| Expo Video | - | Video playback |
| Expo File System | 56.0.8 | Downloads & offline storage |

## Project Structure

```
CodingKidaApps/
├── app/                    # Expo Router pages (file-based routing)
│   ├── (auth)/             # Authentication screens
│   │   ├── login.tsx
│   │   ├── signup.tsx
│   │   └── forgot-password.tsx
│   ├── (tabs)/             # Bottom tab navigation
│   │   ├── dashboard.tsx
│   │   ├── courses.tsx
│   │   ├── ai-mentor.tsx
│   │   └── profile.tsx
│   ├── course/[id].tsx     # Course detail (dynamic)
│   ├── lesson/[id].tsx     # Lesson page (video, quiz, exercise)
│   ├── enrolled-courses.tsx
│   ├── completed-videos.tsx
│   ├── achievements.tsx
│   ├── streak-history.tsx
│   ├── leaderboard.tsx
│   ├── watchlist.tsx
│   ├── downloads.tsx
│   ├── offline-player.tsx
│   ├── my-report.tsx
│   ├── refer-earn.tsx
│   ├── help-support.tsx
│   ├── change-password.tsx
│   ├── index.tsx           # Entry redirect
│   └── _layout.tsx         # Root layout
├── src/                    # Core application logic
│   ├── api/                # Centralized API layer
│   │   ├── client.ts       # Axios instance with JWT interceptor
│   │   ├── auth.api.ts
│   │   ├── courses.api.ts
│   │   ├── student.api.ts
│   │   ├── quiz.api.ts
│   │   ├── exercise.api.ts
│   │   ├── homework.api.ts
│   │   └── misc.api.ts     # Leaderboard, Coins, AI, Streak, Media, Progress
│   ├── components/         # Reusable UI components
│   │   ├── common/
│   │   │   └── CoinsModal.tsx
│   │   ├── course/
│   │   ├── dashboard/
│   │   └── lesson/
│   │       ├── VideoPlayer.tsx
│   │       └── PdfViewer.tsx
│   ├── hooks/              # Custom React hooks
│   │   ├── useAuth.ts
│   │   ├── useCoins.ts
│   │   ├── useCourses.ts
│   │   ├── useDashboard.ts
│   │   ├── useLesson.ts
│   │   └── useWeeklyStreak.ts
│   ├── services/           # Business logic services
│   │   ├── auth.service.ts
│   │   ├── storage.service.ts
│   │   └── download.service.ts
│   ├── store/              # Zustand state stores
│   │   ├── auth.store.ts
│   │   └── course.store.ts
│   ├── theme/              # Design system
│   │   ├── colors.ts
│   │   ├── spacing.ts
│   │   └── typography.ts
│   └── types/              # TypeScript type definitions
│       ├── auth.types.ts
│       ├── course.types.ts
│       └── api.types.ts
├── assets/                 # Images, icons, splash
├── .env.example            # Environment variables template
├── app.json                # Expo configuration
├── eas.json                # EAS Build configuration
├── package.json
└── tsconfig.json
```

## Features

### Core
- JWT authentication (login, signup, forgot password)
- Course browsing with category filters
- Course enrollment & payment (Razorpay via website)
- Video playback (expo-video)
- Lesson progress tracking (auto-complete at 90%)

### Learning
- Multi-question quiz with sequential flow
- Coding exercises with AI evaluation
- Homework problems
- Weekly streak challenges (7th lesson multiples)
- AI Mentor (lesson-specific + general)

### Gamification
- Coins system with leaderboard
- Achievements (Super-Master, Master, Pro badges)
- Weekly streak tracking

### Offline & Downloads
- Video download for offline playback (30-day expiry)
- PDF notes download with secure in-app viewer (pdf.js)
- Download manager with hierarchy (Course → Module → Lesson)
- Watchlist (save lessons for quick access)

### Profile & Reports
- My Report (30-day activity calendar, progress breakdown)
- Change password
- Refer & Earn (referral code + share)
- Help & Support (FAQ)

## Setup

### Prerequisites
- Node.js 18+
- Expo CLI
- Android Studio (for local builds)
- EAS CLI (for cloud builds)

### Installation

```bash
git clone <repo-url>
cd CodingKidaApps
npm install
```

### Environment

```bash
cp .env.example .env
# Edit .env with your API base URL
```

### Development (Expo Go — limited features)

```bash
npx expo start
```

### Development Build (full features including video)

```bash
npx expo prebuild --platform android --clean
npx expo run:android
```

### Production Build (EAS)

```bash
eas build --platform android --profile preview   # APK for testing
eas build --platform android --profile production # AAB for Play Store
```

## Backend Integration

This app connects to the existing CodingKida Next.js backend:
- Base URL: `https://www.codingkida.com`
- Authentication: JWT (Bearer token)
- Token storage: Expo SecureStore (encrypted)

## Architecture Decisions

- **Expo Router** (file-based) for navigation — scales with pages
- **TanStack Query** for server state — automatic caching, refetching
- **Zustand** for client state — lightweight, no boilerplate
- **Axios interceptors** — auto JWT attachment, 401 handling
- **expo-video** (not expo-av) — SDK 56 compatible, New Architecture support
- **pdf.js in WebView** — secure PDF rendering without external apps

## Security

- JWT tokens stored in SecureStore (encrypted at rest)
- No hardcoded secrets
- API calls via HTTPS only
- PDF viewer: no save/share/copy (in-app canvas rendering)
- Code evaluation: server-side only (Judge0 planned)
- Content Security Policy in app.json

## License

Private — CodingKida
