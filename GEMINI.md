# GEMINI.md - Project Context

## Project Overview
**UP Police Citizen Service & Incident Reporting Portal**: A web-based application designed for citizens to report incidents and track their status, with an administrative dashboard for police technical services.

## Project Type
**Status:** Functional Prototype (Full-Stack Architecture)

## Current Structure
- `index.html`: Main structure of the application.
- `script.js`: Frontend logic, now communicates with the Node.js backend.
- `ai-assistant.js`: Frontend AI chat interface logic.
- `server.js`: Secure Node.js/Express backend (handles AI proxying and DB).
- `package.json`: Backend dependencies and scripts.
- `style.css`: Professional government-themed styling.
- `logo.png`: Local official logo image.

## Features
- **Incident Reporting:** Form for citizens to submit details with AI-powered auto-categorization.
- **Cyber Mitra AI Assistant:** Real-time Hinglish-speaking chatbot to guide citizens and categorize incidents.
- **Status Tracking:** Search functionality to track reports using a unique Complaint ID.
- **Admin Dashboard:** Management view with AI insights (Priority assessment, Executive Summary, and Translation).
- **Responsive Design:** Mobile-friendly navigation and layout.

## AI Integration (Cyber Mitra)
The portal features a sophisticated AI integration powered by **Google Gemini 1.5 Flash**.
- **Architecture:** The API key is secured on a Node.js backend (hosted on Render) to prevent exposure and blacklisting.
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
- **Functionality:** Replaced `localStorage` with a persistent cloud database. Incident reports are now saved and retrieved via the backend API, allowing data to persist across sessions and devices.

## Building and Running
*   **Backend:** 
    - Set environment variables: `GEMINI_API_KEY`, `SUPABASE_URL`, `SUPABASE_KEY`.
    - Run `npm install` and `npm start`.
*   **Frontend:** Open `index.html` (Update the API URL in the scripts to point to your backend).

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
