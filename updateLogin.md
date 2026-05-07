# Feature Update: Authentication & Admin Security (v1.1.0)

This document outlines the phase-wise and component-wise breakdown for adding Admin Login and Social/Email authentication.

## 1. Phase-Wise Roadmap

### Phase 1: Database & Security Foundation
*   Configure Supabase Auth providers (Google, Facebook, Email).
*   Setup `profiles` table for RBAC (Role-Based Access Control).
*   Enable Row Level Security (RLS) on existing tables.

### Phase 2: Backend Security Layer
*   Implement JWT verification middleware in `server.js`.
*   Create `requireAdmin` middleware to protect sensitive endpoints.
*   Update API endpoints to handle `user_id` context.

### Phase 3: Frontend Auth Integration
*   Initialize Supabase Auth in `script.js`.
*   Add Login/Signup UI (Modals & Nav updates).
*   Handle session persistence and protected routing.

---

## 2. Component-Wise Breakdown

### Component A: Supabase (Cloud Infrastructure)
- **Auth Providers:** Enable Google & Facebook (requires Client IDs) and Email/Password.
- **Tables:** 
    - `profiles`: `id` (uuid, fk to auth.users), `email`, `full_name`, `is_admin` (bool).
    - `reports`: Add `user_id` (uuid, fk to auth.users).
- **Policies:**
    - `reports`: `(auth.uid() = user_id)` for citizens.
    - `reports`: `(select is_admin from profiles where id = auth.uid())` for admins.

### Component B: Render (Backend - server.js)
- **Middleware:** `authenticateUser` - Decodes JWT from Authorization header.
- **Middleware:** `authorizeAdmin` - Checks `is_admin` flag in the `profiles` table.
- **Endpoints:**
    - `POST /api/reports`: Associate report with `req.user.id`.
    - `GET /api/reports`: Only accessible if `req.user.is_admin` is true.

### Component C: Frontend (Web Client)
- **UI Changes:**
    - Navbar: Add "Login" or "Profile/Logout" buttons.
    - Modals: Create `login-modal` with Social & Email options.
    - Admin Page: Add an "Access Denied" state for unauthorized users.
- **Logic Changes:**
    - Session listener: `supabase.auth.onAuthStateChange`.
    - Secure fetch: Attach `Bearer <token>` to all API requests.

---

## 3. Estimates
- **Time:** 7-12 Hours.
- **Cost:** $0 (utilizing Free Tiers of Supabase, Render, and Google Cloud).
