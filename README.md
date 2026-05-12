# hacker-directory-frontend

# Frontend Hacker Directory To My Digital Guestbook API
Hi, this is a member management system featuring a retro-future terminal interface! It allows users to create a profile with a secure passkey, view others' profiles, or search for a specific user. You can also delete a profile you made using your secure passkey - preventing anyone but you from accessing your own profiles.

## Live Link
Live Terminal (Frontend):(https://kg-09-creator.github.io/hacker-directory-frontend/)
**API Mainframe (Backend):** (https://kgs-guestbook-api.onrender.com)

 ## Tech Stack
- **Backend:** Python, FastAPI, Uvicorn (Hosted on Render)
- **Frontend:** HTML5, CSS3 (Matrix Rain Canvas), Vanilla JavaScript (Hosted on GitHub Pages)
- **Time Tracking:** Logged via Hackatime

Features
- **Secure Purge Protocol:** Profiles are protected by a `SECRET_PASSKEY`. Only the creator can delete their entry.
- **Real-Time Dashboards:** 
    - `SYSTEM_VIBE`: An endpoint that analyzes the directory status.
    - `MEMBERS_SYNCED`: A live counter of active hacker connections.
- **Matrix Rain UI:** Immersive CSS/Canvas animation for the ultimate hacker aesthetic.
- **RESTful Architecture:** 5 GET endpoints and secure POST/DELETE handling.
