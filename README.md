# 🐍 Snake Game (Static + Firebase)

Modern Snake with realtime leaderboard, online presence, mobile controls, GSAP animations, bonus food and bilingual UI (EN/RU).

## Features

- UI/UX
  - Responsive layout for desktop and mobile
  - Mobile on-screen controls (touch friendly)
  - Particles, glow food, floating scores, pause overlay
  - Language switcher (English/Russian)

- Realtime
  - Leaderboard (best score per user)
  - Online players presence with play/idle status
  - Firebase Realtime Database (client-side only)

## Project Structure

- `public/` — source files (ES modules)
  - `index.html` — UI shell + language selector
  - `style.css` — styles (responsive, mobile, animations)
  - `game.js` — main loop, controls, effects
  - `snake.js`, `food.js`, `bonusFood.js`, `particles.js`, `scoreManager.js`
  - `leaderboardManager.js`, `onlinePlayersManager.js` — Firebase logic
  - `firebaseConfig.js` — Firebase app, auth (anonymous), database
  - `i18n.js` — simple i18n helper
- `dist/` — build output (copied from `public/`)

## Local Run

1) Install deps (optional, build script only):
```bash
npm install
```

2) Build static files:
```bash
npm run build
```

3) Serve `dist/` locally:
```bash
npx serve dist
# or
python3 -m http.server 5173 -d dist
```
Open the printed URL in your browser.

## Firebase Setup

1) Create a Firebase project (Console → Create project)
2) Enable Realtime Database (prefer region `europe-west1`) and Anonymous Auth:
   - Authentication → Sign-in method → Anonymous → Enable
3) Get your Web SDK config (Project settings → Your apps → Web) and paste into `public/firebaseConfig.js`.
4) Database Rules (paste into Realtime Database → Rules):
```json
{
  "rules": {
    ".read": true,
    "online": {
      "$uid": {
        ".write": "auth != null && auth.uid === $uid",
        ".validate": "newData.hasChildren(['username','lastActive','isPlaying'])"
      }
    },
    "leaderboard": {
      "$uid": {
        ".write": "auth != null && auth.uid === $uid",
        "score": { ".validate": "newData.isNumber() && newData.val() >= 0" },
        "username": { ".validate": "newData.isString() && newData.val().length > 0 && newData.val().length <= 15" },
        "date": { ".validate": "newData.isString()" },
        "lastActive": { ".validate": "newData.isNumber() || newData.val() == now" }
      }
    }
  }
}
```
Anonymous auth is initialized in `firebaseConfig.js`. The app stores leaderboard entries and presence by uid.

### Настройка Firebase (RU)

1) Создайте проект в Firebase Console → Create project
2) Включите Realtime Database (лучше регион `europe-west1`) и анонимную авторизацию:
   - Authentication → Sign-in method → Anonymous → Enable
3) Получите Web SDK config (Project settings → Your apps → Web) и вставьте в `public/firebaseConfig.js`.
4) Задайте правила БД (Realtime Database → Rules):
```json
{
  "rules": {
    ".read": true,
    "online": {
      "$uid": {
        ".write": "auth != null && auth.uid === $uid",
        ".validate": "newData.hasChildren(['username','lastActive','isPlaying'])"
      }
    },
    "leaderboard": {
      "$uid": {
        ".write": "auth != null && auth.uid === $uid",
        "score": { ".validate": "newData.isNumber() && newData.val() >= 0" },
        "username": { ".validate": "newData.isString() && newData.val().length > 0 && newData.val().length <= 15" },
        "date": { ".validate": "newData.isString()" },
        "lastActive": { ".validate": "newData.isNumber() || newData.val() == now" }
      }
    }
  }
}
```
5) Готово: откройте приложение, введите имя → результаты и онлайн‑статус будут сохраняться по вашему `uid`.

## Deploy (Vercel)

- Connect the repo to Vercel
- Settings → Build & Output
  - Build Command: `npm run build`
  - Output Directory: `dist`
- Push to main → auto deploy

## How to Play

- Desktop: Arrow keys, Space for pause
- Mobile: On-screen arrows (tap), pause overlay with Space if keyboard present
- Eat red food (+1), collect golden bonus (+5, temporary slow-down)

## Notes (RU)

Интерфейс поддерживает переключение языка (EN/RU). Результаты и онлайн‑статус сохраняются в Firebase Realtime Database по `uid` (анонимная авторизация включена). Для продакшна примените правила БД выше.
