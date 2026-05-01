# TaskFlow - Team Task Manager

TaskFlow is a premium, full-stack project management and task tracking web application. It features a modern, dark-themed UI with role-based access control, interactive Kanban boards, and real-time dashboard analytics.

## 🌟 Key Features

- **Authentication System:** Secure registration and login using JSON Web Tokens (JWT).
- **Role-Based Access Control:** Separate permissions for `Admin` and `Member` roles.
- **Interactive Dashboard:** Beautiful pie and bar charts showing task priorities, statuses, and project completion metrics.
- **Projects & Kanban Boards:** Create projects, add members, and manage tasks using an intuitive Kanban board interface.
- **Task Management:** Assign tasks, set priorities, manage due dates, and update statuses. Includes a dedicated comments section for each task.
- **Notifications:** Receive alerts when added to a project or assigned a new task.
- **Zero-Setup Database:** Uses a local, embedded SQLite database that initializes itself instantly.

## 🛠️ Technology Stack

- **Frontend:** React, Vite, React Router, Recharts, Context API, pure custom CSS (modern UI, dark mode).
- **Backend:** Node.js, Express.js, better-sqlite3, bcryptjs, jsonwebtoken.

---

## 🚀 How to Run in VS Code

Because this project is separated into a **Backend** and a **Frontend**, you will need to start both servers. VS Code makes this very easy using the integrated terminal.

### Step 1: Open the Project
1. Open Visual Studio Code.
2. Go to `File > Open Folder...` and select the `Team Task Manager` folder.

### Step 2: Start the Backend Server
1. Open a new terminal in VS Code (`Terminal > New Terminal` or press `` Ctrl + ` ``).
2. Navigate to the backend folder by typing:
   ```bash
   cd backend
   ```
3. *(First time only)* Install the backend dependencies:
   ```bash
   npm install
   ```
4. Start the backend development server:
   ```bash
   npm run dev
   ```
   *You should see a message saying "Team Task Manager API running on http://localhost:5000" and "✅ Database initialized". Leave this terminal tab open.*

### Step 3: Start the Frontend Server
1. Open a **second** terminal window in VS Code (click the `+` button in the terminal panel or press `Ctrl + Shift + 5` to split the terminal).
2. Navigate to the frontend folder by typing:
   ```bash
   cd frontend
   ```
3. *(First time only)* Install the frontend dependencies:
   ```bash
   npm install
   ```
4. Start the frontend development server:
   ```bash
   npm run dev
   ```
   *You should see a message saying "➜  Local: http://localhost:5173/".*

### Step 4: Open the App
Hold `Ctrl` and click the `http://localhost:5173/` link in your terminal, or manually type it into your web browser. 

---

## 🧪 Demo Credentials

If you want to test the app without registering a new account, you can use the built-in demo buttons on the login page, or log in manually with:

**Admin Account:**
- **Email:** admin@demo.com
- **Password:** admin123

**Member Account:**
- **Email:** member@demo.com
- **Password:** member123
