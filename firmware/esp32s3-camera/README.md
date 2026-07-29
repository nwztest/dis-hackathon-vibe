# CareGuard ESP32-S3-CAM firmware

Reproducible PlatformIO Arduino firmware for the common 8 MB OPI-PSRAM ESP32-S3-CAM profile.

## Pin profile

| Signal | GPIO |
| --- | ---: |
| SDA / SIOD | 4 |
| SCL / SIOC | 5 |
| VSYNC | 6 |
| HREF | 7 |
| XCLK | 15 |
| PCLK | 13 |
| D0–D7 | 11, 9, 8, 10, 12, 18, 17, 16 |

The profile is isolated in `src/main.cpp`. A board with a different pin map fails with a structured
`camera_initialization_failed` event and requires a separate PlatformIO environment/profile.

## Build and first flash

```powershell
cd firmware/esp32s3-camera
pio run
pio run --target upload --upload-port COM3
```

Flashing replaces the sketch currently on the board. Later setup uses the preflashed firmware through
desktop Chrome/Edge Web Serial at 115200 baud.

## Serial protocol

Each request and response is one JSON object followed by a newline. Requests use `protocolVersion: 1`,
an opaque `requestId`, and one of: `status`, `configure`, `test_frame`, `reboot`, or `factory_reset`.

```json
{"protocolVersion":1,"command":"status","requestId":"example"}
```

`configure` stores Wi-Fi, the HTTPS API origin, device ID, token, and cadence in NVS. Responses never
echo Wi-Fi passwords or tokens. `factory_reset` erases the `careguard` NVS namespace.

Before its first HTTPS request, the firmware synchronizes UTC through NTP so certificate validity can
be checked correctly. TLS pins Google Trust Services Root R1 for the configured Vercel API origin.
Insecure TLS mode is intentionally absent.

## Local live view

Once connected to Wi-Fi, the device serves a token-protected MJPEG viewer over the local network.
The serial `status` and `test_frame` results include `data.localStreamUrl`; open that URL from a
browser on the same Wi-Fi. The viewer supports one client at a time, is not exposed through the
cloud API, does not store frames, and targets 2 FPS.
