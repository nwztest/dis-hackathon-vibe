"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { DeviceRecord } from "@/lib/data";
import type { Room, SeniorHome } from "@/lib/mock-data";

type SerialPortLike = {
  open(options: { baudRate: number }): Promise<void>;
  close(): Promise<void>;
  readable: ReadableStream<Uint8Array> | null;
  writable: WritableStream<Uint8Array> | null;
};
type SerialNavigator = Navigator & {
  serial?: { requestPort(options?: { filters?: Array<{ usbVendorId?: number }> }): Promise<SerialPortLike> };
};
type SerialResult = {
  requestId?: string;
  ok?: boolean;
  code?: string;
  message?: string;
  data?: Record<string, unknown>;
};
const SERIAL_COMMAND_TIMEOUT_MS = 90_000;
const SERIAL_HANDSHAKE_TIMEOUT_MS = 15_000;
export type ProvisionedDevice = {
  id: string;
  roomId: string;
  roomName: string;
  cameraProfile: string;
  captureIntervalMs: number;
  firmwareVersion: string;
  status: string;
  configuredAt: string;
  homeLabel?: string;
  lastSeenAt?: string | null;
};
export type DeviceTestResults = {
  wifi: boolean;
  api: boolean;
  inference: boolean;
  heartbeat: boolean;
  message: string;
};
type SetupContextValue = {
  rooms: Room[];
  homes: SeniorHome[];
  devices: DeviceRecord[];
  role: string;
  selectedRoomId: string;
  selectedRoom?: Room;
  selectedDevice?: DeviceRecord;
  deviceUid: string;
  setDeviceUid(value: string): void;
  selectRoom(roomId: string): void;
  provisioningConfigured: boolean;
  serialSupported: boolean;
  secureContext: boolean;
  serialConnected: boolean;
  serialMessage: string;
  connectSerial(): Promise<void>;
  provision(input: { ssid: string; password: string; apiBaseUrl: string }): Promise<void>;
  runTests(): Promise<void>;
  refreshSummary(): Promise<void>;
  provisionedDevice?: ProvisionedDevice;
  testResults?: DeviceTestResults;
  busy: boolean;
  error: string;
};

const SetupContext = createContext<SetupContextValue | null>(null);

export function DeviceSetupProvider({
  children, rooms, homes, devices, role, provisioningConfigured,
}: {
  children: React.ReactNode;
  rooms: Room[];
  homes: SeniorHome[];
  devices: DeviceRecord[];
  role: string;
  provisioningConfigured: boolean;
}) {
  const firstCameraRoom = rooms.find((room) => room.type === "room");
  const [selectedRoomId, setSelectedRoomId] = useState(firstCameraRoom?.id ?? rooms[0]?.id ?? "");
  const [deviceUid, setDeviceUid] = useState("");
  const [serialSupported, setSerialSupported] = useState(false);
  const [secureContext, setSecureContext] = useState(false);
  const [serialConnected, setSerialConnected] = useState(false);
  const [serialMessage, setSerialMessage] = useState("Not connected");
  const [provisionedDevice, setProvisionedDevice] = useState<ProvisionedDevice>();
  const [testResults, setTestResults] = useState<DeviceTestResults>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const portRef = useRef<SerialPortLike | null>(null);
  const readerRef = useRef<ReadableStreamDefaultReader<Uint8Array> | null>(null);
  const pendingRef = useRef(new Map<string, {
    resolve: (result: SerialResult) => void;
    reject: (error: Error) => void;
    timeout: ReturnType<typeof setTimeout>;
  }>());
  const selectedRoom = rooms.find((room) => room.id === selectedRoomId);
  const selectedDevice = devices.find((device) => device.roomId === selectedRoomId);

  useEffect(() => {
    setSecureContext(window.isSecureContext);
    setSerialSupported(Boolean((navigator as SerialNavigator).serial));
  }, []);

  useEffect(() => {
    setDeviceUid(selectedDevice?.id ?? suggestedDeviceId(selectedRoom, homes));
    setProvisionedDevice(undefined);
    setTestResults(undefined);
    setError("");
  }, [selectedRoomId, selectedDevice?.id, selectedRoom, homes]);

  const handleSerialLine = useCallback((line: string) => {
    let message: SerialResult;
    try {
      message = JSON.parse(line) as SerialResult;
    } catch {
      return;
    }
    if (!message.requestId) return;
    const pending = pendingRef.current.get(message.requestId);
    if (!pending) return;
    clearTimeout(pending.timeout);
    pendingRef.current.delete(message.requestId);
    message.ok === false
      ? pending.reject(new Error(message.message || message.code || "Device command failed."))
      : pending.resolve(message);
  }, []);

  const readSerial = useCallback(async (port: SerialPortLike) => {
    if (!port.readable) return;
    const reader = port.readable.getReader();
    readerRef.current = reader;
    const decoder = new TextDecoder();
    let buffered = "";
    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffered += decoder.decode(value, { stream: true });
        const lines = buffered.split(/\r?\n/);
        buffered = lines.pop() ?? "";
        lines.filter(Boolean).forEach(handleSerialLine);
      }
    } catch {
      setSerialConnected(false);
      setSerialMessage("Serial connection closed");
    } finally {
      reader.releaseLock();
      readerRef.current = null;
    }
  }, [handleSerialLine]);

  const connectSerial = useCallback(async () => {
    setError("");
    if (!window.isSecureContext) throw new Error("Web Serial requires a secure browser context.");
    const serial = (navigator as SerialNavigator).serial;
    if (!serial) throw new Error("Web Serial is available in desktop Chrome or Edge.");
    setBusy(true);
    try {
      const port = await serial.requestPort({ filters: [{ usbVendorId: 0x303a }] });
      await port.open({ baudRate: 115200 });
      portRef.current = port;
      void readSerial(port);
      setSerialMessage("Waiting for CareGuard firmware…");
      await new Promise((resolve) => setTimeout(resolve, 1500));

      const requestId = crypto.randomUUID();
      const handshake = new Promise<SerialResult>((resolve, reject) => {
        const timeout = setTimeout(() => {
          pendingRef.current.delete(requestId);
          reject(new Error("The serial port opened, but CareGuard firmware did not answer the status handshake."));
        }, SERIAL_HANDSHAKE_TIMEOUT_MS);
        pendingRef.current.set(requestId, { resolve, reject, timeout });
      });
      if (!port.writable) throw new Error("The selected serial port is not writable.");
      const writer = port.writable.getWriter();
      try {
        await writer.write(new TextEncoder().encode(JSON.stringify({
          protocolVersion: 1,
          command: "status",
          requestId,
        }) + "\n"));
      } finally {
        writer.releaseLock();
      }
      const result = await handshake;
      if (result.data?.cameraProfile !== "esp32s3_cam_common") {
        throw new Error("The connected device is not running the expected ESP32-S3-CAM profile.");
      }
      setSerialConnected(true);
      setSerialMessage("CareGuard ESP32-S3-CAM verified at 115200 baud");
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "Could not open the serial port.";
      setSerialConnected(false);
      void readerRef.current?.cancel();
      void portRef.current?.close();
      portRef.current = null;
      setError(message);
      throw caught;
    } finally {
      setBusy(false);
    }
  }, [readSerial]);

  const sendCommand = useCallback(async (command: string, payload?: Record<string, unknown>) => {
    const port = portRef.current;
    if (!port?.writable) throw new Error("Connect the ESP32-S3 over Web Serial first.");
    const requestId = crypto.randomUUID();
    const line = JSON.stringify({ protocolVersion: 1, command, requestId, ...(payload ? { payload } : {}) }) + "\n";
    const response = new Promise<SerialResult>((resolve, reject) => {
      const timeout = setTimeout(() => {
        pendingRef.current.delete(requestId);
        reject(new Error(`Device did not answer ${command} within 90 seconds.`));
      }, SERIAL_COMMAND_TIMEOUT_MS);
      pendingRef.current.set(requestId, { resolve, reject, timeout });
    });
    const writer = port.writable.getWriter();
    try {
      await writer.write(new TextEncoder().encode(line));
    } finally {
      writer.releaseLock();
    }
    return response;
  }, []);

  const provision = useCallback(async ({ ssid, password, apiBaseUrl }: {
    ssid: string; password: string; apiBaseUrl: string;
  }) => {
    setError("");
    if (role !== "admin") throw new Error("Only administrators can provision devices.");
    if (!provisioningConfigured) throw new Error("Supabase service-role provisioning is not configured.");
    if (!selectedRoom || selectedRoom.type !== "room") throw new Error("Select a camera room. ToF setup is not available yet.");
    if (!serialConnected) throw new Error("Connect the ESP32-S3 over Web Serial first.");
    if (!ssid || !password) throw new Error("Wi-Fi name and password are required.");
    const endpoint = new URL(apiBaseUrl);
    if (endpoint.protocol !== "https:") throw new Error("The device endpoint must use HTTPS.");
    setBusy(true);
    try {
      const response = await fetch("/api/devices/provision", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ roomId: selectedRoom.id, deviceUid }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Credential rotation failed.");
      const plaintextToken = String(body.deviceToken);
      const serialResult = await sendCommand("configure", {
        wifiSsid: ssid,
        wifiPassword: password,
        apiBaseUrl: endpoint.origin,
        deviceId: body.device.id,
        deviceToken: plaintextToken,
        captureIntervalMs: body.device.captureIntervalMs,
        cameraProfile: body.device.cameraProfile,
      });
      setSerialMessage(serialResult.message || "Configuration stored securely on the device");
      setProvisionedDevice(body.device);
      setTestResults(undefined);
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "Provisioning failed.";
      setError(message);
      throw caught;
    } finally {
      setBusy(false);
    }
  }, [deviceUid, provisioningConfigured, role, selectedRoom, sendCommand, serialConnected]);

  const refreshSummary = useCallback(async () => {
    if (!deviceUid) return;
    const response = await fetch(`/api/devices/provision?deviceId=${encodeURIComponent(deviceUid)}`, { cache: "no-store" });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error || "Device status could not be loaded.");
    setProvisionedDevice(body.device);
  }, [deviceUid]);

  const runTests = useCallback(async () => {
    setError("");
    setBusy(true);
    try {
      const status = await sendCommand("status");
      const frame = await sendCommand("test_frame");
      const data = { ...(status.data ?? {}), ...(frame.data ?? {}) };
      await refreshSummary();
      setTestResults({
        wifi: data.wifiConnected === true,
        api: data.apiReachable === true,
        inference: data.inferenceAccepted === true,
        heartbeat: data.heartbeatUpdated === true,
        message: frame.message || "Test frame finished.",
      });
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "Device test failed.";
      setError(message);
      throw caught;
    } finally {
      setBusy(false);
    }
  }, [refreshSummary, sendCommand]);

  useEffect(() => () => {
    for (const pending of pendingRef.current.values()) {
      clearTimeout(pending.timeout);
      pending.reject(new Error("Setup closed."));
    }
    pendingRef.current.clear();
    void readerRef.current?.cancel();
    void portRef.current?.close();
  }, []);

  const value = useMemo<SetupContextValue>(() => ({
    rooms, homes, devices, role, selectedRoomId, selectedRoom, selectedDevice, deviceUid,
    setDeviceUid, selectRoom: setSelectedRoomId, provisioningConfigured, serialSupported,
    secureContext, serialConnected, serialMessage, connectSerial, provision, runTests,
    refreshSummary, provisionedDevice, testResults, busy, error,
  }), [rooms, homes, devices, role, selectedRoomId, selectedRoom, selectedDevice, deviceUid,
    provisioningConfigured, serialSupported, secureContext, serialConnected, serialMessage,
    connectSerial, provision, runTests, refreshSummary, provisionedDevice, testResults, busy, error]);
  return <SetupContext.Provider value={value}>{children}</SetupContext.Provider>;
}

export function useDeviceSetup() {
  const value = useContext(SetupContext);
  if (!value) throw new Error("useDeviceSetup must be used within DeviceSetupProvider.");
  return value;
}

function suggestedDeviceId(room: Room | undefined, homes: SeniorHome[]) {
  if (!room) return "CAM-NEW-001";
  const home = homes.find((item) => item.id === room.homeId);
  const roomCode = room.name.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 3) || "ROOM";
  return `CAM-${roomCode}-${home?.blockNumber ?? "NEW"}`;
}
