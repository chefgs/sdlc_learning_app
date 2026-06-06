# Deployment Troubleshooting Guide: Socratic Tutor Stack

This document contains a comprehensive directory of issues that might arise during the cloud deployment of your Python FastAPI backend, Vite Web UI, and Expo Mobile client, along with their root causes and verified fixes.

---

## 1. Backend Service & Containerization Issues (FastAPI / Cloud Run / App Runner)

| Error Code / Symptom | Root Cause | Remediation / Fix |
| :--- | :--- | :--- |
| **`WebSocket Connection Failed` (HTTP 400 / 502 Bad Gateway)** | The upstream proxy, CDN, or cloud load balancer is not forwarding `Upgrade: websocket` and `Connection: Upgrade` headers, or the gateway timeout is too short for persistent Socratic coaching sessions. | **1.** Ensure your load balancer/gateway has WebSockets explicitly enabled (on Google Cloud Run and AWS App Runner, WebSockets are supported automatically over port 443).<br>**2.** Extend the service's Request Timeout configuration (e.g., set the Cloud Run request timeout to `3600 seconds` instead of the default `300 seconds`) to prevent idle connections from closing prematurely. |
| **`Container Crashing on Startup` (CrashLoopBackOff / Port Binding)** | The FastAPI application is listening on `127.0.0.1` instead of `0.0.0.0`, or is ignoring the runtime `$PORT` environment variable injected by the cloud provider. | **1.** Confirm that Uvicorn starts with `--host 0.0.0.0` (which is already configured in the [Dockerfile](file:///Users/gsaravanan/.gemini/antigravity/scratch/sdlc_learning_app/backend/Dockerfile)).<br>**2.** In your deployment config, bind the launch port to the container's environment variable. Google Cloud Run expects the app to listen on the port defined by the `$PORT` environment variable (defaults to `8080` or `8000`). |
| **`401 Unauthorized / Gemini API Key Error`** | The `GEMINI_API_KEY` environment variable is either empty, missing, or was not successfully injected into the running container environment. | **1.** Verify that your shell env keys are loaded in Cloud Run/App Runner environment settings.<br>**2.** **Do not hardcode keys.** Inject the secret via AWS Secrets Manager or Google Secret Manager and bind it to the environment variable. |
| **`504 Gateway Timeout` (On quiz generation)** | The AI response generation is taking longer than the gateway's timeout threshold, or the rate limit on the Gemini model has been exceeded. | **1.** Check model throughput and scale limits.<br>**2.** Configure Uvicorn to run with multiple workers or ensure your application is using asynchronous calls (`async/await`) for all external calls. |

---

## 2. Web Frontend Issues (Vite / CDN / S3 / Vercel)

| Error Code / Symptom | Root Cause | Remediation / Fix |
| :--- | :--- | :--- |
| **`CORS Blocked (Cross-Origin Resource Sharing)`** | The backend is receiving requests from the new frontend URL but rejecting them because the frontend origin is not in the backend's allowed CORS origins list. | **1.** Locate `CORSMiddleware` in [backend/app.py](file:///Users/gsaravanan/.gemini/antigravity/scratch/sdlc_learning_app/backend/app.py).<br>**2.** Update `allow_origins` to include your exact deployed frontend URL (e.g. `https://your-frontend-app.vercel.app` or `https://d123456.cloudfront.net`). Do not use a trailing slash. |
| **`404 Page Not Found` on Refreshing Routes** | Static hosting services (like S3/CloudFront) look for a physical folder/file matching the URL (e.g., `/quiz`). If it doesn't exist, they throw a 404 because routing is handled client-side by Single Page Apps (SPA). | **1.** Configure your static host to rewrite all requests back to `/index.html`.<br>**2.** **Vercel**: Add a `vercel.json` with a rewrite rule (`"source": "/(.*)", "destination": "/index.html"`).<br>**3.** **CloudFront**: Add a Custom Error Response rule redirecting `404 Not Found` to `/index.html` with a `200 OK` status code. |
| **`Mixed Content Security Warning` (HTTP Blocked)** | The Web UI is hosted on a secure `https://` domain, but the Javascript code is trying to connect to the backend via insecure `http://` or `ws://` protocols. | **1.** Secure all API calls.<br>**2.** Change all API URLs to `https://` and WebSocket connections to `wss://` (WebSocket Secure). Modern browsers block mixed content by default. |

---

## 3. Mobile Client Issues (Expo / React Native / App Store)

| Error Code / Symptom | Root Cause | Remediation / Fix |
| :--- | :--- | :--- |
| **`Network Request Failed` (Android/iOS)** | The client is attempting to connect to an insecure server (`http://`) or is using a local IP that is no longer accessible outside your private Wi-Fi network. | **1.** Secure the backend with SSL. Both iOS (App Transport Security) and Android restrict HTTP connections by default.<br>**2.** Ensure the production app bundle uses the absolute `https://` / `wss://` domain of your deployed cloud backend, rather than a development computer's local IP address. |
| **`EAS Build Failures` (Missing Credentials / Code Signing)** | iOS builds require a valid Apple Developer Team ID and distribution certificates. Android builds require a keystore. If credentials are out of sync, the build fails. | **1.** Run `eas credentials` to review, generate, or repair credentials automatically.<br>**2.** Ensure your Apple/Google Developer Accounts are in active, paid standing. |
| **`OTA Update Mismatch` (App crashes after EAS Update)** | An Over-the-Air JS bundle update was pushed via `eas update`, but it references native modules or configurations that do not exist in the installed native shell. | **1.** Increment the `runtimeVersion` in `app.json` whenever you add a native plugin or update packages in `package.json`.<br>**2.** Ensure that JS-only changes are the only ones distributed via OTA updates. For native changes, perform a full store submission. |
