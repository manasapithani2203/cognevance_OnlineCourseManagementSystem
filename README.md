# Online Course Management System

GitHub-ready project prepared for Manasa from the supplied reference project.

A full-stack Online Course Management System built with **React + Vite**, **Node.js + Express**, **MongoDB + Mongoose**, **JWT**, and **bcryptjs**.

Students can browse and search courses, enroll, and track lesson progress. Admins can create, edit, and delete courses and view basic platform statistics.

## Features

### Student
- Register and log in
- Browse courses
- Search by title, description, or category
- Filter by course level
- Enroll in a course
- Mark lessons complete/incomplete
- Track course progress
- Prevent duplicate enrollments

### Admin
- Secure admin role through a server-side admin code
- View user, course, and enrollment counts
- Add courses
- Edit courses
- Delete courses
- Automatically reset progress when a course's lesson curriculum changes

### Backend
- JWT authentication
- Password hashing with bcrypt
- MongoDB persistence
- Request validation
- Duplicate-resource handling
- Protected student/admin routes
- Consistent HTTP error responses
- Health-check endpoint at `/api/health`

## Project structure

```text
cognevance_OnlineCourseManagementSystem/
├── client/
│   ├── src/
│   │   ├── App.jsx
│   │   ├── main.jsx
│   │   └── style.css
│   ├── .env.example
│   ├── index.html
│   ├── package.json
│   └── vite.config.js
├── server/
│   ├── .env.example
│   ├── index.js
│   ├── models.js
│   └── package.json
├── docs/
├── .gitignore
└── README.md
```

## Requirements

- Node.js 18 or newer
- npm
- MongoDB database (local MongoDB or MongoDB Atlas)

## Run locally

### 1. Clone the repository

```bash
git clone <YOUR_GITHUB_REPOSITORY_URL>
cd cognevance_OnlineCourseManagementSystem
```

### 2. Configure the backend

```bash
cd server
npm install
```

Copy `.env.example` to `.env` and configure:

```env
PORT=5000
MONGO_URI=mongodb+srv://USER:PASSWORD@cluster.mongodb.net/ocms
JWT_SECRET=replace_with_a_long_random_secret
ADMIN_CODE=replace_with_a_private_admin_code
CLIENT_URL=http://localhost:5173
```

Start the API:

```bash
npm start
```

The backend runs on `http://localhost:5000`.

### 3. Configure the frontend

Open another terminal:

```bash
cd client
npm install
```

Copy `.env.example` to `.env`:

```env
VITE_API_URL=http://localhost:5000
```

Start the frontend:

```bash
npm run dev
```

Open the URL shown by Vite, normally `http://localhost:5173`.

## Creating an admin account

During registration, enter the same `ADMIN_CODE` configured in the server `.env`.

**Important:** never commit `.env` or publish the real admin code, MongoDB connection string, or JWT secret.

## API

| Method | Endpoint | Access | Purpose |
|---|---|---|---|
| GET | `/api/health` | Public | API/database health |
| POST | `/api/auth/register` | Public | Register |
| POST | `/api/auth/login` | Public | Login |
| GET | `/api/courses` | Public | Search/filter courses |
| GET | `/api/courses/:id` | Public | Get one course |
| POST | `/api/courses` | Admin | Create course |
| PUT | `/api/courses/:id` | Admin | Update course |
| DELETE | `/api/courses/:id` | Admin | Delete course |
| POST | `/api/enrollments` | Logged in | Enroll |
| GET | `/api/enrollments/me` | Logged in | Get own enrollments |
| PATCH | `/api/enrollments/:id/progress` | Logged in | Toggle lesson progress |
| GET | `/api/admin/stats` | Admin | Platform statistics |

## Deployment

### Backend
Deploy the `server` directory to a Node.js hosting service and configure:

- `MONGO_URI`
- `JWT_SECRET`
- `ADMIN_CODE`
- `CLIENT_URL`
- `PORT` (if required by the platform)

### Frontend
Deploy the `client` directory to a static hosting service and configure:

```env
VITE_API_URL=https://your-backend-domain.example
```

Update the backend's `CLIENT_URL` to the deployed frontend origin.

## GitHub checklist

Before pushing:

```bash
git status
```

Make sure these are **not** committed:

- `.env`
- `node_modules/`
- `dist/`
- MongoDB credentials
- JWT secrets
- Admin code

Then:

```bash
git add .
git commit -m "Prepare project for GitHub"
git push
```

## Validation

Backend syntax check:

```bash
cd server
npm run check
```

Frontend production build:

```bash
cd client
npm run build
```

## Notes

This is a portfolio/academic project. For a production deployment, consider adding rate limiting, email verification, password reset, refresh-token/session management, stronger admin provisioning, automated tests, and structured logging.

## GitHub submission

Suggested repository name: `cognevance_OnlineCourseManagementSystem`. Sign in to [Manasa’s GitHub account](https://github.com/manasapithani2203), create a new repository with this exact name, then upload the extracted project files as described in the submission instructions. Upload real screenshots and any required project report before submitting. Do not commit `.env` files or credentials.
