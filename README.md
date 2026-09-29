# DevFlow — Full-Stack Agile Workspace

DevFlow is an agile project management and workspace platform modernized from legacy static files into a full-stack architecture using **React 19**, **Node.js**, **Express.js**, and **MySQL**.

---

## 🏗 Architecture Overview

```
devflow/
├── backend/                  # Node.js + Express.js REST API
│   ├── config/
│   │   ├── db.js             # MySQL2 Connection Pool with promise queries
│   │   ├── schema.sql        # MySQL Workbench relational schema
│   │   └── initDb.js         # Automated schema runner
│   ├── controllers/          # Controllers for all modules
│   │   ├── authController.js
│   │   ├── dashboardController.js
│   │   ├── projectController.js
│   │   ├── sprintController.js
│   │   ├── taskController.js
│   │   ├── issueController.js
│   │   ├── reportController.js
│   │   ├── aiController.js
│   │   ├── userController.js
│   │   └── notificationController.js
│   ├── routes/               # Express REST route handlers
│   ├── middleware/           # JWT Authentication & error handling
│   ├── services/             # AI smart priority, forecasting, velocity
│   ├── uploads/              # File uploads (screenshots, attachments)
│   ├── test-e2e.js           # End-to-end API test suite
│   ├── server.js             # Express server entry point (Port 5000)
│   └── .env                  # Environment & MySQL config
│
├── frontend/                 # React 19 + Vite SPA
│   ├── src/
│   │   ├── components/       # UI tokens, SVG charts, modals, drawers, toasts
│   │   ├── context/          # AuthContext (JWT, session, permissions)
│   │   ├── layouts/          # Responsive AppLayout with sidebar & topbar
│   │   ├── pages/            # View pages matching original app
│   │   │   ├── AuthPage.jsx        # Login, Setup & Forgot Password
│   │   │   ├── DashboardPage.jsx   # KPIs, Donut chart, Sprints & Deadlines
│   │   │   ├── ProjectsPage.jsx    # Projects cards, modals & team rosters
│   │   │   ├── SprintsPage.jsx     # Sprint iterations & sprint report
│   │   │   ├── TasksPage.jsx       # Interactive Kanban Board + Detail Drawer
│   │   │   ├── IssuesPage.jsx      # Bug tracker with screenshot attachments
│   │   │   ├── ReportsPage.jsx     # Velocity charts, workload balance & PDF print
│   │   │   ├── AiInsightsPage.jsx  # Smart priority scoring & completion forecast
│   │   │   ├── ActivityPage.jsx    # Chronological audit timeline
│   │   │   ├── UsersPage.jsx       # Admin user management & privilege roles
│   │   │   ├── SettingsPage.jsx    # Workspace branding & working hours
│   │   │   └── ProfilePage.jsx     # Account settings & password updater
│   │   ├── services/         # Axios API client modules
│   │   ├── utils/            # Date formatting, avatar color, CSV export
│   │   └── App.jsx           # React Router v7 configuration
│   └── vite.config.js        # Vite build configuration (Port 5173)
```

---

## ⚡ Quick Start

### 1. Database Setup (MySQL)
Make sure your local MySQL service is running. Configure credentials in `backend/.env` if different from default:
```env
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=root
DB_NAME=devflow
```

Initialize the database schema:
```bash
npm run init-db
```

### 2. Start the Backend Server
```bash
npm run backend
# Runs Express on http://localhost:5000
```

### 3. Start the Frontend Application
```bash
npm run frontend
# Runs Vite React application on http://localhost:5173
```

---

## 🧪 Automated Testing
To test the complete API end-to-end (authentication, projects, sprints, tasks, comments, AI insights, and analytics):
```bash
npm run test-e2e
```

---

## 🌟 Key Features

1. **Interactive Kanban Board**: HTML5 drag-and-drop workflow across Pending, In Progress, Completed, and Blocked states.
2. **AI Agile Insights**: Smart priority scoring with 1-click apply, sprint delivery forecast, and team workload risk alerts.
3. **Sprint Planning & Velocity**: Burndown charts, estimated vs burned hours, and milestone reports.
4. **Bug & Issue Tracker**: Issue severity classifications, task impediment linking, and screenshot upload support.
5. **Team & Privilege Roles**: Admin, Manager, and Member permissions with secure JWT authentication.
6. **Executive Analytics**: Exportable CSV reports and printable PDF analytics for project reviews.
