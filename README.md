# 🎓 CampusConnect — Gamified Campus Life & Event Discovery Engine

> **Transforming fragmented campus communication into an integrated, gamified student engagement ecosystem.**

---

## 💡 The Real-World Problem & Solution

### ⚠️ The Problem
In modern university campuses, communication and event participation face severe friction:
* **Fragmented Channels:** Events are announced across scattered WhatsApp groups, notice boards, Instagram posts, and long email chains, leading to low visibility and missed opportunities.
* **Low Engagement:** Students lack continuous incentive or centralized tracking to explore extracurriculars beyond their immediate department.
* **Organizer Overhead:** Campus clubs and event coordinators struggle with manual RSVP management, attendance verification, and reaching target audiences.
* **Administrative Blindspots:** Deans and institutional heads have no real-time metrics or data analytics to gauge campus culture, student involvement, or event ROI.

### ✨ The Solution (CampusConnect)
**CampusConnect** solves campus fragmentation by providing a unified, data-driven platform that centralizes discovery while gamifying daily attendance and participation.
* **Central Hub:** A single source of truth for all technical, cultural, and academic campus events.
* **Gamified Ecosystem:** Daily streaks, point rewards, and dynamic leaderboards that incentivize continuous active participation.
* **Real-time Analytics:** Instant slot tracking, digital RSVPs, and live feedback loops for coordinators and administration.

---

## 🎯 Stakeholder Impact (Who It Helps)

### 👨‍🎓 1. For Students
* **Never Miss Out:** Discover all campus events, workshops, and hackathons in one centralized feed with real-time updates.
* **Gamified Experience:** Earn points and maintain check-in streaks for participating in campus activities.
* **Build Your Portfolio:** Track attendance history, badges, and campus achievements directly on your personal profile.
* **Community Connection:** Engage with peers across different departments and join interest-based events effortlessly.

### ⛺ 2. For Event Organizers & Clubs
* **Maximum Outreach:** Reach the entire student body without relying on lost social media algorithms or crowded messaging groups.
* **Streamlined Event Management:** Monitor real-time RSVPs, seat availability, and participant capacity with automated tracking.
* **Data-Driven Success:** Track post-event attendance metrics to measure student interest and refine future event formats.
* **Higher Engagement Rates:** Capitalize on the platform's gamification system to drive higher turnout for technical workshops and seminars.

### 🏛️ 3. For Deans & Campus Administration
* **Institutional Visibility:** Access high-level insights and real-time data on campus engagement and overall student participation.
* **Fostering Campus Culture:** Cultivate a vibrant, active student community that balances academics with extracurricular excellence.
* **Resource Allocation:** Make informed decisions on budget funding and venue allocations based on verified club event attendance data.
* **Centralized Oversight:** Ensure campus activities align with university guidelines through a single monitored infrastructure.

---

## 🚀 Key Features

* **🌐 Real-Time Event Hub:** Discover upcoming hackathons, tech workshops, cultural fests, and guest lectures with real-time slot tracking and instant RSVP.
* **🔥 Gamified Streak Engine:** Daily login check-ins, event attendance streaks, and milestone badges that drive consistent platform engagement.
* **🏆 Live Leaderboard & Points System:** Track top campus contributors and active participants in real-time.
* **🔐 Secure Authentication & User Profiles:** Managed user sessions with personalized dashboard views, saved events, and activity history.
* **📱 Responsive Mobile-First Architecture:** Pixel-perfect layout optimization across mobile, tablet, and desktop viewports.

---

## 🛠️ Architecture & Tech Stack

### **Frontend Framework & Styling**
* **HTML5 & CSS3:** Semantic layout design and clean component structuring.
* **Vanilla JavaScript (ES6+):** Asynchronous DOM operations, state management, and real-time updates.
* **Tailwind CSS / Custom Modern CSS:** Responsive grid system, custom theme variables, and glassmorphism UI elements.

### **Backend, Database & Hosting**
* **Supabase:** Cloud PostgreSQL database, Row Level Security (RLS), real-time subscriptions, and authentication client.
* **Vercel:** Automated continuous integration (CI/CD) and fast edge deployment.

---

## 📂 Project Architecture

```text
campus-connect/
├── index.html              # Main application entry point & discovery landing
├── assets/                 # Modular design assets & dynamic scripts
│   ├── css/
│   │   └── style.css       # Core design system & utility overrides
│   ├── js/
│   │   ├── app.js          # DOM controllers & UI event listeners
│   │   ├── auth.js         # User state & authentication workflows
│   │   └── supabase.js     # Supabase client instantiation & API calls
│   └── images/             # Visual branding assets, icons, and badges
├── pages/                  # Route views
│   ├── events.html         # Detailed event catalog & filter system
│   ├── leaderboard.html    # Real-time ranking & gamification dashboard
│   └── profile.html        # User statistics, badges, and settings
├── package.json            # Node metadata & development dependencies
└── README.md               # Project documentation
```

---

## ⚡ Getting Started Locally

Follow these steps to set up the development environment on your local system:

### 1. Prerequisites
Ensure you have Git and a local HTTP server installed (e.g., Live Server extension in VS Code, Python `http.server`, or `npx serve`).

### 2. Repository Cloning
```bash
git clone https://github.com/siddarthabm123/campus-connect.git
cd campus-connect
```

### 3. Environment Setup
Configure your Supabase credentials in `assets/js/supabase.js`:
```javascript
const SUPABASE_URL = "YOUR_SUPABASE_PROJECT_URL";
const SUPABASE_ANON_KEY = "YOUR_SUPABASE_ANON_KEY";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
```

### 4. Launch Application
Run a local development server:
```bash
# Option A: Python HTTP Server
python3 -m http.server 3000

# Option B: Node NPX Serve
npx serve .
```

Open your browser and visit `http://localhost:3000`.

---

## 🎯 Production & Deployment

The application is deployed live via Vercel continuous deployment pipeline:
* **Live URL:** [https://campus-connect-iota-beige.vercel.app/](https://campus-connect-iota-beige.vercel.app/)
* **Deployment Status:** Active / Production Ready

---

## 👤 Author & Maintainer

**Siddartha B M**
* **GitHub:** [@siddarthabm123](https://github.com/siddarthabm123)
* **Portfolio / Projects:** [siddarthabm123 Repositories](https://github.com/siddarthabm123?tab=repositories)

---

## 📄 License

This project is licensed under the [MIT License](LICENSE) - feel free to use, adapt, and build upon this repository.