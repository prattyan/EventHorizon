# EventHorizon 

**EventHorizon** is a state-of-the-art, full-stack event management platform designed to deliver a premium experience for both organizers and attendees. Blending stunning aesthetics with powerful functionality, it offers a seamless workflow from event creation to real-time attendance tracking.

---

## ✨ Key Features

### 🔐 Auth & Security
- **Multi-Factor Authentication**: Secure login via Email/Password, Google Auth, or Phone (OTP).
- **Account Security**: Sensitive actions like account deletion are protected by OTP verification (`recaptcha-verifier`).
- **Role-Based Access**: Distinct portals for **Organizers** (Management) and **Attendees** (Discovery).

### 📅 Advanced Event Management
- **AI-Powered Creation**: Integrated **Google Gemini** to generate professional event descriptions and titles instantly.
- **Flexible Registration Models**:
  - **Individual**: Standard single-user registration.
  - **Team-Based**: Create teams, generate invite codes, and manage groups.
- **Custom Questionnaires**: Create dynamic forms with text, multiple-choice, or yes/no questions for applicants.
- **Collaborators**: Invite other organizers to help manage specific events.
- **Smart Dashboard**: Real-time analytics on views, registrations, and revenue.

### 🎫 Attendee Experience
- **Interactive Discovery**:
  - **AI Recommendations**: Personalized event suggestions based on past activity.
  - **Live Updates**: Real-time status for "Selling Fast" or "Live Now" events.
- **Digital Ticketing**:
  - **Holographic Tickets**: Beautiful, downloadable QR tickets.
  - **Wallet Support**: (Planned) Integration for mobile wallets.
- **Social Features**:
  - **Reviews & Ratings**: Rate events and leave detailed feedback.
  - **Team Coordination**: Join teams via unique invite codes.

### 📱 Performance & Tools
- **PWA Ready**: Installable as a native app with offline capabilities (Service Workers).
- **Image Processing**: Built-in high-performance image cropper (`react-easy-crop`) for perfect event banners.
- **Real-Time Sockets**: Instant notifications for approvals, new messages, and status changes via `Socket.io`.

---

### 🛠️ Tech Stack

### 🚀 Google Technologies
- **Generative AI**: `gemini-2.5-flash` utilized for:
  - **Content Creation**: Auto-generating marketing copy and agendas for events.
  - **Recommender System**: Analyzing vector similarites (logic) between user history and upcoming events.
- **Firebase**:
  - **Authentication**: Robust identity management including Phone Auth (OTP) and Social Login (Google).
  - **Security**: Recaptcha Verifier for persistent profile protection.
- **Android Architecture**: Built with `@capacitor/android` for native Android APK generation.
- **Web Vitals**: Optimized for Chrome's Core Web Vitals with PWA support (Manifest, Service Workers).
- **Fonts**: Typography powered by **Google Fonts** (Inter & Outfit).

### Frontend
- **Framework**: [React 19](https://react.dev/) + [Vite](https://vitejs.dev/)
- **Language**: [TypeScript](https://www.typescriptlang.org/)
- **Styling**: [Tailwind CSS](https://tailwindcss.com/)
- **Animations**: [Framer Motion](https://www.framer.com/motion/)
- **State/Data**: Native React Hooks + Context

### Backend & Data
- **Proxy Server**: Node.js + Express (handles API security and routing).
- **Database**: [MongoDB Atlas](https://www.mongodb.com/atlas) (Data API).
- **Real-Time**: [Socket.io](https://socket.io/) (live updates for registrations/notifications).
- **Authentication**: [Firebase Auth](https://firebase.google.com/) (Google & Email/Password).
- **AI Engine**: [Google Gemini API](https://ai.google.dev/).


---

## 🚀 Getting Started

Follow these steps to set up the project locally.

### Prerequisites
1.  **Node.js**: v18.0.0 or higher.
2.  **MongoDB Atlas**: A cloud cluster with a database named `event_horizon`.
3.  **Firebase Project**: For Authentication.
4.  **Gemini API Key**: From Google AI Studio.

### Installation

1.  **Clone the Repository**
    ```bash
    git clone https://github.com/your-username/event-management.git
    cd event-management
    ```

2.  **Install Dependencies**
    ```bash
    npm install
    ```

3.  **Environment Setup**
    Create a `.env` file in the root directory. Use the example below:

    ```env
    # --- Backend Configuration (Server) ---
    PORT=5000
    MONGODB_URI=mongodb+srv://<user>:<password>@cluster.mongodb.net/?retryWrites=true&w=majority
    MONGODB_DB_NAME=event_horizon
    
    # --- AI Services ---
    GEMINI_API_KEY=your_google_gemini_key

    # --- Frontend Configuration (Vite) ---
    # (Vite automatically loads .env files, prefixes usually not required for server vars unless exposed)
    
    # --- Firebase Client SDK (Put these in .env.local if you prefer) ---
    # Note: If using Vite, you might need VITE_ prefix if accessing in client code directly
    # OR the project might be configured to read these via process.env replacement.
    FIREBASE_API_KEY=your_api_key
    FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
    FIREBASE_PROJECT_ID=your_project_id
    FIREBASE_STORAGE_BUCKET=your_project.appspot.com
    FIREBASE_MESSAGING_SENDER_ID=your_sender_id
    FIREBASE_APP_ID=your_app_id
    ```

4.  **Run Development Servers**
    This project requires both the backend and frontend to be running. We use `concurrently` to run both.

    ```bash
    npm run dev:all
    ```
    - **Frontend**: `http://localhost:3000`
    - **Backend**: `http://localhost:5000`

---

## 📂 Project Structure

```text
/
├── api/                  # Serverless settings (Netlify/Vercel)
├── components/           # Reusable React components
│   ├── AnalyticsDashboard.tsx
│   ├── Scanner.tsx
│   └── ...
├── services/             # API adapters and Integrations
│   ├── geminiService.ts
│   ├── storageService.ts
│   └── ...
├── App.tsx               # Main Application Logic (Monolith)
├── server.js             # Express Backend Entry Point
├── firebaseConfig.ts     # Firebase Initialization
├── types.ts              # TypeScript Interfaces
└── package.json          # Dependencies & Scripts
```


---


## 📜 Scripts

- `npm run dev`: Runs the frontend and backend concurrently.
- `npm run server`: Runs only the Express backend.
- `npm run frontend`: Runs only the Vite frontend.
- `npm run build`: Builds the frontend for production.
- `npm run preview`: Previews the production build.

---

## 🔒 Security

- **Database Access**: Direct database credentials are **never** exposed to the client. All database operations go through the `server.js` proxy.
- **Environment Variables**: Sensitive keys (Mongo URI, Server-side API keys) are kept in `.env` and not included in the client bundle.

---

## 🤝 Contribution

Contributions are welcome! Please follow these steps:
1.  Fork the repository.
2.  Create a feature branch (`git checkout -b feature/AmazingFeature`).
3.  Commit your changes (`git commit -m 'Add some AmazingFeature'`).
4.  Push to the branch (`git push origin feature/AmazingFeature`).
5.  Open a Pull Request.

---

## 📄 License

Distributed under the MIT License. See `LICENSE` for more information.

### Team Members

| Name | Role | LinkedIn | GitHub |
|------|------|----------|--------|
| Prattyan Ghosh | Team Lead + Backend Developer | [![LinkedIn](https://img.shields.io/badge/LinkedIn-blue?style=flat&logo=linkedin)](https://www.linkedin.com/in/prattyanghosh/) | [![GitHub](https://img.shields.io/badge/GitHub-black?style=flat&logo=github)](https://github.com/prattyan) |
| Ashis Mahato | Frontend Developer | [![LinkedIn](https://img.shields.io/badge/LinkedIn-blue?style=flat&logo=linkedin)](https://www.linkedin.com/in/ashis-mahato-9733332b8/) | [![GitHub](https://img.shields.io/badge/GitHub-black?style=flat&logo=github)](https://github.com/Ashis-404) |
| Arnab Ghosh |  Developer | [![LinkedIn](https://img.shields.io/badge/LinkedIn-blue?style=flat&logo=linkedin)](https://www.linkedin.com/in/arnab-ghosh-854854289/) | [![GitHub](https://img.shields.io/badge/GitHub-black?style=flat&logo=github)](https://github.com/arnabg2005) |
| Aritra Debnath | Ideation person  | [![LinkedIn](https://img.shields.io/badge/LinkedIn-blue?style=flat&logo=linkedin)](https://www.linkedin.com/in/aritradeb07/) | [![GitHub](https://img.shields.io/badge/GitHub-black?style=flat&logo=github)](https://github.com/AritraDeb05) |



---
