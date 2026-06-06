# Socratic SDLC Tutor & AI Product Decision Center

Welcome to the AI App Development Learning App! This repository contains a complete, production-grade workspace built specifically for beginners to master secure, scalable software development lifecycles (SDLC) using **Saravanan Gnanaguru's first principles** and his work on **DevOps-OS** (`cloudengine-labs/devops_os`).

This master document details the repository directory structure, the purpose of each file, and how to execute test runs, container builds, and local development servers.

---

## 1. Project Directory & File Guide

```
sdlc_learning_app/
├── .github/
│   └── workflows/
│       ├── ci.yml             # GitHub Actions CI pipeline configuration
│       └── build.yml          # GitHub Actions build packaging configuration
├── backend/
│   ├── app.py                 # FastAPI backend utilizing google-antigravity
│   ├── test_app.py            # Backend unit tests using pytest
│   ├── requirements.txt       # Python package dependencies list
│   └── Dockerfile             # Multi-stage container compilation target
├── docs/                      # Comprehensive project documentation & guides
│   ├── analysis_results.md
│   ├── cloud_deployment_guide.md
│   ├── deployment_troubleshooting.md
│   ├── implementation_plan.md
│   ├── learning_app_roadmap.md
│   ├── mobile_packaging_guide.md
│   ├── prompt_engineering_guide.md
│   ├── showcase_development_guide.md
│   ├── task.md
│   ├── test_report_summary.md
│   └── walkthrough.md
├── frontend/
│   ├── index.html             # Accessible dark-mode web layout
│   ├── style.css              # Premium CSS variables and animations
│   ├── app.js                 # WebSocket client and quiz UI coordinator
│   ├── package.json           # Vite and Puppeteer configuration
│   └── tests/
│       └── e2e.js             # Puppeteer browser UI E2E test script
├── mobile/
│   ├── App.tsx                # Expo React Native mobile application main code
│   ├── app.json               # Expo metadata (name, slug, icons)
│   ├── package.json           # Expo dependency list and ts check triggers
│   ├── tsconfig.json          # TypeScript configurations for Expo
│   └── README.md              # Beginner onboarding guide for Expo Go
├── mobile_integration.md      # API connection specifications for mobile clients
└── README.md                  # This master repository guide
```

### Detailed Source File Breakdown

#### Backend Tier (`/backend`)
1.  **`app.py`**: The core API service built with FastAPI. It launches the Socratic tutor persona using the Google Antigravity SDK, serves dynamically generated JSON quizzes via Pydantic model validation (`response_schema`), and exposes WebSockets `/ws/tutor` to stream agent thoughts and replies.
2.  **`test_app.py`**: A python test file running `pytest`. It asserts that the API endpoints are active, checks WebSocket handshake connections, and verifies that the generated quiz conforms to the Pydantic schema structure.
3.  **`requirements.txt`**: Lists python packages required by the backend (`fastapi`, `uvicorn`, `pydantic`, `pytest`, `httpx`, `websockets`).
4.  **`Dockerfile`**: A multi-stage compiler config that packages the python backend into a lightweight container.

#### Web Frontend Tier (`/frontend`)
1.  **`index.html`**: A semantic HTML5 file detailing the e-learning panels, quiz card modules, metrics boards, and chat consoles.
2.  **`style.css`**: Vanilla CSS stylesheet defining a deep space theme, frosted glass cards, glow effects, progress track adjustments, and correct/incorrect alert animations.
3.  **`app.js`**: Core client script that handles WebSocket frames, parses incoming streamed thoughts, appends reply tokens, and fetches quizzes.
4.  **`package.json`**: Bundles the web frontend under `vite` (v6.4.2) for package management and configures `puppeteer` to execute end-to-end tests.
5.  **`tests/e2e.js`**: An E2E test script using Puppeteer to run a headless Chromium browser, navigate to the web client, mock REST APIs, and verify that elements click and render Socratic feedback correctly.

#### Mobile Tier (`/mobile`)
1.  **`App.tsx`**: A single-file React Native dashboard containing a tabbed navigation system. Implements Socratic chat, streaming thought accordions, local quiz rendering, and the **AI Product Decision Framework Checklist**.
2.  **`app.json` & `package.json`**: Defines app metadata and dependency packages. Overrides are set to patch sub-dependency vulnerabilities (reducing active vulnerabilities to 0).
3.  **`tsconfig.json`**: TypeScript compiler compiler configurations.
4.  **`README.md`**: Guide explaining how to run the app using the **Expo Go** app on your physical phone.

#### Core Configuration & Specifications
1.  **`ci.yml`**: GitHub Actions continuous integration scripts that run Python pytest, Web Vite builds, and Mobile type checks on every code commit.
2.  **`mobile_integration.md`**: Architectural reference documentation containing connection templates in Swift (iOS) and TypeScript (React Native) for mobile developers.

---

## 2. Setting Up Your Development Workspace

For the best experience, open the directory `/Users/gsaravanan/.gemini/antigravity/scratch/sdlc_learning_app` directly in your code editor workspace.

### Core Prerequisite Environment Variables
Before running the backend, obtain a Gemini API key and set it in your terminal:
```bash
export GEMINI_API_KEY="your-gemini-api-key-here"
```

---

## 3. Running & Verifying Each Tier

### A. Python Backend
Create a virtual environment, install requirements, and run the FastAPI server:
```bash
python3 -m venv venv
./venv/bin/pip install --upgrade pip
./venv/bin/pip install -r backend/requirements.txt
./venv/bin/uvicorn backend.app:app --reload --port 8000
```
Verify unit tests pass successfully:
```bash
./venv/bin/pytest backend/test_app.py
```

### B. Web Frontend (Vite)
Navigate to the `frontend/` directory, install packages, and launch Vite dev server:
```bash
cd frontend
npm install
npm run dev
```
Execute Puppeteer E2E browser checks:
```bash
npm run test:e2e
```
Compile production optimized bundles:
```bash
npm run build
```

### C. Mobile Client (Expo)
Navigate to the `mobile/` directory, install packages, and launch the bundler:
```bash
cd mobile
npm install
npx expo start
```
*Scan the generated QR Code on your iPhone or Android using the **Expo Go** application to test on your phone.*

---

## 4. Building & Running Containers

To compile the backend container, execute:
```bash
docker build -t sdlc-learning-app ./backend
```
Run the container locally:
```bash
docker run -p 8000:8000 --env GEMINI_API_KEY=$GEMINI_API_KEY sdlc-learning-app
```

---

## 5. Project Documentation & Reference Guides

A variety of comprehensive design and implementation guides are available in the [docs/](file:///Users/gsaravanan/.gemini/antigravity/scratch/sdlc_learning_app/docs) directory:

*   [Developer Showcase & Code Guide](file:///Users/gsaravanan/.gemini/antigravity/scratch/sdlc_learning_app/docs/showcase_development_guide.md): Comprehensive review of codebase features, architectural design decisions, and engineering best practices.
*   [Prompt & Context Engineering Guide](file:///Users/gsaravanan/.gemini/antigravity/scratch/sdlc_learning_app/docs/prompt_engineering_guide.md): Details of the system instructions, Pydantic constraints, and context structures used.
*   [Roadmap & Core Principles](file:///Users/gsaravanan/.gemini/antigravity/scratch/sdlc_learning_app/docs/learning_app_roadmap.md): Overview of the educational curriculum mapped to Saravanan Gnanaguru's first principles.
*   [Mobile Packaging Guide](file:///Users/gsaravanan/.gemini/antigravity/scratch/sdlc_learning_app/docs/mobile_packaging_guide.md): Details on building mobile binaries (`.apk` / `.aab` / `.ipa`) using Expo EAS Build and submitting them to the Google Play and Apple App Stores.
*   [Cloud Deployment Guide](file:///Users/gsaravanan/.gemini/antigravity/scratch/sdlc_learning_app/docs/cloud_deployment_guide.md): Detailed steps for deploying the FastAPI backend to Google Cloud Run/AWS App Runner, and the Vite Web UI to CDNs.
*   [Deployment Troubleshooting](file:///Users/gsaravanan/.gemini/antigravity/scratch/sdlc_learning_app/docs/deployment_troubleshooting.md): Common deployment errors, root causes, and verified fixes across all tiers.
*   [Test Report Summary](file:///Users/gsaravanan/.gemini/antigravity/scratch/sdlc_learning_app/docs/test_report_summary.md): Summary of unit and end-to-end test coverage.
*   [Analysis & Architectural Breakdown](file:///Users/gsaravanan/.gemini/antigravity/scratch/sdlc_learning_app/docs/analysis_results.md): High-level feature analysis and specifications for the Antigravity SDK implementation.
*   [Task List](file:///Users/gsaravanan/.gemini/antigravity/scratch/sdlc_learning_app/docs/task.md) & [Implementation Plan](file:///Users/gsaravanan/.gemini/antigravity/scratch/sdlc_learning_app/docs/implementation_plan.md): The project execution checklist and blueprint.
