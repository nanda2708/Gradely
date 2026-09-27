# Gradely – A Role-Based Grading Platform

Gradely is a full-stack web application that simplifies course management, assignment distribution and grading workflows for **faculty, TAs and students**.

---

## 🚀 Features

- **Role-based access control** – separate dashboards and permissions for faculty, teaching assistants and students, enforced on the backend with Firebase ID tokens.
- **Course management** – faculty create courses and enroll TAs and students by email.
- **Assignments** – publish assignments with a due date, max points and an optional PDF brief.
- **Submissions** – students upload PDF solutions (resubmission supported; the latest attempt is graded). Late submissions are flagged.
- **Grading** – faculty and TAs grade with a score, letter grade (auto-suggested from the score) and written feedback, and can regrade at any time.
- **Re-evaluation requests** – students can ask for a graded submission to be re-evaluated; staff either regrade it or decline with a response.
- **Status tracking** – assignments show as pending, overdue, submitted or graded.
- **AI Helper** – students get assignment-aware explanations and hints (Google Gemini, server-side).
- **Premium checkout** – Razorpay test-mode payment flow with server-side signature verification.

---

## 🛠 Tech Stack

**Frontend:** React 19 (Vite), Tailwind CSS, React Router, Firebase Auth, Axios, lucide-react, react-hot-toast

**Backend:** Node.js, Express 5, MongoDB Atlas + Mongoose, Firebase Admin, Cloudinary (via an authenticated upload proxy), Razorpay, Gemini API

---

## ⚡ Getting Started

### 1. Clone the repository

```bash
git clone https://github.com/nanda2708/Gradely.git
cd Gradely
```

### 2. Backend setup

```bash
cd classroom-backend
npm install
cp .env.example .env   # then fill in the values
npm run dev
```

Backend environment variables (see `classroom-backend/.env.example`):

```env
CLASSROOM_DB_URI=mongodb+srv://<username>:<password>@<cluster>/<database>
PORT=5000
FRONTEND_URL=http://localhost:5173

# Firebase Admin – either the full JSON...
FIREBASE_SERVICE_ACCOUNT_JSON=<service-account-json>
# ...or the individual fields
FIREBASE_PROJECT_ID=<firebase-project-id>
FIREBASE_CLIENT_EMAIL=<firebase-client-email>
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"

CLOUDINARY_CLOUD_NAME=<cloud-name>
CLOUDINARY_API_KEY=<api-key>
CLOUDINARY_API_SECRET=<api-secret>

RAZORPAY_ENVIRONMENT=test
RAZORPAY_KEY_ID=rzp_test_<key-id>
RAZORPAY_KEY_SECRET=<key-secret>

GEMINI_API_KEY=<gemini-api-key>
GEMINI_MODEL=gemini-2.5-flash
```

MongoDB must support transactions (any Atlas cluster does). Uploads go through the backend `/upload/file` endpoint, which accepts PDFs/images up to 15 MB.

### 3. Frontend setup

```bash
cd classroom-frontend
npm install
cp .env.example .env   # then fill in the values
npm run dev
```

Frontend environment variables (see `classroom-frontend/.env.example`):

```env
VITE_BACKEND_URL=http://localhost:5000
VITE_FIREBASE_API_KEY=<firebase-api-key>
VITE_FIREBASE_AUTH_DOMAIN=<firebase-auth-domain>
VITE_FIREBASE_PROJECT_ID=<firebase-project-id>
VITE_FIREBASE_STORAGE_BUCKET=<firebase-storage-bucket>
VITE_FIREBASE_MESSAGING_SENDER_ID=<firebase-messaging-sender-id>
VITE_FIREBASE_APP_ID=<firebase-app-id>
VITE_FIREBASE_MEASUREMENT_ID=<firebase-measurement-id>
```

> Never put Cloudinary, Razorpay or Gemini secrets in frontend environment variables — they belong only in the backend `.env`.

### 4. Checks

```bash
cd classroom-frontend && npm run lint && npm run build
```

See [`docs/RAZORPAY_TEST_MODE.md`](docs/RAZORPAY_TEST_MODE.md) for the payment flow.
