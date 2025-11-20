/*
 * =================================================================
 * Project:   Lobster Lock - Self-Bondage Session Manager
 * File:      main.ts (Backend Server)
 *
 * SPDX-License-Identifier: Apache-2.0
 *
 * Description:
 * Node.js (Express) backend server.
 * This server acts as a dynamic proxy and discovery service.
 * =================================================================
 */

import express, { Request, Response } from 'express';
import axios, { isAxiosError } from 'axios';
import cors from 'cors';

// --- Imports for Discovery ---
import Bonjour, { Browser, Bonjour as BonjourInstance } from 'bonjour';
import noble from '@abandonware/noble';
import { DeviceProvisioningData, DiscoveredDevice } from '../types';

// --- Configuration ---
const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// --- Helper Functions ---

/**
 * Logs a message to the console with a timestamp.
 */
const log = (message: string) =>
    console.log(`[${new Date().toISOString()}] Server: ${message}`);

// --- Device Discovery & State ---

// UUIDs
const PROV_SERVICE_UUID = '5a160000-8334-469b-a316-c340cf29188f';

const PROV_SSID_CHAR_UUID = '5a160001-8334-469b-a316-c340cf29188f';
const PROV_PASS_CHAR_UUID = '5a160002-8334-469b-a316-c340cf29188f';
const PROV_ENABLE_STREAKS_CHAR_UUID = '5a160004-8334-469b-a316-c340cf29188f';
const PROV_ENABLE_PAYBACK_TIME_CHAR_UUID =
    '5a160005-8334-469b-a316-c340cf29188f';
const PROV_PAYBACK_TIME_CHAR_UUID = '5a160006-8334-469b-a316-c340cf29188f';

// mDNS Service Type
const MDNS_SERVICE_TYPE = 'lobster-lock';

// --- MOCK CONSTANT ---
const FAKE_BLE_DEVICE_ID = 'mock-ble-device-id-123';

const deviceCache = new Map<string, DiscoveredDevice>();

// Module-scoped variables for Bonjour
let bonjourInstance: BonjourInstance | null = null;
let bonjourBrowser: Browser | null = null;

/**
 * Builds a valid target URL for both IPv4 and IPv6 addresses.
 * @param ip The IP address (e.g., "192.168.1.10" or "fe80::...")
 * @param port The port (e.g., 80 or 8080)
 * @param path The API path (e.g., "/status")
 * @returns A full, valid URL string.
 */
function buildTargetUrl(ip: string, port: number, path: string): string {
    // Check if it's an IPv6 address by looking for a colon
    if (ip.includes(':')) {
        // IPv6 addresses must be wrapped in brackets in URLs
        return `http://[${ip}]:${port}${path}`;
    }
    // Otherwise, it's IPv4
    return `http://${ip}:${port}${path}`;
}

/**
 * Updates the 'lastSeen' timestamp for a device.
 * Call this after any successful proxy communication.
 */
function refreshDeviceTimestamp(deviceId: string) {
    const device = deviceCache.get(deviceId);
    if (device) {
        device.lastSeen = Date.now();
    }
}

// --- mDNS Discovery Functions---

/**
 * Helper to ensure the main Bonjour instance exists.
 */
function ensureBonjourInstance() {
    if (!bonjourInstance) {
        bonjourInstance = Bonjour();
    }
}

/**
 * CYCLES the mDNS browser.
 * Stops any existing scan and starts a fresh one to force a network query.
 * This fixes the issue where we miss devices that join silently.
 */
function cycleMDNSBrowser() {
    ensureBonjourInstance();

    // If a browser is currently running, stop it to force a re-query
    if (bonjourBrowser) {
        bonjourBrowser.stop();
        bonjourBrowser = null;
    }

    // log('[mDNS] Cycling discovery browser (Radar Sweep)...');

    bonjourBrowser = bonjourInstance!.find({
        type: MDNS_SERVICE_TYPE,
        protocol: 'tcp',
    });

    // Called when a device appears on the network
    bonjourBrowser.on('up', (service) => {
        // Select the first valid IPv4 address if available, otherwise fallback to IPv6
        let ip =
            service.addresses.find((addr) => !addr.includes(':')) ||
            service.addresses[0];
        const port = service.port;

        // --- HACK FOR MOCK DEVICE ON MANAGED MACHINES ---
        // This is the one necessary hack. On firewalled dev machines,
        // the backend (server) can't talk to the mock's network IP
        // (e.g., 192.168.x.x), but it CAN talk to 127.0.0.1.
        if (service.name === 'Mock-LobsterLock') {
            log(
                `[mDNS] Discovered Mock-LobsterLock. Forcing IP to 127.0.0.1 for local dev on managed device.`
            );
            ip = '127.0.0.1';
            // We still use the discovered port (e.g., 3003)

            // --- MOCK PROVISIONABLE DEVICE ---
            // When we find the 'ready' mock, also create a fake 'new' one
            // for testing the provisioning UI flow.
            if (!deviceCache.has(FAKE_BLE_DEVICE_ID)) {
                log(
                    `[Mock] Adding fake 'new_unprovisioned' device for UI testing.`
                );
                deviceCache.set(FAKE_BLE_DEVICE_ID, {
                    id: FAKE_BLE_DEVICE_ID,
                    name: 'Lobster Lock (Mock BLE)',
                    state: 'new_unprovisioned',
                    address: FAKE_BLE_DEVICE_ID,
                    port: 0,
                    lastSeen: Date.now(),
                    peripheral: undefined,
                    failedAttempts: 0,
                });
            }
            // --- END MOCK ---
        }
        // --- END HACK ---

        const existingDevice = deviceCache.get(service.fqdn);

        if (existingDevice) {
            // Always update IP/Port in case DHCP changed it
            if (existingDevice.address !== ip || existingDevice.port !== port) {
                log(
                    `[mDNS] Device updated IP: ${existingDevice.name} -> ${ip}:${port}`
                );
                existingDevice.address = ip;
                existingDevice.port = port;
            }
            existingDevice.lastSeen = Date.now();
            // log(`[mDNS] Refreshed 'ready' device: ${existingDevice.name}`);
        } else {
            const device: DiscoveredDevice = {
                id: service.fqdn,
                name: service.name,
                state: 'ready',
                address: ip,
                port: port,
                lastSeen: Date.now(),
                failedAttempts: 0,
            };
            deviceCache.set(device.id, device);
            log(
                `[mDNS] Found new 'ready' device: ${device.name} (ID: ${device.id}) at ${ip}:${port}`
            );
        }
    });

    // Note: We intentionally ignore 'down' events here.
    // We rely on the HTTP Heartbeat and the Pruner to remove devices.
    // This prevents devices from flickering during brief network drops or reboots.
}

/**
 * Active HTTP Heartbeat.
 * Checks if 'ready' devices are still reachable via HTTP.
 */
async function performHealthChecks() {
    const checks = Array.from(deviceCache.values()).map(async (device) => {
        // Only check 'ready' devices (not BLE)
        if (device.state !== 'ready') return;
        // Don't check the mock
        if (device.id === FAKE_BLE_DEVICE_ID) return;

        const targetUrl = buildTargetUrl(
            device.address,
            device.port,
            '/status'
        );
        try {
            // Short timeout to just ping existence
            await axios.get(targetUrl, { timeout: 1500 });

            // Success: Reset counters and update timestamp
            device.lastSeen = Date.now();
            device.failedAttempts = 0;
        } catch (e) {
            // Failure: Increment strike counter
            device.failedAttempts = (device.failedAttempts || 0) + 1;

            log(
                `[Health] Device ${device.name} failed check (${device.failedAttempts}/3)`
            );

            // STRIKE 3: REMOVE IMMEDIATELY
            if (device.failedAttempts >= 3) {
                log(
                    `[Health] Device ${device.name} unreachable for 3 attempts. Removing from cache.`
                );
                deviceCache.delete(device.id);
            }
        }
    });
    await Promise.all(checks);
}

/**
 * Fully stops and restarts the mDNS cycle.
 */
function resetMDNSDiscovery() {
    log('[mDNS] Resetting mDNS discovery...');
    cycleMDNSBrowser();
}

/**
 * Starts all continuous background discovery services.
 */
function startDiscoveryService() {
    log('Starting background discovery services...');

    // 1. Start mDNS (Radar Sweep)
    ensureBonjourInstance();
    cycleMDNSBrowser();

    // 2. Start BLE (Noble) Scanner - (Unchanged)
    noble.on('stateChange', async (state) => {
        if (state === 'poweredOn') {
            log('[BLE] Noble powered on. Starting scan for new devices...');
            await noble.startScanningAsync([PROV_SERVICE_UUID], true);
        } else {
            log(`[BLE] Noble state: ${state}. Stopping scan.`);
            await noble.stopScanningAsync();
        }
    });

    noble.on('discover', (peripheral) => {
        const existingDevice = deviceCache.get(peripheral.uuid);
        if (existingDevice) {
            existingDevice.lastSeen = Date.now();
            existingDevice.peripheral = peripheral;
        } else {
            const device: DiscoveredDevice = {
                id: peripheral.uuid,
                name: peripheral.advertisement.localName || 'Lobster Lock',
                state: 'new_unprovisioned',
                address: peripheral.id,
                port: 0,
                lastSeen: Date.now(),
                peripheral: peripheral,
                failedAttempts: 0,
            };
            deviceCache.set(device.id, device);
            log(`[BLE] Found new device: ${device.name} (ID: ${device.id})`);
        }
    });

    // --- TIMERS (Added for Robustness) ---

    // 3. The "Radar Sweep" (Every 30s)
    // Re-broadcasts mDNS query to find devices that joined silently.
    setInterval(() => {
        cycleMDNSBrowser();
    }, 30000);

    // 4. The "Heartbeat" (Every 5s)
    // Actively pings devices via HTTP to keep them alive in cache.
    setInterval(() => {
        performHealthChecks();
    }, 5000);

    // 5. Cache Pruning (Every 60s)
    // Removes devices not seen (via mDNS or HTTP) for 2 minutes.
    setInterval(() => {
        const now = Date.now();
        const STALE_THRESHOLD = 120000; // 2 minutes

        for (const [id, device] of deviceCache.entries()) {
            if (device.lastSeen < now - STALE_THRESHOLD) {
                log(
                    `[Cache] Pruning stale ${device.state} device: ${device.name} (ID: ${id})`
                );
                deviceCache.delete(id);
            }
        }
    }, 60000);
}

// =================================================================
// --- API Endpoints ---
// =================================================================

/**
 * Lists all currently discoverable devices from the cache.
 */
app.get('/api/devices', (_: Request, res: Response) => {
    const deviceList = Array.from(deviceCache.values()).map((d) => ({
        id: d.id,
        name: d.name,
        state: d.state,
        address: d.address,
        lastSeen: d.lastSeen,
    }));
    res.json(deviceList);
});

/**
 * Provisions a "new" (BLE) device with Wi-Fi credentials and settings.
 */
app.post('/api/devices/:id/provision', async (req: Request, res: Response) => {
    const { id } = req.params;

    // Extract all fields from the body
    const { ssid, pass, enableStreaks, enablePaybackTime, paybackTimeMinutes } =
        req.body as DeviceProvisioningData;

    // Validate all required fields
    const missingFields = [
        { key: 'ssid', val: ssid },
        { key: 'pass', val: pass },
        { key: 'enableStreaks', val: enableStreaks },
        { key: 'enablePaybackTime', val: enablePaybackTime },
        { key: 'paybackTimeMinutes', val: paybackTimeMinutes },
    ]
        .filter(
            (field: { key: string; val: unknown }) => field.val === undefined
        )
        .map((field) => field.key);

    if (missingFields.length > 0) {
        return res.status(400).json({
            status: 'error',
            message: `Missing required fields: ${missingFields.join(', ')}`,
        });
    }

    // --- MOCK PROVISIONING HACK ---
    if (id === FAKE_BLE_DEVICE_ID) {
        log(`[Mock Provision] Faking provisioning for device: ${id}`);
        deviceCache.delete(id);
        res.json({
            status: 'success',
            message:
                'Mock credentials "sent". Device will "appear" on the network shortly.',
        });
        return;
    }
    // --- END HACK ---

    const device = deviceCache.get(id);
    if (!device || !device.peripheral) {
        return res.status(404).json({
            status: 'error',
            message: 'Device not found or is not a BLE device.',
        });
    }

    const peripheral = device.peripheral;
    log(`[Provision] Attempting to provision device: ${device.name}`);

    try {
        await noble.stopScanningAsync();
        log(`[Provision] Connecting to ${peripheral.id}...`);
        await peripheral.connectAsync();
        log(`[Provision] Connected. Discovering services...`);

        // Discover services and characteristics
        const { characteristics } =
            await peripheral.discoverSomeServicesAndCharacteristicsAsync(
                [PROV_SERVICE_UUID],
                [
                    PROV_SSID_CHAR_UUID,
                    PROV_PASS_CHAR_UUID,
                    PROV_ENABLE_STREAKS_CHAR_UUID,
                    PROV_ENABLE_PAYBACK_TIME_CHAR_UUID,
                    PROV_PAYBACK_TIME_CHAR_UUID,
                ]
            );

        const normalize = (uuid: string) =>
            uuid.toLowerCase().replace(/-/g, '');

        const ssidChar = characteristics.find(
            (c) => normalize(c.uuid) === normalize(PROV_SSID_CHAR_UUID)
        );
        const passChar = characteristics.find(
            (c) => normalize(c.uuid) === normalize(PROV_PASS_CHAR_UUID)
        );
        const enableStreaksChar = characteristics.find(
            (c) =>
                normalize(c.uuid) === normalize(PROV_ENABLE_STREAKS_CHAR_UUID)
        );
        const enablePaybackTimeChar = characteristics.find(
            (c) =>
                normalize(c.uuid) ===
                normalize(PROV_ENABLE_PAYBACK_TIME_CHAR_UUID)
        );
        const paybackTimeChar = characteristics.find(
            (c) => normalize(c.uuid) === normalize(PROV_PAYBACK_TIME_CHAR_UUID)
        );

        // Validate required characteristics
        if (
            !ssidChar ||
            !passChar ||
            !enableStreaksChar ||
            !enablePaybackTimeChar ||
            !paybackTimeChar
        ) {
            log(`[Provision] Missing characteristics:
                ssid: ${!!ssidChar}, pass: ${!!passChar},
                enableStreaks: ${!!enableStreaksChar},
                enablePaybackTime: ${!!enablePaybackTimeChar}, paybackTime: ${!!paybackTimeChar}
            `);
            throw new Error(
                'Could not find all required provisioning characteristics.'
            );
        }

        log(`[Provision] Writing credentials and settings...`);

        // --- DATA CONVERSION ---
        // LE = Little-Endian, BE = Big-Endian.

        // enableStreaks (boolean) -> 1-byte Buffer
        const enableStreaksBuf = Buffer.alloc(1);
        enableStreaksBuf.writeUInt8(enableStreaks ? 1 : 0, 0);

        // enablePaybackTime (boolean) -> 1-byte Buffer
        const enablePaybackTimeBuf = Buffer.alloc(1);
        enablePaybackTimeBuf.writeUInt8(enablePaybackTime ? 1 : 0, 0);

        // paybackTimeMinutes (number) -> 2-byte Buffer (UInt16 LE)
        const paybackTimeBuf = Buffer.alloc(2);
        paybackTimeBuf.writeUInt16LE(paybackTimeMinutes, 0);
        // --- END DATA CONVERSION ---

        await ssidChar.writeAsync(Buffer.from(ssid), false);
        await passChar.writeAsync(Buffer.from(pass || ''), false);
        await enableStreaksChar.writeAsync(enableStreaksBuf, false);
        await enablePaybackTimeChar.writeAsync(enablePaybackTimeBuf, false);
        await paybackTimeChar.writeAsync(paybackTimeBuf, false);

        log(`[Provision] Credentials and settings sent! Disconnecting...`);
        await peripheral.disconnectAsync();
        deviceCache.delete(id);
        res.json({
            status: 'success',
            message:
                'Credentials sent. Device is rebooting and should appear on the network shortly.',
        });
    } catch (error: unknown) {
        let message = 'An unknown provisioning error occurred';
        if (error instanceof Error) {
            message = error.message;
        }
        log(`[Provision] FAILED: ${message}`);
        res.status(500).json({
            status: 'error',
            message: `Provisioning failed: ${message}`,
        });
        await peripheral.disconnectAsync().catch(() => {});
    } finally {
        if (noble._state === 'poweredOn') {
            await noble.startScanningAsync([PROV_SERVICE_UUID], true);
        }
    }
});

/**
 * Updates the Wi-Fi credentials on a "ready" device.
 */
app.post(
    '/api/devices/:id/update-wifi',
    async (req: Request, res: Response) => {
        const { id } = req.params;
        const device = deviceCache.get(id);
        if (!device || device.state !== 'ready') {
            return res.status(404).json({
                status: 'error',
                message: 'Device not found or not ready.',
            });
        }

        const { ssid, pass } = req.body;
        if (!ssid || pass === undefined) {
            return res.status(400).json({
                status: 'error',
                message: 'Missing required fields: ssid, pass.',
            });
        }

        const targetUrl = buildTargetUrl(
            device.address,
            device.port,
            '/update-wifi'
        );
        try {
            log(`Forwarding /update-wifi to ${targetUrl}`);
            const lockResponse = await axios.post(
                targetUrl,
                { ssid, pass },
                { timeout: 5000 }
            );
            refreshDeviceTimestamp(id);
            res.status(lockResponse.status).json(lockResponse.data);
        } catch (error: unknown) {
            let status = 500;
            let message = 'Failed to communicate with the lock device.';

            if (isAxiosError(error)) {
                status = error.response?.status || 500;
                message = error.response?.data?.message || error.message;
            } else if (error instanceof Error) {
                message = error.message;
            }
            log(`Failed to update Wi-Fi: ${message}`);
            res.status(status).json({ status: 'error', message });
        }
    }
);

/**
 * Forgets a "ready" device.
 */
app.post(
    '/api/devices/:id/factory-reset',
    async (req: Request, res: Response) => {
        const { id } = req.params;
        const device = deviceCache.get(id);
        if (!device || device.state !== 'ready') {
            return res.status(404).json({
                status: 'error',
                message: 'Device not found or not ready.',
            });
        }

        const targetUrl = buildTargetUrl(
            device.address,
            device.port,
            '/factory-reset'
        );
        try {
            log(`Forwarding /factory-reset request to ${targetUrl}`);
            // Expect a timeout because the device reboots
            await axios.post(targetUrl, {}, { timeout: 2000 });
            log(
                `Device ${id} responded to factory-reset. Removing from cache.`
            );
        } catch (error: unknown) {
            // Expected timeout handling...
            if (
                isAxiosError(error) &&
                (error.code === 'ECONNABORTED' ||
                    error.response?.status === 504)
            ) {
                log(
                    `Device ${id} did not respond (timeout), expected during reset.`
                );
            } else {
                // ... (simplified for brevity but logic remains)
            }
        }

        deviceCache.delete(id);
        log(`Device ${id} reset and removed from cache.`);
        resetMDNSDiscovery();

        res.status(200).json({
            status: 'success',
            message: 'Reset command sent. Device is rebooting.',
        });
    }
);

/**
 * Gets the raw device logs.
 */
app.get('/api/devices/:id/log', async (req: Request, res: Response) => {
    const { id } = req.params;
    const device = deviceCache.get(id);
    if (!device || device.state !== 'ready') {
        return res.status(404).send('Device not found or not ready.');
    }

    const targetUrl = buildTargetUrl(device.address, device.port, '/log');
    try {
        const lockResponse = await axios.get(targetUrl, {
            responseType: 'text',
            timeout: 2000,
        });
        refreshDeviceTimestamp(id);
        res.status(lockResponse.status).send(lockResponse.data);
    } catch (error: unknown) {
        let status = 500;
        let message = 'Failed to fetch device logs.';
        if (isAxiosError(error)) {
            status = error.response?.status || 500;
            message = error.response?.data?.message || error.message;
        } else if (error instanceof Error) {
            message = error.message;
        }
        log(`Failed to fetch device logs: ${message}`);
        res.status(status).send(message);
    }
});

/**
 * Gets the static details for a "ready" device.
 */
app.get('/api/devices/:id/details', async (req: Request, res: Response) => {
    const { id } = req.params;
    const device = deviceCache.get(id);

    if (!device || device.state !== 'ready') {
        return res.status(404).json({
            status: 'error',
            message: 'Device not found or not ready.',
        });
    }

    const targetUrl = buildTargetUrl(device.address, device.port, '/details');
    try {
        log(`[Details] Forwarding /details request to ${targetUrl}`);
        const lockResponse = await axios.get(targetUrl, { timeout: 3000 });

        refreshDeviceTimestamp(id);

        const deviceDetails = lockResponse.data;
        deviceDetails.id = id;
        res.status(lockResponse.status).json(deviceDetails);
    } catch (error: unknown) {
        let status = 500;
        let message = 'Failed to fetch device details.';
        if (isAxiosError(error)) {
            status = error.response?.status || 500;
            message = error.response?.data?.message || error.message;
        } else if (error instanceof Error) {
            message = error.message;
        }
        log(`[Details] Failed to get details from ${targetUrl}: ${message}`);
        res.status(status).json({ status: 'error', message });
    }
});

// =================================================================
// --- Session & Health Endpoints ---
// =================================================================

/**
 * Health check endpoint.
 */
app.get('/api/devices/:id/health', async (req: Request, res: Response) => {
    const { id } = req.params;
    const device = deviceCache.get(id);

    if (!device || device.state !== 'ready') {
        log(`[Health] Failed: Device ${id} not found in cache.`);
        return res
            .status(404)
            .json({ status: 'error', message: 'Device not found.' });
    }

    const targetUrl = buildTargetUrl(device.address, device.port, '/status');
    try {
        await axios.get(targetUrl, { timeout: 2000 });
        refreshDeviceTimestamp(id);
        res.status(200).json({ status: 'ok' });
    } catch (error: unknown) {
        let message = 'Device is unreachable.';
        if (isAxiosError(error)) message = error.message;
        else if (error instanceof Error) message = error.message;
        log(
            `[Health] Failed: Device ${id} at ${targetUrl} is unreachable: ${message}`
        );
        res.status(503).json({
            status: 'error',
            message: 'Device is unreachable.',
        });
    }
});

/**
 * Keep-alive endpoint.
 */
app.post('/api/devices/:id/keepalive', async (req: Request, res: Response) => {
    const { id } = req.params;
    const device = deviceCache.get(id);

    if (!device) {
        return res.status(404).json({
            status: 'error',
            message: 'Device not in cache.',
        });
    }

    refreshDeviceTimestamp(id);

    if (device.state === 'ready') {
        const targetUrl = buildTargetUrl(
            device.address,
            device.port,
            '/keepalive'
        );
        try {
            await axios.post(targetUrl, {}, { timeout: 2000 });
            return res.status(200).json({ status: 'ok' });
        } catch (error: unknown) {
            let message = 'Device is unreachable.';
            if (isAxiosError(error)) message = error.message;
            else if (error instanceof Error) message = error.message;
            log(
                `[KeepAlive] Failed to forward keep-alive to ${device.name}: ${message}`
            );
            return res.status(503).json({
                status: 'error',
                message: 'Device is unreachable.',
            });
        }
    } else {
        return res.status(200).json({ status: 'ok' });
    }
});

/**
 * Gets the current device status.
 */
app.get(
    '/api/devices/:id/session/status',
    async (req: Request, res: Response) => {
        const { id } = req.params;
        const device = deviceCache.get(id);

        const errorResponse = {
            status: 'ready',
            message: 'Device not found or not ready.',
            lockTimeRemainingSeconds: 0,
            penaltyTimeRemainingSeconds: 0,
            rewardTimeRemainingSeconds: 0,
            testTimeRemainingSeconds: 0,
            hideTimer: false,
            channelDelaysRemainingSeconds: [],
            streaks: 0,
            totalLockedSessionTimeSeconds: 0,
            pendingPaybackSeconds: 0,
        };

        if (!device || device.state !== 'ready') {
            log(`Failed to get status: Device ${id} not found or not ready.`);
            return res.status(200).json(errorResponse);
        }

        const targetUrl = buildTargetUrl(
            device.address,
            device.port,
            '/status'
        );
        try {
            const lockResponse = await axios.get(targetUrl, { timeout: 2000 });
            refreshDeviceTimestamp(id);
            res.status(lockResponse.status).json(lockResponse.data);
        } catch (error: unknown) {
            let message = 'Failed to communicate with the lock device.';
            if (isAxiosError(error)) message = error.message;
            else if (error instanceof Error) message = error.message;

            log(`Failed to get lock status from ${targetUrl}: ${message}`);
            errorResponse.message =
                'Failed to communicate with the lock device.';
            res.status(200).json(errorResponse);
        }
    }
);

/**
 * Starts a new session.
 */
app.post(
    '/api/devices/:id/session/start',
    async (req: Request, res: Response) => {
        const { id } = req.params;
        const device = deviceCache.get(id);
        if (!device || device.state !== 'ready') {
            return res.status(404).json({
                status: 'error',
                message: 'Device not found or not ready.',
            });
        }

        const targetUrl = buildTargetUrl(device.address, device.port, '/start');
        try {
            const jsonPayload = req.body;
            log(
                `Forwarding /start to ${targetUrl} with JSON payload: ${JSON.stringify(jsonPayload)}`
            );
            const lockResponse = await axios.post(targetUrl, jsonPayload, {
                timeout: 5000,
            });
            refreshDeviceTimestamp(id);
            res.status(lockResponse.status).json(lockResponse.data);
        } catch (error: unknown) {
            let status = 500;
            let message = 'Failed to communicate with the lock device.';
            if (isAxiosError(error)) {
                status = error.response?.status || 500;
                message = error.response?.data?.message || error.message;
            } else if (error instanceof Error) {
                message = error.message;
            }
            log(`Failed to start session: ${message}`);
            res.status(status).json({ status: 'error', message });
        }
    }
);

/**
 * Starts a test session.
 */
app.post(
    '/api/devices/:id/session/test',
    async (req: Request, res: Response) => {
        const { id } = req.params;
        const device = deviceCache.get(id);
        if (!device || device.state !== 'ready') {
            return res.status(404).json({
                status: 'error',
                message: 'Device not found or not ready.',
            });
        }

        const targetUrl = buildTargetUrl(
            device.address,
            device.port,
            '/start-test'
        );
        try {
            log(`Forwarding /start-test request to ${targetUrl}`);
            const lockResponse = await axios.post(
                targetUrl,
                {},
                { timeout: 3000 }
            );
            refreshDeviceTimestamp(id);
            res.status(lockResponse.status).json(lockResponse.data);
        } catch (error: unknown) {
            let status = 500;
            let message = 'Failed to start test mode.';
            if (isAxiosError(error)) {
                status = error.response?.status || 500;
                message = error.response?.data?.message || error.message;
            } else if (error instanceof Error) {
                message = error.message;
            }
            log(`Failed to start test: ${message}`);
            res.status(status).json({ status: 'error', message });
        }
    }
);

/**
 * Aborts the current session.
 */
app.post(
    '/api/devices/:id/session/abort',
    async (req: Request, res: Response) => {
        const { id } = req.params;
        const device = deviceCache.get(id);
        if (!device || device.state !== 'ready') {
            return res.status(404).json({
                status: 'error',
                message: 'Device not found or not ready.',
            });
        }

        const targetUrl = buildTargetUrl(device.address, device.port, '/abort');
        try {
            const lockResponse = await axios.post(
                targetUrl,
                {},
                { timeout: 3000 }
            );
            refreshDeviceTimestamp(id);
            log(
                `Forwarded /abort to ${targetUrl}. Lock responded with status: ${lockResponse.data?.status}`
            );
            res.status(lockResponse.status).json(lockResponse.data);
        } catch (error: unknown) {
            let status = 500;
            let message = 'Failed to communicate with the lock device.';
            if (isAxiosError(error)) {
                status = error.response?.status || 500;
                message = error.response?.data?.message || error.message;
            } else if (error instanceof Error) {
                message = error.message;
            }
            log(`Failed to abort session: ${message}`);
            res.status(status).json({ status: 'error', message });
        }
    }
);

/**
 * Gets the reward code history.
 */
app.get(
    '/api/devices/:id/session/reward',
    async (req: Request, res: Response) => {
        const { id } = req.params;
        const device = deviceCache.get(id);
        if (!device || device.state !== 'ready') {
            return res.status(404).json({
                status: 'error',
                message: 'Device not found or not ready.',
            });
        }

        const targetUrl = buildTargetUrl(
            device.address,
            device.port,
            '/reward'
        );
        try {
            const lockResponse = await axios.get(targetUrl, { timeout: 2000 });
            refreshDeviceTimestamp(id);
            res.status(lockResponse.status).json(lockResponse.data);
        } catch (error: unknown) {
            let status = 500;
            let message = 'Failed to fetch reward history.';
            if (isAxiosError(error)) {
                status = error.response?.status || 500;
                message = error.response?.data?.message || error.message;
            } else if (error instanceof Error) {
                message = error.message;
            }
            log(`Failed to fetch reward history: ${message}`);
            res.status(status).json({ status: 'error', message });
        }
    }
);

// --- Server Initialization ---
app.listen(PORT, () => {
    log(`Stateless proxy server running on http://localhost:${PORT}`);
    log(`Device discovery and provisioning services starting...`);
    startDiscoveryService();

    console.log('LOBSTER_BACKEND_READY');
});
