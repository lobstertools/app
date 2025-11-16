# Lobster Lock - Session Manager

This is the main application for the Lobster Lock, a DIY self-bondage toolkit. It includes the frontend (React UI), the backend (Node.js/Express proxy server), and the desktop (Electron) wrapper.

The backend server discovers Lobster Lock devices on the network, provides a stable API for the frontend, and manages device connections.

## Technical Overview

* **Frontend:** React (built with Vite)
* **Backend:** Node.js / Express
* **Desktop:** Electron
* **Language:** TypeScript
* **Device Discovery:** mDNS (Bonjour) for Wi-Fi devices and Bluetooth LE (Noble) for unprovisioned devices.
* **API Comms:** `axios` for all HTTP requests to the backend proxy and devices.

## Development

This is a monorepo-style project managed with `yarn`.

**Prerequisites:**
* Node.js (v18+)
* Yarn

**Installation:**
```bash
yarn install
````

### Running the Application

There are two main ways to run the app for development:

**1. Standard Web Development (Recommended)**

This runs the React frontend, the Node.js backend, and the mock device server. This is the fastest way to work on the UI.

```bash
# Runs frontend, backend, and mock-lock concurrently
yarn dev
```

  * **Frontend UI:** `http://localhost:5173`
  * **Backend Server:** `http://localhost:3001`
  * **Mock Device:** `http://localhost:3003`

**2. Electron Desktop Development**

This runs the full stack inside the Electron wrapper, which is necessary for testing Bluetooth features.

```bash
# Runs frontend, backend, mock-lock, and electron app
yarn dev:electron
```

### Other Scripts

  * `yarn lint`: Lint the project using ESLint.
  * `yarn lint:fix`: Attempt to automatically fix linting issues.
  * `yarn build`: Create a full, distributable production build of the Electron application.
