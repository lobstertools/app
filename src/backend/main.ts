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
import noble, { Peripheral } from '@abandonware/noble';
import { DeviceProvisioningData } from '../types';

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
const PROV_ABORT_DELAY_CHAR_UUID = '5a160003-8334-469b-a316-c340cf29188f';
const PROV_COUNT_STREAKS_CHAR_UUID = '5a160004-8334-469b-a316-c340cf29188f';
const PROV_ENABLE_PAYBACK_CHAR_UUID = '5a160005-8334-469b-a316-c340cf29188f';
const PROV_ABORT_PAYBACK_CHAR_UUID = '5a160006-8334-469b-a316-c340cf29188f';

// mDNS Service Type
const MDNS_SERVICE_TYPE = 'lobster-lock';

// --- MOCK CONSTANT ---
const FAKE_BLE_DEVICE_ID = 'mock-ble-device-id-123';

// In-memory cache
interface DiscoveredDevice {
    id: string; // mDNS fqdn or BLE peripheral UUID
    name: string; // 'lobster-lock' (mDNS) or 'Lobster Lock-XYZ' (BLE)
    state: 'ready' | 'new_unprovisioned';
    address: string; // IP address (mDNS) or peripheral.id (BLE)
    port: number;
    lastSeen: number; // Date.now()
    peripheral?: Peripheral; // Store the noble object for BLE devices
}
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

// --- mDNS Discovery Functions ---

/**
 * Starts the mDNS (Bonjour) discovery service.
 */
function startMDNSDiscovery() {
    log('[mDNS] Starting mDNS discovery service...');
    bonjourInstance = Bonjour();
    bonjourBrowser = bonjourInstance.find({
        type: MDNS_SERVICE_TYPE,
        protocol: 'tcp',
    });

    // Called when a device appears on the network
    bonjourBrowser.on('up', (service) => {
        // Select the first valid IPv4 address if available, otherwise fallback to IPv6
        let ip =
            service.addresses.find((addr) => !addr.includes(':')) ||
            service.addresses[0];
        const port = service.port; // <-- Capture port

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
                    address: FAKE_BLE_DEVICE_ID, // Use ID as address
                    port: 0,
                    lastSeen: Date.now(),
                    peripheral: undefined, // No real peripheral
                });
            }
            // --- END MOCK ---
        }
        // --- END HACK ---

        const existingDevice = deviceCache.get(service.fqdn);

        if (existingDevice) {
            existingDevice.address = ip; // Update IP
            existingDevice.port = port; // Update port
            existingDevice.lastSeen = Date.now();
            log(
                `[mDNS] Refreshed 'ready' device: ${existingDevice.name} (ID: ${existingDevice.id}) at ${ip}:${port}`
            );
        } else {
            const device: DiscoveredDevice = {
                id: service.fqdn,
                name: service.name,
                state: 'ready',
                address: ip,
                port: port,
                lastSeen: Date.now(),
            };
            deviceCache.set(device.id, device);
            log(
                `[mDNS] Found new 'ready' device: ${device.name} (ID: ${device.id}) at ${ip}:${port}`
            );
        }
    });

    // Called when a device gracefully leaves the network
    bonjourBrowser.on('down', (service) => {
        deviceCache.delete(service.fqdn);
        log(`[mDNS] Device offline: ${service.name} (ID: ${service.fqdn})`);
    });
}

/**
 * Fully stops and destroys the mDNS service to clear its internal cache.
 * This is called by /forget to handle ungraceful reboots.
 */
function resetMDNSDiscovery() {
    log('[mDNS] Resetting mDNS service. Destroying old instance...');
    if (bonjourBrowser) {
        bonjourBrowser.stop();
        bonjourBrowser = null;
    }
    if (bonjourInstance) {
        bonjourInstance.destroy();
        bonjourInstance = null;
    }
    // Start fresh
    startMDNSDiscovery();
}

/**
 * Starts all continuous background discovery services.
 * (mDNS, BLE, and the cache pruner)
 */
function startDiscoveryService() {
    log('Starting background discovery services...');

    // 1. mDNS (Bonjour) Scanner
    startMDNSDiscovery();

    // 2. BLE (Noble) Scanner
    noble.on('stateChange', async (state) => {
        if (state === 'poweredOn') {
            log('[BLE] Noble powered on. Starting scan for new devices...');
            await noble.startScanningAsync([PROV_SERVICE_UUID], true); // allowDuplicates = true
        } else {
            log(`[BLE] Noble state: ${state}. Stopping scan.`);
            await noble.stopScanningAsync();
        }
    });

    // Called when a BLE device advertisement is seen
    noble.on('discover', (peripheral) => {
        const existingDevice = deviceCache.get(peripheral.uuid);
        if (existingDevice) {
            // Just refresh the timestamp
            existingDevice.lastSeen = Date.now();
            existingDevice.peripheral = peripheral;
        } else {
            // Add as a new unprovisioned device
            const device: DiscoveredDevice = {
                id: peripheral.uuid,
                name: peripheral.advertisement.localName || 'Lobster Lock',
                state: 'new_unprovisioned',
                address: peripheral.id,
                port: 0,
                lastSeen: Date.now(),
                peripheral: peripheral,
            };
            deviceCache.set(device.id, device);
            log(`[BLE] Found new device: ${device.name} (ID: ${device.id})`);
        }
    });

    // 3. Cache Pruning (removes stale devices)
    setInterval(() => {
        const now = Date.now();
        // This gives throttled browser tabs ample time to check in.
        const staleTime = now - 300000; // 5 minutes
        for (const [id, device] of deviceCache.entries()) {
            if (device.lastSeen < staleTime) {
                log(
                    `[Cache] Pruning stale ${device.state} device: ${device.name} (ID: ${id})`
                );
                deviceCache.delete(id);
            }
        }
    }, 30000); // Pruner still *runs* every 30 seconds

    // 4. Server-Side Keep-Alive Poller
    setInterval(async () => {
        for (const [id, device] of deviceCache.entries()) {
            if (device.state === 'ready') {
                const targetUrl = buildTargetUrl(
                    device.address,
                    device.port,
                    '/status' // Polling /status is a good keep-alive
                );
                try {
                    await axios.get(targetUrl, { timeout: 2000 });
                    refreshDeviceTimestamp(id);
                } catch (error: unknown) {
                    let message = 'Unknown error';
                    if (isAxiosError(error)) {
                        message = error.message;
                    } else if (error instanceof Error) {
                        message = error.message;
                    }
                    log(
                        `[KeepAlive] Device ${device.name} (ID: ${id}) failed keep-alive poll: ${message}`
                    );
                }
            }
        }
    }, 30000); // Poll every 30 seconds
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
    const {
        ssid,
        pass,
        abortDelaySeconds,
        countStreaks,
        enableTimePayback,
        abortPaybackMinutes,
    } = req.body as DeviceProvisioningData;

    // Validate all required fields
    const missingFields = [
        { key: 'ssid', val: ssid },
        { key: 'pass', val: pass },
        { key: 'abortDelaySeconds', val: abortDelaySeconds },
        { key: 'countStreaks', val: countStreaks },
        { key: 'enableTimePayback', val: enableTimePayback },
        { key: 'abortPaybackMinutes', val: abortPaybackMinutes },
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
        log(`[Mock Provision] Received SSID: ${ssid}`);
        // Pretend it was successful.
        // Delete the fake BLE device (it's "rebooting")
        deviceCache.delete(id);
        // The 'ready' Mock-LobsterLock is already present from mDNS,
        // so the UI will see the "new" device disappear and the "ready"
        // one is all that remains.
        res.json({
            status: 'success',
            message:
                'Mock credentials "sent". Device will "appear" on the network shortly.',
        });
        // We must return here to stop the real logic.
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

        // Discover ALL characteristics at once
        const { characteristics } =
            await peripheral.discoverSomeServicesAndCharacteristicsAsync(
                [PROV_SERVICE_UUID],
                [
                    PROV_SSID_CHAR_UUID,
                    PROV_PASS_CHAR_UUID,
                    PROV_ABORT_DELAY_CHAR_UUID,
                    PROV_COUNT_STREAKS_CHAR_UUID,
                    PROV_ENABLE_PAYBACK_CHAR_UUID,
                    PROV_ABORT_PAYBACK_CHAR_UUID,
                ]
            );

        // main.ts
        const normalize = (uuid: string) =>
            uuid.toLowerCase().replace(/-/g, '');

        const ssidChar = characteristics.find(
            (c) => normalize(c.uuid) === normalize(PROV_SSID_CHAR_UUID)
        );
        const passChar = characteristics.find(
            (c) => normalize(c.uuid) === normalize(PROV_PASS_CHAR_UUID)
        );
        const abortDelayChar = characteristics.find(
            (c) => normalize(c.uuid) === normalize(PROV_ABORT_DELAY_CHAR_UUID)
        );
        const countStreaksChar = characteristics.find(
            (c) => normalize(c.uuid) === normalize(PROV_COUNT_STREAKS_CHAR_UUID)
        );
        const enablePaybackChar = characteristics.find(
            (c) =>
                normalize(c.uuid) === normalize(PROV_ENABLE_PAYBACK_CHAR_UUID)
        );
        const abortPaybackChar = characteristics.find(
            (c) => normalize(c.uuid) === normalize(PROV_ABORT_PAYBACK_CHAR_UUID)
        );

        // Validate ALL characteristics
        if (
            !ssidChar ||
            !passChar ||
            !abortDelayChar ||
            !countStreaksChar ||
            !enablePaybackChar ||
            !abortPaybackChar
        ) {
            // Check which one is missing for a better error message (optional)
            log(`[Provision] Missing characteristics:
                ssid: ${!!ssidChar}, pass: ${!!passChar},
                abortDelay: ${!!abortDelayChar}, countStreaks: ${!!countStreaksChar},
                enablePayback: ${!!enablePaybackChar}, abortPayback: ${!!abortPaybackChar}
            `);
            throw new Error(
                'Could not find all required provisioning characteristics.'
            );
        }

        log(`[Provision] Writing credentials and settings...`);

        // --- DATA CONVERSION ---
        // LE = Little-Endian, BE = Big-Endian.

        // abortDelaySeconds (number) -> 4-byte Buffer (UInt32 LE)
        const abortDelayBuf = Buffer.alloc(4);
        abortDelayBuf.writeUInt32LE(abortDelaySeconds, 0);

        // countStreaks (boolean) -> 1-byte Buffer
        const countStreaksBuf = Buffer.alloc(1);
        countStreaksBuf.writeUInt8(countStreaks ? 1 : 0, 0);

        // wnableTimePayback (boolean) -> 1-byte Buffer
        const enablePaybackBuf = Buffer.alloc(1);
        enablePaybackBuf.writeUInt8(enableTimePayback ? 1 : 0, 0);

        // abortPaybackMinutes (number) -> 2-byte Buffer (UInt16 LE)
        const abortPaybackBuf = Buffer.alloc(2);
        abortPaybackBuf.writeUInt16LE(abortPaybackMinutes, 0);
        // --- END DATA CONVERSION ---

        await ssidChar.writeAsync(Buffer.from(ssid), false);
        await passChar.writeAsync(Buffer.from(pass || ''), false);
        await abortDelayChar.writeAsync(abortDelayBuf, false);
        await countStreaksChar.writeAsync(countStreaksBuf, false);
        await enablePaybackChar.writeAsync(enablePaybackBuf, false);
        await abortPaybackChar.writeAsync(abortPaybackBuf, false);

        log(`[Provision] Credentials and settings sent! Disconnecting...`);
        await peripheral.disconnectAsync();
        deviceCache.delete(id); // Remove from cache
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
        await peripheral.disconnectAsync().catch(() => {}); // Best-effort disconnect
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
                { ssid, pass }, // Forward the JSON payload
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
 * This tells the device to erase its Wi-Fi credentials and reboot.
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

        // Renamed endpoint on device from /forget to /factory-reset
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
            if (isAxiosError(error)) {
                if (
                    error.code === 'ECONNABORTED' ||
                    error.response?.status === 504
                ) {
                    log(
                        `Device ${id} did not respond (timeout), which is expected during reset.`
                    );
                } else {
                    const status = error.response?.status || 500;
                    const message =
                        error.response?.data?.message ||
                        'Failed to send reset command.';
                    log(`Failed to reset device: ${message}`);
                    res.status(status).json({ status: 'error', message });
                    return;
                }
            } else {
                // Handle non-Axios errors
                const message =
                    error instanceof Error
                        ? error.message
                        : 'An unknown error occurred';
                log(`Failed to reset device: ${message}`);
                res.status(500).json({ status: 'error', message });
                return;
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
 * This is called by the frontend when a device is selected.
 */
app.get('/api/devices/:id/details', async (req: Request, res: Response) => {
    const { id } = req.params; // This 'id' is the correct fqdn
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

        // Send the corrected object back to the frontend
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
        if (isAxiosError(error)) {
            message = error.message;
        } else if (error instanceof Error) {
            message = error.message;
        }
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
app.post('/api/devices/:id/keepalive', (req: Request, res: Response) => {
    const { id } = req.params;
    const device = deviceCache.get(id);

    if (device) {
        refreshDeviceTimestamp(id);
        res.status(200).json({ status: 'ok' });
    } else {
        res.status(404).json({
            status: 'error',
            message: 'Device not in cache.',
        });
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

        // This error object matches the SessionStatusResponse type
        const errorResponse = {
            status: 'ready', // 'ready' is a safe default
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
            if (isAxiosError(error)) {
                message = error.message;
            } else if (error instanceof Error) {
                message = error.message;
            }
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
