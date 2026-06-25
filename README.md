# Study Sphere

A complete, production-ready full-stack AI study companion consisting of three
applications that share a single API contract:

| App        | Stack                                             | Purpose                       |
|------------|---------------------------------------------------|-------------------------------|
| `backend`  | Node.js + Express                                 | Secure API + AI provider proxy |
| `frontend` | Next.js 14 (App Router) + TypeScript              | Web client (deploys to Vercel) |
| `android`  | Kotlin + Jetpack Compose + Hilt + Room + Retrofit | Native Android client          |

## Key Security Principle

Clients (web & Android) **never** talk to AI providers directly and **never**
hold provider API keys. Every AI request flows:

```
Client App  →  Backend  →  AI Provider  →  Backend  →  Client App
```

The UI only ever shows two plans:

- **Study Sphere Lite**
- **Study Sphere Pro**

Provider names (Groq, OpenAI, etc.) and API keys live exclusively in backend
environment variables and are stripped from every API response.

## Repository Structure

```
root/
├── frontend/            # Next.js web app (Vercel)
├── backend/             # Express API server
├── android/             # Kotlin + Jetpack Compose app
├── docs/                # API contract, deployment & setup guides
├── .github/workflows/   # CI/CD pipelines
└── README.md
```

## Features

- Login & Register (JWT auth, bcrypt hashing)
- Chat with AI (streamed via backend proxy)
- Chat history with session persistence
- Profile & Settings (editable name, default model)
- AI model selection (Lite / Pro plans, fetched dynamically)
- Light / Dark theme switching
- Offline cache (Room on Android) & session persistence (DataStore / localStorage)
- Discord-like sidebar, smooth animations, responsive Material 3 UI

## Architecture (Android)

- **MVVM** with `ViewModel` + `StateFlow`
- **Repository pattern** over Retrofit (network) + Room (cache)
- **Hilt** dependency injection
- **Navigation Compose** for screen routing
- **Coroutines** for async work
- **Material 3** theming with light/dark schemes

## Quick Start

### 1. Backend

```bash
cd backend
cp .env.example .env       # fill in JWT_SECRET and provider keys
npm install
npm run dev                # http://localhost:8080
```

### 2. Frontend

```bash
cd frontend
cp .env.example .env.local # set NEXT_PUBLIC_API_BASE_URL=http://localhost:8080/api
npm install
npm run dev                # http://localhost:3000
```

### 3. Android

Open the `android/` folder in **Android Studio Hedgehog+**.
The debug build points at `http://10.0.2.2:8080/api/` (the emulator's alias for
your host machine). Press **Run**.

Or from the command line:

```bash
cd android
./gradlew assembleDebug     # builds app/build/outputs/apk/debug/app-debug.apk
./gradlew assembleRelease   # builds unsigned release APK
./gradlew testDebugUnitTest # runs unit tests
./gradlew lintDebug         # runs lint
```

## Documentation

- [API Contract](docs/API.md)
- [Deployment Guide](docs/DEPLOYMENT.md)
- [Environment Setup](docs/ENVIRONMENT.md)

## CI/CD

> **Note:** The ready-to-use GitHub Actions workflow files are stored in
> [`docs/ci-workflows/`](docs/ci-workflows/). To activate them, copy them into
> `.github/workflows/` (this must be done by a user/token with the `workflows`
> permission — automated App pushes cannot create workflow files directly):
>
> ```bash
> mkdir -p .github/workflows
> cp docs/ci-workflows/*.yml .github/workflows/
> git add .github/workflows && git commit -m "Enable CI workflows" && git push
> ```

GitHub Actions workflows (`docs/ci-workflows/`):

- `backend.yml` — install, lint, test
- `frontend.yml` — install, lint, build (fails on type errors)
- `android.yml` — lint, unit tests, build debug APK, build release APK

All workflows fail on compilation errors, lint violations, missing dependencies
and unresolved references.

## License

MIT
