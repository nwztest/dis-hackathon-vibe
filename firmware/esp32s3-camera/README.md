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

TLS uses the ESP32 certificate bundle. Insecure TLS mode is intentionally absent.
