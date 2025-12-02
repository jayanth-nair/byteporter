# BytePorter

BytePorter is a secure, ephemeral file sharing service designed for simplicity and privacy. It allows users to upload files, set expiration times, and share secure links.

## Features

-   **Secure File Uploads:** Files are stored securely with unique UUIDs.
-   **Expiration Control:** Users can set file expiration times (e.g., 1 hour, 1 day).
-   **Password Protection:** Optional password protection for shared files.
-   **One-Time Downloads:** "Burn on Access" functionality (file is deleted immediately upon access request to prevent race conditions).
-   **File Previews:** Secure preview for images and text files (with strict CSP).
-   **Admin Dashboard:** Manage users, files, and system configuration.
-   **Dynamic Quotas:** Storage quotas managed by admin with atomic enforcement.
-   **Rate Limiting & Security:** Built-in protection against abuse, XSS, and NoSQL injection.
-   **Container Security:** Services run as unprivileged users for enhanced security.

## Tech Stack

-   **Frontend:** React, Tailwind CSS (via CSS variables/custom styles)
-   **Backend:** Node.js, Express
-   **Database**: MongoDB (Mongoose)
-   **Caching/Queue**: Valkey (Open Source Redis alternative)
-   **Authentication**: JWT & bcryptjs
-   **Containerization:** Docker, Docker Compose

## Prerequisites

-   Docker & Docker Compose
-   Node.js (for local development)

## Getting Started (Quick Start)

1.  **Clone the repository**
2.  **Install & Setup** (One command to rule them all):
    ```bash
    npm install
    npm run setup
    ```
    *This will install all dependencies, configure environment variables, and generate secure keys.*

3.  **Run Locally**:
    ```bash
    npm run dev
    ```
    *Starts Client (localhost:3000), Server (localhost:5000), and DBs.*

4.  **Run with Docker**:
    ```bash
    npm start
    ```
    *Builds and starts the entire stack in Docker containers.*

5.  **Stop Docker**:
    ```bash
    npm stop
    ```
    *Stops and removes the Docker containers.*

6.  **Reset System** (Caution!):
    ```bash
    npm run reset
    ```
    *Wipes the database and uploads folder. Useful for a fresh start.*

## Verification

To verify that your environment is correctly configured:

```bash
npm run verify
```

## Directory Structure

-   **client/**: React frontend application.
-   **server/**: Node.js/Express backend API.
-   **setup.js**: Automated setup script.
-   **package.json**: Root workspace manager.

## Manual Setup (Legacy)

If you prefer to set things up manually:

### 1. Server Setup
```bash
cd server
npm install
# Ensure .env is configured
npm run dev
```

### 2. Client Setup
```bash
cd client
npm install
npm start
```

## First Time Setup

1.  **Create Admin Account:**
    Navigate to `http://localhost:3000/admin/setup` to create the initial administrator account. This route is only accessible if no admin account exists.

2.  **Configure System:**
    Log in as the admin and use the dashboard to configure storage quotas and file size limits.

## Environment Variables

### Server (`server/.env`)

```env
PORT=5000
# MongoDB Connection
MONGO_URI=mongodb://mongo:27017/byteporter

# Valkey Connection
# Docker: redis://valkey:6379
# Local:  redis://localhost:6379
VALKEY_URL=redis://valkey:6379

JWT_SECRET=your_super_secret_jwt_key
CLIENT_URL=http://localhost:3000
STORAGE_QUOTA_MB=1024
MAX_FILE_SIZE_MB=972
```

## API Endpoints

### Auth
-   `POST /api/users/register` - Register a new user
-   `POST /api/users/login` - Login

### Files
-   `POST /api/upload` - Upload a file (Multipart)
-   `GET /api/files/:uuid` - Get file metadata/download
-   `POST /api/files/:uuid/verify-password` - Verify password for protected files

### Admin
-   `GET /api/admin/stats` - System statistics
-   `GET /api/admin/users` - List users
-   `GET /api/admin/files` - List all files
-   `PUT /api/config` - Update system configuration

## License

MIT
