# SDLC Learning App: Build Automation Plan

We will add a **Build Automation Workflow** using **GitHub Actions** located at `/Users/gsaravanan/.gemini/antigravity/scratch/sdlc_learning_app/.github/workflows/build.yml`. 

This automates the compilation, packaging, and artifact generation of both the Web Frontend and the Mobile Expo app, allowing you to trigger releases manually or on release commits.

## Proposed Changes

We will create the following configuration file:

### Build Workflow Configuration

#### [NEW] [build.yml](file:///Users/gsaravanan/.gemini/antigravity/scratch/sdlc_learning_app/.github/workflows/build.yml)
*   A GitHub Actions pipeline containing two production packaging jobs:
    1.  **Web Bundle Packaging**: Sets up Node, installs packages, runs `npm run build`, and uploads the compiled production static directory (`frontend/dist/`) as a downloadable zip build artifact.
    2.  **Mobile Bundle Packaging**: Sets up Node, configures Expo/EAS credentials, and exports the static Metro bundle (`npx expo export`) as a downloadable mobile bundle artifact, or configures the hook for EAS Cloud builds.

---

## Verification Plan

### Manual Verification
1. Run a local syntax check on the build YAML structure.
2. Confirm the paths match the output folders in the local project workspace.
