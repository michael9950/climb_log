# ClimbLog

ClimbLog is a simple climbing session tracker that helps users record their gym visits, grades, condition, and notes. The app can store data in Firebase Firestore when Firebase environment variables are configured, and falls back to local browser storage during local setup.

## Features

- Add climbing sessions with date, gym name, duration, highest grade, condition, and notes.
- Attach a climbing problem video to a session with Firebase Storage.
- View saved sessions sorted by newest date first.
- Edit saved session details.
- Delete sessions from the log.
- Track total sessions, current-month visits, highest grade, and average condition.
- Persist data with Firebase Firestore.
- Fall back to `localStorage` when Firebase is not configured.

## Tech Stack

- React
- Tailwind CSS
- Firebase Firestore
- Firebase Storage
- LocalStorage fallback
- Vite
- Vercel-ready static build

## Getting Started

```bash
npm install
npm run dev
```

## Firebase Setup

Create a Firebase project, enable Cloud Firestore, Firebase Authentication, and Firebase Storage, then copy `.env.example` to `.env.local`.

```bash
cp .env.example .env.local
```

Fill in the values from Firebase Console > Project settings > Your apps > Web app config:

```bash
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
```

The app stores climbing logs in a Firestore collection named `sessions`.

Each session document uses this shape:

```js
{
  date: "2026-05-17",
  gym: "The Climb Hongdae",
  duration: 90,
  grade: "V5",
  condition: 4,
  memo: "Sent the slab project.",
  userId: "firebase-auth-uid",
  userEmail: "user@example.com",
  userName: "Alex",
  videoUrl: "https://firebasestorage.googleapis.com/...",
  videoPath: "session-videos/firebase-auth-uid/...",
  videoName: "project-send.mp4",
  videoSize: 12345678,
  videoContentType: "video/mp4",
  createdAt: "2026-05-17T07:00:00.000Z"
}
```

## Authentication Setup

In Firebase Console, open Authentication > Sign-in method and enable Email/Password.

ClimbLog supports:

- Email/password sign up
- Login and logout
- Display name updates
- Account deletion
- User-owned climbing logs

## Firestore Rules

For a logged-in app, use rules like this so each user can only read and edit their own logs:

```js
rules_version = '2';

service cloud.firestore {
  match /databases/{database}/documents {
    match /sessions/{sessionId} {
      allow read: if request.auth != null
        && resource.data.userId == request.auth.uid;

      allow create: if request.auth != null
        && request.resource.data.userId == request.auth.uid;

      allow update, delete: if request.auth != null
        && resource.data.userId == request.auth.uid;
    }
  }
}
```

The public feed feature can be added later by introducing a `visibility` field and allowing reads for public logs.

## Storage Setup

In Firebase Console, open Storage and create a default bucket. Firebase's current Cloud Storage setup may require the pay-as-you-go Blaze plan before a bucket can be created or used.

The app uploads videos to:

```text
session-videos/{userId}/{timestamp-fileName}
```

Use Storage rules like this to let users read, upload, and delete only their own session videos. The app limits video selection to 200MB in the UI, and these rules enforce the same limit in Firebase Storage.

```js
rules_version = '2';

service firebase.storage {
  match /b/{bucket}/o {
    match /session-videos/{userId}/{fileName} {
      allow read, delete: if request.auth != null
        && request.auth.uid == userId;

      allow create: if request.auth != null
        && request.auth.uid == userId
        && request.resource.size < 200 * 1024 * 1024
        && request.resource.contentType.matches('video/.*');
    }
  }
}
```

## Build

```bash
npm run build
```

The production output is generated in `dist/`.

## Deploy to Vercel

Import this repository in Vercel and use the default Vite settings:

- Build command: `npm run build`
- Output directory: `dist`
