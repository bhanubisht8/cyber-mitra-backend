# GEMINI.md - Project Context

## Project Overview
**UP Police Citizen Service & Incident Reporting Portal**: A web-based application designed for citizens to report incidents and track their status, with an administrative dashboard for police technical services.

## Project Type
**Status:** Stable Release (Full-Stack Architecture)
**Current Version:** `1.1.0-auth-stable`

## Current Structure
- `index.html`: Main structure, now includes Supabase JS SDK and Auth Modals.
- `auth.js`: New specialized module for session management and Supabase Auth logic.
- `script.js`: Frontend logic, updated to handle authenticated API calls with JWT headers.
- `ai-assistant.js`: Frontend AI chat logic, now sends auth headers for analysis tasks.
- `server.js`: Secure Node.js backend using Modern JWKS (ECC P-256) for token verification.
- `package.json`: Dependencies updated (added `jsonwebtoken` and `jwks-rsa`).

## Features
- **Unified Authentication:** Social (Google/Facebook) and Email/Password login via Supabase.
- **Admin Security:** Dashboard restricted to users with `is_admin: true` in the profiles table.
- **Modern Security:** Backend uses asymmetric ECC keys for token validation (No shared secrets).
- **Incident Reporting:** Linked to user accounts for personal tracking.

## AI Integration (Cyber Mitra)
The portal features a sophisticated AI integration powered by **Google Gemini 1.5 Flash**.
- **Architecture:** The API key is secured on a Node.js backend (hosted on Render) to prevent exposure and blacklisting.
- **Model:** Uses `gemini-flash-latest` for high speed and reliability.
- **Reliability:** Implemented **AI Retry Logic** to handle transient errors (429 Rate Limits and 503 Overloads) with exponential backoff.
- **User Side:**
    - **Chat Interface:** Provides assistance in Hindi/English via backend proxy.
    - **Auto-Categorization:** Detects incident type from user descriptions.
    - **Next Steps:** Generates immediate safety advice upon report submission.
- **Admin Side:**
    - **Urgency Assessment:** Automatically flags "High", "Medium", or "Low" priority based on incident severity.
    - **Executive Summary:** Generates concise 2-sentence summaries for investigating officers.
    - **Translation:** Translates non-English descriptions into English for standardized reporting.

## Database & Persistence
- **Technology:** Supabase (PostgreSQL).
- **Functionality:** Replaced `localStorage` with a persistent cloud database. Incident reports are now saved and retrieved via the backend API (`/api/reports`).

## API Endpoints (Backend)
- `GET /`: Health check (returns version).
- `POST /api/chat`: Handles Cyber Mitra chat conversations.
- `POST /api/reports`: Submits a new incident report.
- `GET /api/reports`: Retrieves all reports (Admin).
- `GET /api/reports/:id`: Retrieves a single report (Tracking).
- `POST /api/ai/analyze`: Proxy for specific AI tasks (Summary, Translation, etc.).

## Building and Running
*   **Backend:** 
    - Set environment variables: `GEMINI_API_KEY`, `SUPABASE_URL`, `SUPABASE_KEY`.
    - Run `npm install` and `npm start`.
*   **Frontend:** Open `index.html` (Ensure `BACKEND_URL` in `script.js` and `ai-assistant.js` points to your backend).

## Troubleshooting & Technical Insights

### 1. API Security & Blacklisting
**Problem:** Hardcoding the Gemini API key in the frontend led to it being blacklisted after hosting on GitHub Pages.
**Troubleshoot:** Migrated to a **Full-Stack Architecture**. The API key is now stored as an environment variable on Render, and the frontend communicates with a secure Node.js proxy.

### 2. Data Persistence (Beyond localStorage)
**Problem:** `localStorage` is browser-specific, meaning reports couldn't be shared across devices or seen by admins on different machines.
**Troubleshoot:** Integrated **Supabase** via the Express backend. All reports are now centralized in a PostgreSQL database.

### 3. UI Responsiveness vs. AI Latency
**Problem:** Waiting for AI to generate summaries/safety advice made the portal feel slow during report submission.
**Troubleshoot:** Decoupled the submission flow. The portal saves data to Supabase and shows the Success Modal immediately, while AI features are triggered as background `async` calls.

### 4. Language & Cultural Nuance
**Problem:** Standard AI responses were too formal or entirely in English.
**Troubleshoot:** Engineered a specific **System Instruction** for Cyber Mitra to use "Hinglish" and maintain an empathetic yet professional tone.
