#include <Arduino.h>
#include <ArduinoJson.h>
#include <HTTPClient.h>
#include <Preferences.h>
#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <esp_camera.h>
#include <esp_http_server.h>
#include <esp_system.h>
#include <freertos/semphr.h>
#include <time.h>

#ifndef CARE_GUARD_FIRMWARE_VERSION
#define CARE_GUARD_FIRMWARE_VERSION "0.1.6"
#endif
#ifndef CARE_GUARD_CAMERA_PROFILE
#define CARE_GUARD_CAMERA_PROFILE "esp32s3_cam_common"
#endif

namespace {
constexpr uint32_t kProtocolVersion = 1;
constexpr uint32_t kDefaultCaptureIntervalMs = 500;
constexpr uint32_t kMinimumCaptureIntervalMs = 500;
constexpr uint32_t kMaximumCaptureIntervalMs = 60000;
constexpr uint32_t kWifiTimeoutMs = 15000;
constexpr uint32_t kInitialRetryMs = 1000;
constexpr uint32_t kMaximumRetryMs = 30000;
constexpr uint32_t kClockSyncTimeoutMs = 20000;
constexpr time_t kMinimumValidEpoch = 1704067200;  // 2024-01-01 UTC
constexpr size_t kMaximumSerialLine = 4096;
constexpr uint32_t kLocalStreamFrameDelayMs = 500;
constexpr size_t kLocalStreamKeyBytes = 16;
constexpr char kStreamContentType[] = "multipart/x-mixed-replace;boundary=careguardframe";
constexpr char kStreamBoundaryLine[] = "\r\n--careguardframe\r\n";
constexpr char kStreamPartHeader[] = "Content-Type: image/jpeg\r\nContent-Length: %u\r\n\r\n";

// Vercel currently serves *.vercel.app through Google Trust Services.
// Pin the issuing root directly because the CA bundle callback in
// Arduino-ESP32 2.0.17 fails on Google's cross-signed GTS Root R1 chain.
constexpr char kGtsRootR1[] = R"PEM(-----BEGIN CERTIFICATE-----
MIIFVzCCAz+gAwIBAgINAgPlk28xsBNJiGuiFzANBgkqhkiG9w0BAQwFADBHMQsw
CQYDVQQGEwJVUzEiMCAGA1UEChMZR29vZ2xlIFRydXN0IFNlcnZpY2VzIExMQzEU
MBIGA1UEAxMLR1RTIFJvb3QgUjEwHhcNMTYwNjIyMDAwMDAwWhcNMzYwNjIyMDAw
MDAwWjBHMQswCQYDVQQGEwJVUzEiMCAGA1UEChMZR29vZ2xlIFRydXN0IFNlcnZp
Y2VzIExMQzEUMBIGA1UEAxMLR1RTIFJvb3QgUjEwggIiMA0GCSqGSIb3DQEBAQUA
A4ICDwAwggIKAoICAQC2EQKLHuOhd5s73L+UPreVp0A8of2C+X0yBoJx9vaMf/vo
27xqLpeXo4xL+Sv2sfnOhB2x+cWX3u+58qPpvBKJXqeqUqv4IyfLpLGcY9vXmX7w
Cl7raKb0xlpHDU0QM+NOsROjyBhsS+z8CZDfnWQpJSMHobTSPS5g4M/SCYe7zUjw
TcLCeoiKu7rPWRnWr4+wB7CeMfGCwcDfLqZtbBkOtdh+JhpFAz2weaSUKK0Pfybl
qAj+lug8aJRT7oM6iCsVlgmy4HqMLnXWnOunVmSPlk9orj2XwoSPwLxAwAtcvfaH
szVsrBhQf4TgTM2S0yDpM7xSma8ytSmzJSq0SPly4cpk9+aCEI3oncKKiPo4Zor8
Y/kB+Xj9e1x3+naH+uzfsQ55lVe0vSbv1gHR6xYKu44LtcXFilWr06zqkUspzBmk
MiVOKvFlRNACzqrOSbTqn3yDsEB750Orp2yjj32JgfpMpf/VjsPOS+C12LOORc92
wO1AK/1TD7Cn1TsNsYqiA94xrcx36m97PtbfkSIS5r762DL8EGMUUXLeXdYWk70p
aDPvOmbsB4om3xPXV2V4J95eSRQAogB/mqghtqmxlbCluQ0WEdrHbEg8QOB+DVrN
VjzRlwW5y0vtOUucxD/SVRNuJLDWcfr0wbrM7Rv1/oFB2ACYPTrIrnqYNxgFlQID
AQABo0IwQDAOBgNVHQ8BAf8EBAMCAYYwDwYDVR0TAQH/BAUwAwEB/zAdBgNVHQ4E
FgQU5K8rJnEaK0gnhS9SZizv8IkTcT4wDQYJKoZIhvcNAQEMBQADggIBAJ+qQibb
C5u+/x6Wki4+omVKapi6Ist9wTrYggoGxval3sBOh2Z5ofmmWJyq+bXmYOfg6LEe
QkEzCzc9zolwFcq1JKjPa7XSQCGYzyI0zzvFIoTgxQ6KfF2I5DUkzps+GlQebtuy
h6f88/qBVRRiClmpIgUxPoLW7ttXNLwzldMXG+gnoot7TiYaelpkttGsN/H9oPM4
7HLwEXWdyzRSjeZ2axfG34arJ45JK3VmgRAhpuo+9K4l/3wV3s6MJT/KYnAK9y8J
ZgfIPxz88NtFMN9iiMG1D53Dn0reWVlHxYciNuaCp+0KueIHoI17eko8cdLiA6Ef
MgfdG+RCzgwARWGAtQsgWSl4vflVy2PFPEz0tv/bal8xa5meLMFrUKTX5hgUvYU/
Z6tGn6D/Qqc6f1zLXbBwHSs09dR2CQzreExZBfMzQsNhFRAbd03OIozUhfJFfbdT
6u9AWpQKXCBfTkBdYiJ23//OYb2MI3jSNwLgjt7RETeJ9r/tSQdirpLsQBqvFAnZ
0E6yove+7u7Y/9waLd64NnHi/Hm3lCXRSHNboTXns5lndcEZOitHTtNCjv0xyBZm
2tIMPNuzjsmhDYAPexZ3FL//2wmUspO8IFgV6dtxQ/PeEMMA3KgqlbbC1j+Qa3bb
bP6MvPJwNQzcmRk13NfIRmPVNnGuV/u3gm3c
-----END CERTIFICATE-----
)PEM";

// nulllaborg common ESP32-S3-CAM profile.
constexpr int kPinPwdn = -1;
constexpr int kPinReset = -1;
constexpr int kPinXclk = 15;
constexpr int kPinSiod = 4;
constexpr int kPinSioc = 5;
constexpr int kPinD7 = 16;
constexpr int kPinD6 = 17;
constexpr int kPinD5 = 18;
constexpr int kPinD4 = 12;
constexpr int kPinD3 = 10;
constexpr int kPinD2 = 8;
constexpr int kPinD1 = 9;
constexpr int kPinD0 = 11;
constexpr int kPinVsync = 6;
constexpr int kPinHref = 7;
constexpr int kPinPclk = 13;

struct DeviceConfig {
  String wifiSsid;
  String wifiPassword;
  String apiBaseUrl;
  String deviceId;
  String deviceToken;
  String localStreamKey;
  uint32_t captureIntervalMs = kDefaultCaptureIntervalMs;

  bool complete() const {
    return !wifiSsid.isEmpty() && !wifiPassword.isEmpty() && apiBaseUrl.startsWith("https://") &&
           !deviceId.isEmpty() && !deviceToken.isEmpty();
  }
};

struct UploadResult {
  bool wifiConnected = false;
  bool clockSynchronized = false;
  bool apiReachable = false;
  bool inferenceAccepted = false;
  bool heartbeatUpdated = false;
  int httpStatus = 0;
  String message;
};

Preferences preferences;
DeviceConfig config;
bool cameraReady = false;
bool uploadInProgress = false;
bool clockSyncConfigured = false;
volatile uint8_t lastWifiDisconnectReason = 0;
httpd_handle_t localStreamServer = nullptr;
SemaphoreHandle_t localStreamSlot = nullptr;
uint32_t nextUploadAt = 0;
uint32_t retryDelayMs = kInitialRetryMs;
String serialLine;

String localStreamUrl() {
  if (localStreamServer == nullptr || WiFi.status() != WL_CONNECTED || config.localStreamKey.isEmpty()) {
    return "";
  }
  return "http://" + WiFi.localIP().toString() + "/?key=" + config.localStreamKey;
}

void emitResult(const String &requestId, bool ok, const char *code, const String &message,
                const UploadResult *upload = nullptr) {
  JsonDocument response;
  response["protocolVersion"] = kProtocolVersion;
  response["event"] = "result";
  response["requestId"] = requestId;
  response["ok"] = ok;
  response["code"] = code;
  response["message"] = message;
  JsonObject data = response["data"].to<JsonObject>();
  data["configured"] = config.complete();
  data["cameraReady"] = cameraReady;
  data["wifiConnected"] = WiFi.status() == WL_CONNECTED;
  data["firmwareVersion"] = CARE_GUARD_FIRMWARE_VERSION;
  data["cameraProfile"] = CARE_GUARD_CAMERA_PROFILE;
  data["captureIntervalMs"] = config.captureIntervalMs;
  if (!config.deviceId.isEmpty()) data["deviceId"] = config.deviceId;
  if (lastWifiDisconnectReason != 0) {
    data["wifiDisconnectReason"] = lastWifiDisconnectReason;
    data["wifiDisconnectReasonName"] =
      WiFi.disconnectReasonName(static_cast<wifi_err_reason_t>(lastWifiDisconnectReason));
  }
  const String streamUrl = localStreamUrl();
  if (!streamUrl.isEmpty()) data["localStreamUrl"] = streamUrl;
  if (upload != nullptr) {
    data["clockSynchronized"] = upload->clockSynchronized;
    data["apiReachable"] = upload->apiReachable;
    data["inferenceAccepted"] = upload->inferenceAccepted;
    data["heartbeatUpdated"] = upload->heartbeatUpdated;
    data["httpStatus"] = upload->httpStatus;
  }
  serializeJson(response, Serial);
  Serial.println();
  Serial.flush();
}

void emitBootEvent(const char *code, const String &message) {
  JsonDocument event;
  event["protocolVersion"] = kProtocolVersion;
  event["event"] = "device";
  event["code"] = code;
  event["message"] = message;
  JsonObject data = event["data"].to<JsonObject>();
  data["configured"] = config.complete();
  data["cameraReady"] = cameraReady;
  data["firmwareVersion"] = CARE_GUARD_FIRMWARE_VERSION;
  data["cameraProfile"] = CARE_GUARD_CAMERA_PROFILE;
  serializeJson(event, Serial);
  Serial.println();
}

bool initCamera() {
  if (!psramFound()) return false;
  camera_config_t camera = {};
  camera.ledc_channel = LEDC_CHANNEL_0;
  camera.ledc_timer = LEDC_TIMER_0;
  camera.pin_d0 = kPinD0;
  camera.pin_d1 = kPinD1;
  camera.pin_d2 = kPinD2;
  camera.pin_d3 = kPinD3;
  camera.pin_d4 = kPinD4;
  camera.pin_d5 = kPinD5;
  camera.pin_d6 = kPinD6;
  camera.pin_d7 = kPinD7;
  camera.pin_xclk = kPinXclk;
  camera.pin_pclk = kPinPclk;
  camera.pin_vsync = kPinVsync;
  camera.pin_href = kPinHref;
  camera.pin_sccb_sda = kPinSiod;
  camera.pin_sccb_scl = kPinSioc;
  camera.pin_pwdn = kPinPwdn;
  camera.pin_reset = kPinReset;
  camera.xclk_freq_hz = 20000000;
  camera.frame_size = FRAMESIZE_VGA;
  camera.pixel_format = PIXFORMAT_JPEG;
  camera.grab_mode = CAMERA_GRAB_LATEST;
  camera.fb_location = CAMERA_FB_IN_PSRAM;
  camera.jpeg_quality = 12;
  camera.fb_count = 2;
  return esp_camera_init(&camera) == ESP_OK;
}

String generateLocalStreamKey() {
  uint8_t randomBytes[kLocalStreamKeyBytes];
  esp_fill_random(randomBytes, sizeof(randomBytes));
  constexpr char kHex[] = "0123456789abcdef";
  char encoded[kLocalStreamKeyBytes * 2 + 1];
  for (size_t index = 0; index < sizeof(randomBytes); ++index) {
    encoded[index * 2] = kHex[randomBytes[index] >> 4];
    encoded[index * 2 + 1] = kHex[randomBytes[index] & 0x0f];
  }
  encoded[sizeof(encoded) - 1] = '\0';
  return String(encoded);
}

bool streamRequestAuthorized(httpd_req_t *request) {
  if (config.localStreamKey.isEmpty()) return false;
  const size_t queryLength = httpd_req_get_url_query_len(request);
  if (queryLength == 0 || queryLength > 96) return false;
  char query[97] = {};
  char suppliedKey[kLocalStreamKeyBytes * 2 + 1] = {};
  if (httpd_req_get_url_query_str(request, query, sizeof(query)) != ESP_OK ||
      httpd_query_key_value(query, "key", suppliedKey, sizeof(suppliedKey)) != ESP_OK) {
    return false;
  }
  if (config.localStreamKey.length() != strlen(suppliedKey)) return false;
  uint8_t difference = 0;
  for (size_t index = 0; index < config.localStreamKey.length(); ++index) {
    difference |= static_cast<uint8_t>(config.localStreamKey[index] ^ suppliedKey[index]);
  }
  return difference == 0;
}

esp_err_t sendStreamUnauthorized(httpd_req_t *request) {
  httpd_resp_set_status(request, "401 Unauthorized");
  httpd_resp_set_type(request, "text/plain");
  httpd_resp_set_hdr(request, "Cache-Control", "no-store");
  return httpd_resp_sendstr(request, "A valid local stream key is required.");
}

esp_err_t localViewerHandler(httpd_req_t *request) {
  if (!streamRequestAuthorized(request)) return sendStreamUnauthorized(request);
  String page = R"HTML(<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>CareGuard local camera</title><style>
html{color-scheme:dark;background:#090b10;font:16px system-ui,sans-serif}
body{margin:0;min-height:100vh;display:grid;place-items:center}
main{width:min(960px,100%);padding:20px;box-sizing:border-box}
h1{font-size:1.2rem;margin:0 0 8px}p{color:#aeb6c5;margin:0 0 16px}
img{display:block;width:100%;height:auto;background:#000;border-radius:12px}
</style></head><body><main><h1>CareGuard local camera</h1>
<p>LAN-only MJPEG preview. Frames are not stored by this viewer.</p><img alt="Live camera feed" src="/stream?key=)HTML";
  page += config.localStreamKey;
  page += R"HTML("></main></body></html>)HTML";
  httpd_resp_set_type(request, "text/html; charset=utf-8");
  httpd_resp_set_hdr(request, "Cache-Control", "no-store");
  httpd_resp_set_hdr(request, "Referrer-Policy", "no-referrer");
  httpd_resp_set_hdr(request, "X-Content-Type-Options", "nosniff");
  httpd_resp_set_hdr(request, "Content-Security-Policy",
                     "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'");
  return httpd_resp_send(request, page.c_str(), page.length());
}

esp_err_t localStreamHandler(httpd_req_t *request) {
  if (!streamRequestAuthorized(request)) return sendStreamUnauthorized(request);
  if (localStreamSlot == nullptr || xSemaphoreTake(localStreamSlot, 0) != pdTRUE) {
    httpd_resp_set_status(request, "409 Conflict");
    httpd_resp_set_type(request, "text/plain");
    return httpd_resp_sendstr(request, "Only one local stream viewer is supported at a time.");
  }

  esp_err_t result = httpd_resp_set_type(request, kStreamContentType);
  httpd_resp_set_hdr(request, "Cache-Control", "no-store, no-cache, must-revalidate");
  httpd_resp_set_hdr(request, "X-Content-Type-Options", "nosniff");
  char partHeader[80];

  while (result == ESP_OK && WiFi.status() == WL_CONNECTED && cameraReady) {
    camera_fb_t *frame = esp_camera_fb_get();
    if (frame == nullptr) {
      vTaskDelay(pdMS_TO_TICKS(kLocalStreamFrameDelayMs));
      continue;
    }
    if (frame->format != PIXFORMAT_JPEG) {
      esp_camera_fb_return(frame);
      result = ESP_FAIL;
      break;
    }

    result = httpd_resp_send_chunk(request, kStreamBoundaryLine, strlen(kStreamBoundaryLine));
    if (result == ESP_OK) {
      const int headerLength = snprintf(partHeader, sizeof(partHeader), kStreamPartHeader,
                                        static_cast<unsigned int>(frame->len));
      result = headerLength > 0
        ? httpd_resp_send_chunk(request, partHeader, headerLength)
        : ESP_FAIL;
    }
    if (result == ESP_OK) {
      result = httpd_resp_send_chunk(request, reinterpret_cast<const char *>(frame->buf), frame->len);
    }
    esp_camera_fb_return(frame);
    if (result == ESP_OK) vTaskDelay(pdMS_TO_TICKS(kLocalStreamFrameDelayMs));
  }

  if (result == ESP_OK) httpd_resp_send_chunk(request, nullptr, 0);
  xSemaphoreGive(localStreamSlot);
  return result;
}

bool startLocalStreamServer() {
  if (localStreamServer != nullptr) return true;
  if (!cameraReady || WiFi.status() != WL_CONNECTED || config.localStreamKey.isEmpty()) return false;
  if (localStreamSlot == nullptr) {
    localStreamSlot = xSemaphoreCreateMutex();
    if (localStreamSlot == nullptr) return false;
  }

  httpd_config_t serverConfig = HTTPD_DEFAULT_CONFIG();
  serverConfig.server_port = 80;
  serverConfig.max_open_sockets = 3;
  serverConfig.lru_purge_enable = true;
  serverConfig.stack_size = 6144;
  serverConfig.send_wait_timeout = 5;

  if (httpd_start(&localStreamServer, &serverConfig) != ESP_OK) {
    localStreamServer = nullptr;
    return false;
  }

  httpd_uri_t viewerUri = {};
  viewerUri.uri = "/";
  viewerUri.method = HTTP_GET;
  viewerUri.handler = localViewerHandler;
  httpd_uri_t streamUri = {};
  streamUri.uri = "/stream";
  streamUri.method = HTTP_GET;
  streamUri.handler = localStreamHandler;
  if (httpd_register_uri_handler(localStreamServer, &viewerUri) != ESP_OK ||
      httpd_register_uri_handler(localStreamServer, &streamUri) != ESP_OK) {
    httpd_stop(localStreamServer);
    localStreamServer = nullptr;
    return false;
  }
  return true;
}

void stopLocalStreamServer() {
  if (localStreamServer == nullptr) return;
  httpd_stop(localStreamServer);
  localStreamServer = nullptr;
}

void handleWifiEvent(arduino_event_id_t event, arduino_event_info_t info) {
  if (event != ARDUINO_EVENT_WIFI_STA_DISCONNECTED) return;
  const uint8_t reason = info.wifi_sta_disconnected.reason;
  if (reason != WIFI_REASON_ASSOC_LEAVE) lastWifiDisconnectReason = reason;
}

String wifiConnectionFailureMessage() {
  String message = "Wi-Fi connection failed";
  if (lastWifiDisconnectReason != 0) {
    message += ": ";
    message += WiFi.disconnectReasonName(static_cast<wifi_err_reason_t>(lastWifiDisconnectReason));
    message += " (reason ";
    message += String(lastWifiDisconnectReason);
    message += ")";
  }
  message += ".";
  return message;
}

void loadConfiguration() {
  preferences.begin("careguard", true);
  config.wifiSsid = preferences.getString("wifi_ssid", "");
  config.wifiPassword = preferences.getString("wifi_pass", "");
  config.apiBaseUrl = preferences.getString("api_url", "");
  config.deviceId = preferences.getString("device_id", "");
  config.deviceToken = preferences.getString("device_tok", "");
  config.localStreamKey = preferences.getString("stream_key", "");
  config.captureIntervalMs = preferences.getUInt("cadence", kDefaultCaptureIntervalMs);
  preferences.end();
  if (config.localStreamKey.isEmpty()) {
    config.localStreamKey = generateLocalStreamKey();
    if (preferences.begin("careguard", false)) {
      preferences.putString("stream_key", config.localStreamKey);
      preferences.end();
    }
  }
  config.captureIntervalMs = constrain(config.captureIntervalMs, kMinimumCaptureIntervalMs, kMaximumCaptureIntervalMs);
}

bool saveConfiguration(const DeviceConfig &next) {
  if (!preferences.begin("careguard", false)) return false;
  bool ok = preferences.putString("wifi_ssid", next.wifiSsid) > 0;
  ok = preferences.putString("wifi_pass", next.wifiPassword) > 0 && ok;
  ok = preferences.putString("api_url", next.apiBaseUrl) > 0 && ok;
  ok = preferences.putString("device_id", next.deviceId) > 0 && ok;
  ok = preferences.putString("device_tok", next.deviceToken) > 0 && ok;
  ok = preferences.putString("stream_key", next.localStreamKey) > 0 && ok;
  ok = preferences.putUInt("cadence", next.captureIntervalMs) > 0 && ok;
  preferences.end();
  return ok;
}

bool connectWifi() {
  if (!config.complete()) return false;
  if (WiFi.status() == WL_CONNECTED) {
    lastWifiDisconnectReason = 0;
    return true;
  }
  WiFi.mode(WIFI_STA);
  WiFi.setAutoReconnect(true);
  WiFi.begin(config.wifiSsid.c_str(), config.wifiPassword.c_str());
  const uint32_t startedAt = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - startedAt < kWifiTimeoutMs) {
    delay(100);
  }
  const bool connected = WiFi.status() == WL_CONNECTED;
  if (connected) lastWifiDisconnectReason = 0;
  return connected;
}

bool synchronizeClock() {
  if (time(nullptr) >= kMinimumValidEpoch) return true;
  if (!clockSyncConfigured) {
    configTime(0, 0, "pool.ntp.org", "time.cloudflare.com", "time.google.com");
    clockSyncConfigured = true;
  }
  const uint32_t startedAt = millis();
  while (time(nullptr) < kMinimumValidEpoch && millis() - startedAt < kClockSyncTimeoutMs) {
    delay(100);
  }
  return time(nullptr) >= kMinimumValidEpoch;
}

UploadResult captureAndUpload() {
  UploadResult result;
  if (uploadInProgress) {
    result.message = "Another upload is already in progress.";
    return result;
  }
  uploadInProgress = true;
  result.wifiConnected = connectWifi();
  if (!result.wifiConnected) {
    result.message = wifiConnectionFailureMessage();
    uploadInProgress = false;
    return result;
  }
  startLocalStreamServer();
  result.clockSynchronized = synchronizeClock();
  if (!result.clockSynchronized) {
    result.message = "Secure clock synchronization failed.";
    uploadInProgress = false;
    return result;
  }
  camera_fb_t *frame = esp_camera_fb_get();
  if (frame == nullptr || frame->format != PIXFORMAT_JPEG) {
    if (frame != nullptr) esp_camera_fb_return(frame);
    result.message = "Camera did not return a JPEG frame.";
    uploadInProgress = false;
    return result;
  }
  const size_t frameLength = frame->len;
  uint8_t *frameBytes = static_cast<uint8_t *>(ps_malloc(frameLength));
  if (frameBytes == nullptr) {
    esp_camera_fb_return(frame);
    result.message = "Camera frame could not be copied into PSRAM.";
    uploadInProgress = false;
    return result;
  }
  memcpy(frameBytes, frame->buf, frameLength);
  esp_camera_fb_return(frame);

  WiFiClientSecure tls;
  tls.setCACert(kGtsRootR1);
  HTTPClient http;
  const String url = config.apiBaseUrl + "/api/devices/frame";
  if (!http.begin(tls, url)) {
    free(frameBytes);
    result.message = "HTTPS request could not be initialized.";
    uploadInProgress = false;
    return result;
  }
  http.setConnectTimeout(10000);
  http.setTimeout(35000);
  http.addHeader("Content-Type", "image/jpeg");
  http.addHeader("Authorization", "Bearer " + config.deviceToken);
  http.addHeader("X-Device-Id", config.deviceId);
  http.addHeader("X-Firmware-Version", CARE_GUARD_FIRMWARE_VERSION);
  result.httpStatus = http.POST(frameBytes, frameLength);
  free(frameBytes);
  result.apiReachable = result.httpStatus > 0;
  result.inferenceAccepted = result.httpStatus >= 200 && result.httpStatus < 300;
  result.heartbeatUpdated = result.inferenceAccepted;
  if (result.inferenceAccepted) {
    result.message = "Test frame was accepted and applied.";
  } else if (result.httpStatus < 0) {
    char tlsError[160] = {};
    const int tlsErrorCode = tls.lastError(tlsError, sizeof(tlsError));
    result.message = "HTTPS upload failed: ";
    result.message += HTTPClient::errorToString(result.httpStatus);
    if (tlsErrorCode != 0 && tlsError[0] != '\0') {
      result.message += " (TLS ";
      result.message += String(tlsErrorCode);
      result.message += ": ";
      result.message += tlsError;
      result.message += ")";
    }
  } else {
    result.message = "Frame upload was not accepted.";
  }
  http.end();
  uploadInProgress = false;
  return result;
}

void handleConfigure(const String &requestId, JsonObjectConst payload) {
  DeviceConfig next;
  next.wifiSsid = payload["wifiSsid"] | "";
  next.wifiPassword = payload["wifiPassword"] | "";
  next.apiBaseUrl = payload["apiBaseUrl"] | "";
  next.deviceId = payload["deviceId"] | "";
  next.deviceToken = payload["deviceToken"] | "";
  next.localStreamKey = config.localStreamKey.isEmpty() ? generateLocalStreamKey() : config.localStreamKey;
  next.captureIntervalMs = payload["captureIntervalMs"] | kDefaultCaptureIntervalMs;
  const String requestedProfile = payload["cameraProfile"] | "";
  const bool canReuseWifi =
    WiFi.status() == WL_CONNECTED &&
    next.wifiSsid == config.wifiSsid &&
    next.wifiPassword == config.wifiPassword;
  next.captureIntervalMs = constrain(next.captureIntervalMs, kMinimumCaptureIntervalMs, kMaximumCaptureIntervalMs);
  if (!next.complete()) {
    emitResult(requestId, false, "invalid_configuration", "Required configuration fields are missing.");
    return;
  }
  if (requestedProfile != CARE_GUARD_CAMERA_PROFILE) {
    emitResult(requestId, false, "unsupported_camera_profile", "The requested camera pin profile does not match this firmware.");
    return;
  }
  if (!saveConfiguration(next)) {
    emitResult(requestId, false, "nvs_write_failed", "Configuration could not be stored.");
    return;
  }
  config = next;
  if (!canReuseWifi) {
    stopLocalStreamServer();
    WiFi.disconnect(true, false);
    delay(100);
  } else {
    lastWifiDisconnectReason = 0;
    startLocalStreamServer();
  }
  emitResult(requestId, true, "configured",
             canReuseWifi
               ? "Configuration stored. The existing Wi-Fi connection was retained."
               : "Configuration stored. Wi-Fi and API connectivity will be verified by the test frame.");
  nextUploadAt = millis() + 250;
}

void handleCommand(const String &line) {
  JsonDocument request;
  if (deserializeJson(request, line) != DeserializationError::Ok) {
    emitResult("", false, "invalid_json", "Command must be one newline-delimited JSON object.");
    return;
  }
  const String requestId = request["requestId"] | "";
  const uint32_t protocolVersion = request["protocolVersion"] | 0;
  const String command = request["command"] | "";
  if (requestId.isEmpty() || protocolVersion != kProtocolVersion) {
    emitResult(requestId, false, "unsupported_protocol", "protocolVersion 1 and requestId are required.");
    return;
  }
  if (command == "status") {
    emitResult(requestId, true, "status", "Device status returned.");
  } else if (command == "configure") {
    handleConfigure(requestId, request["payload"].as<JsonObjectConst>());
  } else if (command == "test_frame") {
    if (!config.complete() || !cameraReady) {
      emitResult(requestId, false, "not_ready", "Camera must be configured and initialized first.");
      return;
    }
    const UploadResult upload = captureAndUpload();
    emitResult(requestId, upload.inferenceAccepted, upload.inferenceAccepted ? "test_frame_ok" : "test_frame_failed",
               upload.message, &upload);
  } else if (command == "reboot") {
    emitResult(requestId, true, "rebooting", "Device is rebooting.");
    delay(100);
    ESP.restart();
  } else if (command == "factory_reset") {
    preferences.begin("careguard", false);
    preferences.clear();
    preferences.end();
    emitResult(requestId, true, "factory_reset", "Stored configuration was erased; device is rebooting.");
    delay(100);
    ESP.restart();
  } else {
    emitResult(requestId, false, "unknown_command", "Supported commands: status, configure, test_frame, reboot, factory_reset.");
  }
}

void pollSerial() {
  while (Serial.available()) {
    const char value = static_cast<char>(Serial.read());
    if (value == '\n') {
      if (!serialLine.isEmpty()) handleCommand(serialLine);
      serialLine = "";
    } else if (value != '\r') {
      if (serialLine.length() < kMaximumSerialLine) {
        serialLine += value;
      } else {
        serialLine = "";
        emitResult("", false, "command_too_large", "Serial command exceeded 4096 bytes.");
      }
    }
  }
}
}  // namespace

void setup() {
  Serial.setRxBufferSize(kMaximumSerialLine + 1);
  Serial.begin(115200);
  serialLine.reserve(kMaximumSerialLine);
  WiFi.onEvent(handleWifiEvent, ARDUINO_EVENT_WIFI_STA_DISCONNECTED);
  loadConfiguration();
  cameraReady = initCamera();
  emitBootEvent(cameraReady ? "ready" : "camera_initialization_failed",
                cameraReady ? "ESP32-S3-CAM is ready." : "Camera initialization failed; verify PSRAM and pin profile.");
  if (config.complete()) {
    if (connectWifi()) startLocalStreamServer();
    nextUploadAt = millis();
  }
}

void loop() {
  pollSerial();
  if (!config.complete() || !cameraReady || uploadInProgress) {
    delay(5);
    return;
  }
  const uint32_t now = millis();
  if (static_cast<int32_t>(now - nextUploadAt) < 0) {
    delay(5);
    return;
  }
  const UploadResult upload = captureAndUpload();
  if (upload.inferenceAccepted) {
    retryDelayMs = kInitialRetryMs;
    nextUploadAt = millis() + config.captureIntervalMs;
  } else {
    nextUploadAt = millis() + retryDelayMs;
    retryDelayMs = min(retryDelayMs * 2, kMaximumRetryMs);
  }
}
