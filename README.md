# RouteFlow Delivery Tracking

React + Vite frontend, Express backend, and MongoDB database.

## First Setup

Install **Node.js 22 LTS**, **MongoDB Community Server**, and **MongoDB Compass**.

### macOS

```bash
brew services start mongodb/brew/mongodb-community
cd /path/to/Tracking
cp .env.example server/.env
npm install
npm run db:setup
npm run dev
```

### Windows

Open PowerShell inside the project folder:

```powershell
Start-Service MongoDB
Copy-Item .env.example server\.env
npm install
npm run db:setup
npm run dev
```

Open `http://localhost:5173`.

`npm run dev` starts the frontend and backend together. MongoDB runs separately as a system service.

`npm run db:setup` is safe to run again. If MongoDB collections were deleted, it recreates and verifies all required collections, indexes, default users, and settings without adding clients, vehicles, or deliveries. API startup runs the same repair check automatically.

## Login

```text
Admin: admin@routeflow.app
Password: Admin@123

Staff: staff@routeflow.app
Password: Staff@123

Delete PIN: 2468
```

## MongoDB Compass

```text
mongodb://127.0.0.1:27017/routeflow
```

## Use Flow

1. Admin login: add Clients, Vehicles, and Staff.
2. Staff login: open New Delivery and save daily entries.
3. Admin login: monitor Dashboard, Delivery History, Reports, and Activity Log.

## Daily Run

```bash
npm run dev
```

## Production Run

```bash
npm run build
npm start
```

Open `http://localhost:4000`.
