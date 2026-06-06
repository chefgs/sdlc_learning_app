# Cloud Deployment Guide: SDLC Learning App

This guide details the steps to deploy each component of the Socratic SDLC Tutor stack (FastAPI Backend, Vite Web Frontend, and Expo Mobile Client) on standard cloud hosting platforms.

---

## 1. Deploying the Python FastAPI Backend (Agentic Service)

The backend microservice runs the Google Antigravity SDK and handles WebSockets. It requires an environment that can run Python and maintain persistent TCP WebSocket connections.

### Option A: Google Cloud Run (Recommended)
Google Cloud Run is highly suitable because it runs containerized code, scales to zero when inactive (saving money), and handles WebSocket streams out-of-the-box.

1.  **Configure Container**: Ensure the `Dockerfile` in `/backend` is ready (already built in your workspace).
2.  **Submit Image**: Build and submit the image to Google Artifact Registry:
    ```bash
    gcloud builds submit --tag gcr.io/your-project-id/sdlc-backend ./backend
    ```
3.  **Deploy to Cloud Run**:
    ```bash
    gcloud run deploy sdlc-backend \
      --image gcr.io/your-project-id/sdlc-backend \
      --platform managed \
      --port 8000 \
      --set-env-vars GEMINI_API_KEY="your-api-key" \
      --allow-unauthenticated
    ```

### Option B: AWS App Runner (Easy AWS Setup)
AWS App Runner provides fully managed container deployments without needing complex ECS configurations.

1.  Push your backend repository to GitHub.
2.  Open the **AWS App Runner** Console, click **Create Service**, and link it to your repository.
3.  Set the **Runtime** to `Python 3` (or choose `Container Image` and point to an ECR repository).
4.  Configure:
    *   **Port**: `8000`
    *   **Start Command**: `uvicorn app:app --host 0.0.0.0 --port 8000`
    *   **Environment Variables**: Add `GEMINI_API_KEY` securely.

---

## 2. Deploying the Web Frontend (Vite)

Because `npm run build` compiles your Vite project into standard static files (`index.html`, CSS, and JS) inside `/frontend/dist/`, you can host it on static CDNs, which are fast and cost next to nothing.

### Option A: Vercel / Netlify (Developer Friendly)
1.  Connect your GitHub repository to **Vercel** or **Netlify**.
2.  Configure the project root:
    *   **Framework Preset**: `Vite`
    *   **Root Directory**: `frontend`
    *   **Build Command**: `npm run build`
    *   **Output Directory**: `dist`
3.  Click **Deploy**. The platform will compile and host the app, providing an SSL-secured custom URL.

### Option B: AWS S3 & CloudFront (Enterprise)
1.  Create an **S3 Bucket** (e.g. `sdlc-learning-app-web`) and enable **Static Website Hosting**.
2.  Build the assets locally and upload the `/dist` contents:
    ```bash
    cd frontend && npm run build
    aws s3 sync dist/ s3://sdlc-learning-app-web
    ```
3.  Create a **CloudFront Distribution** pointing to your S3 website endpoint. This guarantees caching, CDN distribution, and SSL/HTTPS.

---

## 3. Submitting the Mobile App (Expo)

Once you compile the binary artifacts via Expo EAS (`.aab` for Android, `.ipa` for iOS), you can submit them to the stores. Expo provides a submission tool called **EAS Submit** to automate the upload process directly from your command line.

### Step 1: Submit to Apple App Store (TestFlight)
Ensure you have created a developer account at [developer.apple.com](https://developer.apple.com/).
Run the command inside `/mobile`:
```bash
eas submit --platform ios
```
*Expo will ask for your Apple ID, generate the App Store credentials securely, and upload the `.ipa` package directly to App Store Connect. You can then distribute it to testers via **TestFlight**.*

### Step 2: Submit to Google Play Store
Ensure you have a Play Console developer account at [play.google.com/console](https://play.google.com/console/).
1.  Export your Google Play Service Account Key JSON.
2.  Configure the path in `/mobile/eas.json` under `submit.production.android.serviceAccountKeyPath`.
3.  Run the submission command:
    ```bash
    eas submit --platform android
    ```
*Expo will upload your `.aab` file directly to the Google Play Console internal testing track.*
