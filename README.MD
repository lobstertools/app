> [!IMPORTANT]
> **Unreleased Beta**
> This software is currently in an unreleased beta state. Features are subject to change and stability is not guaranteed.

# Lobster Lock - Session Manager

![AI Assisted](https://img.shields.io/badge/Code-AI_Assisted-success)

This is the main application for the Lobster Lock, a DIY self-bondage toolkit. It includes the frontend (React UI), the backend (Node.js/Express proxy server), and the desktop (Electron) wrapper.

The backend server discovers Lobster Lock devices on the network, provides a stable API for the frontend, and manages device connections.

## ⚠️ Disclaimer & Safety Warning

This project is intended for educational and novelty purposes by responsible adults. Self-bondage carries inherent and serious risks, including nerve damage, circulation loss, and asphyxiation.

* You are building this toolkit at your **own risk**.
* Thoroughly test all components, especially release mechanisms, before any use.
* Always have a failsafe plan and emergency tools (like shears or cutters) within reach.
* Never use this system in a way that restricts breathing or in any situation you cannot safely escape from.
* The creators of this project assume **no liability** for any harm, damage, or legal consequences.

## License

Distributed under the Apache License 2.0. See `LICENSE` for more information.

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

**1. Electron Desktop Development (Recommended)**

This runs the full stack inside the Electron wrapper, which is necessary for testing Firmware Flashing.

```bash
# Runs frontend, backend, mock-lock, and electron app
yarn dev
```

**2. Standard Web Development**

This runs the React frontend, the Node.js backend, and the mock device server. This is the fastest way to work on the UI, but it's missing some features.

```bash
# Runs frontend, backend, and mock-lock concurrently
yarn dev:web
```

  * **Frontend UI:** `http://localhost:5173`
  * **Backend Server:** `http://localhost:3001`
  * **Mock Device:** `http://localhost:3003`


### Other Scripts

  * `yarn lint`: Lint the project using ESLint.
  * `yarn lint:fix`: Attempt to automatically fix linting issues.
  * `yarn build`: Create a full, distributable production build of the Electron application.
