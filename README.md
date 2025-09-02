# 🐍 Snake Game (Static + Firebase)

[English version below](#english)

Играть онлайн: https://game-zmeika-lilac.vercel.app

Современная «Змейка» с таблицей лидеров в реальном времени, показом онлайн‑игроков, мобильным управлением, анимациями GSAP, бонус‑едой и двуязычным интерфейсом (RU/EN).

## Особенности

- Интерфейс и графика
  - Адаптивный дизайн (десктоп и мобильные)
  - Экранные кнопки управления (touch‑friendly)
  - Частицы, свечение еды, всплывающие очки, пауза с оверлеем
  - Переключатель языка (русский/английский)

- В реальном времени
  - Таблица лидеров (лучший результат на пользователя)
  - Онлайн‑присутствие игроков (статус playing/idle)
  - Firebase Realtime Database (клиент‑сайд)

## Как играть

- ПК: стрелки; пробел — пауза
- Мобильные: экранные стрелки; виброотклик при событиях
- Красная еда: +1; золотой бонус: +5 и кратковременное замедление

## Структура проекта

- `public/` — исходники (ES‑модули)
  - `index.html` — оболочка UI + выбор языка
  - `style.css` — стили (адаптив, мобильные, анимации)
  - `game.js` — основной цикл, управление, эффекты
  - `snake.js`, `food.js`, `bonusFood.js`, `particles.js`, `scoreManager.js`
  - `leaderboardManager.js`, `onlinePlayersManager.js` — логика Firebase
  - `firebaseConfig.js` — Firebase app, анонимная auth, база
  - `i18n.js` — простой помощник для i18n
- `dist/` — билд (копия `public/`)

## Локальный запуск

1) Установить зависимости (опционально):
```bash
npm install
```
2) Сборка статики:
```bash
npm run build
```
3) Запуск локального сервера:
```bash
npx serve dist
# или
python3 -m http.server 5173 -d dist
```
Откройте адрес из вывода (в одной сети можно открыть и с телефона).

## Настройка Firebase

1) Создайте проект в Firebase Console
2) Включите Realtime Database (рекомендуется регион `europe-west1`) и Анонимную авторизацию:
   - Authentication → Sign‑in method → Anonymous → Enable
3) Скопируйте Web SDK config (Project settings → Your apps → Web) в `public/firebaseConfig.js`
4) Правила БД (Realtime Database → Rules):
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
5) Готово: откройте приложение, введите имя — результаты и онлайн‑статус будут сохраняться по вашему `uid`.

## Деплой на Vercel

- Подключите репозиторий к Vercel
- Settings → Build & Output
  - Build Command: `npm run build`
  - Output Directory: `dist`
- Пуш в `main` → автодеплой на https://game-zmeika-lilac.vercel.app

---

## English

Play online: https://game-zmeika-lilac.vercel.app

Modern Snake with a realtime leaderboard, online presence, mobile controls, GSAP animations, bonus food, and bilingual UI (EN/RU).

### Features

- UI/UX
  - Responsive layout (desktop + mobile)
  - On‑screen mobile controls (touch friendly)
  - Particles, glow food, floating scores, pause overlay
  - Language switcher (English/Russian)

- Realtime
  - Leaderboard (best score per user)
  - Online presence (playing/idle)
  - Firebase Realtime Database (client‑side only)

### How to Play

- Desktop: Arrow keys; Space to pause
- Mobile: On‑screen arrows; vibration feedback
- Red food: +1; golden bonus: +5 with short slow‑down

### Project Structure

- `public/` — source (ES modules): `index.html`, `style.css`, `game.js`, `snake.js`, `food.js`, `bonusFood.js`, `particles.js`, `scoreManager.js`, `leaderboardManager.js`, `onlinePlayersManager.js`, `firebaseConfig.js`, `i18n.js`
- `dist/` — build output (copied from `public/`)

### Local Run

```bash
npm install
npm run build
npx serve dist
# or
python3 -m http.server 5173 -d dist
```

### Firebase Setup

1) Create a Firebase project
2) Enable Realtime Database (prefer `europe-west1`) and Anonymous auth
3) Add Web SDK config into `public/firebaseConfig.js`
4) Rules (Realtime Database → Rules): see JSON above
5) Open the app, enter a name — data is stored by your `uid`

### Deploy (Vercel)

- Connect repo → set Build Command `npm run build`, Output `dist`
- Push to main → deploys to https://game-zmeika-lilac.vercel.app

