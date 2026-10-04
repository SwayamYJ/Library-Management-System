# SmartLibrary – Library Management System (LMS)

SmartLibrary is a full-stack MERN application (MongoDB, Express 5, React, Node.js, Tailwind CSS) offering a modern digital and physical library management workflow. It features real-time shelf mapping, external book lookups (Google Books API + Open Library fallback), dynamic fine and penalty tracking, role-based access control (RBAC), and automated cover migrations.

---

## 🚀 Features

- **Public Book Catalog**: Browse books with rich responsive covers, category filtering, search by title/author/ISBN, and read member comments.
- **Universal Book Lookup**: Administrative ISBN-10/13 or keyword lookup across Google Books API and Open Library with automated fallbacks, exponential backoff retries, and high-resolution cover normalization.
- **Interactive Library Canvas**: Visual shelf placement system ensuring no two books collide in the same slot (`PUT /api/books/:id/location` with 409 conflict checks).
- **Borrowing & Fine Engine**: Atomic borrow requests with race-condition prevention, automated 14-day due date scheduling, dynamic daily fine computation, and admin fine reconciliation.
- **Hardened Security**: Express 5 architecture, mandatory `JWT_SECRET`, rate-limited authentication endpoints, sanitized user payloads (no password hash leaks), and CORS origin locking.

---

## 🛠️ Project Structure

```
SmartLibrary/
├── backend/
│   ├── models/            # Mongoose 9 models (Book, User, Activity, etc.)
│   ├── routes/            # Express routers (auth, books, adminUsers, layout, etc.)
│   ├── middleware/        # JWT auth, adminOnly RBAC, rateLimiter, multer upload
│   ├── utils/             # Universal bookLookup, cronJobs fine evaluator
│   ├── fixCovers.js       # Idempotent cover migration script
│   ├── testE2E.js         # Automated end-to-end integration test suite
│   ├── .env               # Active environment configuration
│   └── .env.example       # Template environment variables
├── frontend/
│   ├── src/
│   │   ├── components/    # BookCover, LibraryMapCanvas, NotificationBell, etc.
│   │   ├── context/       # AuthContext & AuthProvider
│   │   ├── pages/         # PublicBrowse, AdminDashboard, UserDashboard, Profile, etc.
│   │   └── services/      # Axios client with JWT interceptor (baseURL /api)
│   ├── vite.config.js     # Dev server proxying /api to http://localhost:5000
│   └── package.json
└── README.md
```

---

## ⚙️ Installation & Setup

### 1. Prerequisites
- **Node.js**: v18+ or v20+
- **MongoDB**: Local MongoDB instance (`mongodb://localhost:27017/smartlibrary`) or MongoDB Atlas URI

### 2. Backend Setup
1. Open a terminal in `SmartLibrary/backend/`:
   ```bash
   cd backend
   npm install
   ```
2. Create your `.env` configuration from the provided example:
   ```bash
   cp .env.example .env
   ```
3. Configure the following variables in `backend/.env`:
   ```env
   PORT=5000
   MONGO_URI=mongodb://localhost:27017/smartlibrary
   JWT_SECRET=your_super_secret_jwt_key_at_least_32_characters
   ADMIN_SECRET_KEY=admin_registration_secret_key_2026
   FRONTEND_URL=http://localhost:5173
   GOOGLE_BOOKS_API_KEY=
   ```

### 3. Frontend Setup
1. Open a terminal in `SmartLibrary/frontend/`:
   ```bash
   cd frontend
   npm install
   ```

---

## 🔑 How to Get a Google Books API Key

While the system is fully equipped to automatically fall back to Open Library for book lookups and covers, adding a Google Books API key eliminates rate limits:

1. Go to the [Google Cloud Console](https://console.cloud.google.com/).
2. Create a new project (e.g., `SmartLibrary-LMS`) or select an existing one.
3. In the left navigation, go to **APIs & Services** > **Library**.
4. Search for **Books API** and click **Enable**.
5. Navigate to **APIs & Services** > **Credentials**.
6. Click **+ CREATE CREDENTIALS** > **API Key**.
7. *(Recommended)* Under **API Restrictions**, select **Restrict key** and choose only **Books API**.
8. Copy the generated key and paste it into `backend/.env`:
   ```env
   GOOGLE_BOOKS_API_KEY=AIzaSy...YourKeyHere
   ```
9. Restart the backend server.

---

## 📦 Data Seeding & Cover Migration

### 1. Seed Books & Shelves
To populate sample books and initial shelf layouts:
```bash
cd backend
node seed.js
node resetLayout.js
```

### 2. Run the Cover Migration Script (`fixCovers.js`)
If your database has legacy placeholder URLs (`via.placeholder.com` or `unsplash.com`), run the idempotent cover fixer:
```bash
cd backend
node fixCovers.js
```
*What this script does:*
- Scans all books in MongoDB with empty, dead placeholder, or `http://` covers.
- Looks up the official cover via Google Books (with key if available) and Open Library by ISBN.
- Normalizes URLs to `https://`, strips low-resolution edge crops, and updates both `thumbnail` and `imageUrl` atomically.
- Includes rate-limit backoff and prints a terminal summary report upon completion.

---

## 👤 Creating the First Admin Account

You can register an Admin account directly through the application UI:
1. Start the app and navigate to `http://localhost:5173/signup`.
2. Select **Administrator** as the Account Type.
3. Enter your Username, Email, Password, and the `ADMIN_SECRET_KEY` configured in `backend/.env` (e.g. `admin_registration_secret_key_2026`).
4. Click **Sign Up** to create the administrative account and enter the Admin Dashboard.

Alternatively, to seed default test accounts directly via CLI:
```bash
cd backend
node -e "const mongoose=require('mongoose');const bcrypt=require('bcryptjs');const User=require('./models/User');(async()=>{await mongoose.connect('mongodb://localhost:27017/smartlibrary');const hashA=await bcrypt.hash('Admin123!',10);await User.findOneAndUpdate({email:'admin@smartlibrary.com'},{username:'AdminRoot',email:'admin@smartlibrary.com',password:hashA,role:'Admin'},{upsert:true});const hashU=await bcrypt.hash('User123!',10);await User.findOneAndUpdate({email:'user@smartlibrary.com'},{username:'StudentUser',email:'user@smartlibrary.com',password:hashU,role:'User'},{upsert:true});console.log('Seeded test accounts');await mongoose.disconnect();})()"
```
- **Admin**: `admin@smartlibrary.com` / `Admin123!`
- **User**: `user@smartlibrary.com` / `User123!`

---

## 🏃 Running the Application

### Running Backend (Port 5000)
```bash
cd backend
npm run dev    # or: node server.js
```

### Running Frontend (Port 5173)
```bash
cd frontend
npm run dev
```

Visit `http://localhost:5173` in your browser.

---

## 🧪 Comprehensive Test Checklist

Run the automated integration test suite anytime:
```bash
cd backend
node testE2E.js
```

| Flow / Feature | Test Description | Result |
|---|---|---|
| **Visitor: Public Catalog** | Fetch books via `GET /api/books`, verify 30 books returned | **PASS** |
| **Visitor: Cover Display** | Verify all covers load valid Open Library/HTTPS links, no dead `via.placeholder.com` | **PASS** |
| **Visitor: Catalog Search** | Filter books by title/author/ISBN (`/api/books?search=Code`) | **PASS** |
| **Visitor: Book Detail** | Access `/api/books/:id`, verify description, metadata, and comments | **PASS** |
| **Visitor: BookCover Component** | Fallback chain: `thumbnail` → `imageUrl` → Open Library ISBN → styled title div | **PASS** |
| **User: Authentication** | Login with email/password, verify JWT receipt and user session | **PASS** |
| **User: RBAC Protection** | Standard users attempting admin endpoints receive HTTP 403 Forbidden | **PASS** |
| **User: Password Change** | Standard user updates password via `/api/profile/change-password` with bcrypt validation | **PASS** |
| **User: Atomic Borrow** | Borrow book using atomic `$inc: { availableCount: -1 }` with race-condition guard | **PASS** |
| **User: Live Fines & History**| Unified daily penalty calculation (`Math.ceil(diff / 86400000) * 10`) | **PASS** |
| **Admin: Universal Lookup** | Query real ISBN `9780131103627` returning title "The C Programming Language" | **PASS** |
| **Admin: Title Search Lookup**| Lookup query "Clean Code" returning normalized Google/Open Library results | **PASS** |
| **Admin: Invalid Query** | Unresolvable/invalid ISBN cleanly returns 404/429 with descriptive JSON error | **PASS** |
| **Admin: Books CRUD Edit** | `PUT /api/books/:id` updates and saves `price, publisher, description, quantity` | **PASS** |
| **Admin: Shelf Collisions** | `PUT /api/books/:id/location` blocks duplicate assignment to same slot with 409 Conflict | **PASS** |
| **Admin: Clear Ghost Borrows**| `POST /api/books/:id/clear-history` clears deleted user borrows and resets to Available | **PASS** |
| **Admin: Pay Fines** | `POST /api/admin/users/:id/pay-fines` clears all user unpaid fines and resets balance | **PASS** |
| **Admin: Notifications** | Deduplicated alert dispatching in `cronJobs.js` and mark-as-read endpoints | **PASS** |
| **Code Quality: ESLint** | `npm run lint` in `frontend` completed with 0 errors and 0 warnings | **PASS** |
| **Code Quality: Production Build** | `npm run build` in `frontend` generated optimized bundle cleanly in 3.2s | **PASS** |
