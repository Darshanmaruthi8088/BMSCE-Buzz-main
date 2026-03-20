# BMSCE-Buzz (Expo React Native)

This repository is now a native React Native mobile app using Expo, while keeping the same Firebase backend, authentication flow, and Firestore data model.

## 1. Setup

1. Install dependencies:
   - `npm install`
2. Copy environment file:
   - `cp .env.example .env` (or create `.env` manually on Windows)
3. Fill Firebase values in `.env` (same keys are used):
   - `REACT_APP_FIREBASE_API_KEY`
   - `REACT_APP_FIREBASE_AUTH_DOMAIN`
   - `REACT_APP_FIREBASE_PROJECT_ID`
   - `REACT_APP_FIREBASE_STORAGE_BUCKET`
   - `REACT_APP_FIREBASE_MESSAGING_SENDER_ID`
   - `REACT_APP_FIREBASE_APP_ID`

## 2. Run App

- Start Expo:
  - `npx expo start`
- Run Android:
  - `npm run android`
- Run iOS:
  - `npm run ios`
- Run web preview:
  - `npm run web`

## 3. Structure

- `App.js`
- `navigation/`
- `screens/`
- `components/`
- `services/`
- `contexts/`
- `assets/`

## 4. Notes

- Backend logic, Firebase collections, and auth checks are preserved.
- Firestore subscriptions remain for `news`, `users`, and `notifications`.
- Role-based flows (`user`/`admin`) are preserved.
- Push token registration is wired through Expo Notifications.
