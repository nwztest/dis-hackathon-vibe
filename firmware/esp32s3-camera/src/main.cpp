#include <Arduino.h>
#include <ArduinoJson.h>
#include <HTTPClient.h>
#include <Preferences.h>
#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <esp_camera.h>
#include <esp_crt_bundle.h>

#ifndef CARE_GUARD_FIRMWARE_VERSION
#define CARE_GUARD_FIRMWARE_VERSION "0.1.0"
#endif
#ifndef CARE_GUARD_CAMERA_PROFILE
#define CARE_GUARD_CAMERA_PROFILE "esp32s3_cam_common"
#endif

namespace {
extern const uint8_t rootca_crt_bundle_start[] asm("_binary_data_cert_x509_crt_bundle_bin_start");
constexpr uint32_t kProtocolVersion = 1;
constexpr uint32_t kDefaultCaptureIntervalMs = 500;
constexpr uint32_t kMinimumCaptureIntervalMs = 500;
constexpr uint32_t kMaximumCaptureIntervalMs = 60000;
constexpr uint32_t kWifiTimeoutMs = 15000;
constexpr uint32_t kInitialRetryMs = 1000;
constexpr uint32_t kMaximumRetryMs = 30000;
constexpr size_t kMaximumSerialLine = 4096;

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
  uint32_t captureIntervalMs = kDefaultCaptureIntervalMs;

  bool complete() const {
    return !wifiSsid.isEmpty() && !wifiPassword.isEmpty() && apiBaseUrl.startsWith("https://") &&
           !deviceId.isEmpty() && !deviceToken.isEmpty();
  }
};

struct UploadResult {
  bool wifiConnected = false;
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
uint32_t nextUploadAt = 0;
uint32_t retryDelayMs = kInitialRetryMs;
String serialLine;

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
  if (upload != nullptr) {
    data["apiReachable"] = upload->apiReachable;
    data["inferenceAccepted"] = upload->inferenceAccepted;
    data["heartbeatUpdated"] = upload->heartbeatUpdated;
    data["httpStatus"] = upload->httpStatus;
  }
  serializeJson(response, Serial);
  Serial.println();
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

void loadConfiguration() {
  preferences.begin("careguard", true);
  config.wifiSsid = preferences.getString("wifi_ssid", "");
  config.wifiPassword = preferences.getString("wifi_pass", "");
  config.apiBaseUrl = preferences.getString("api_url", "");
  config.deviceId = preferences.getString("device_id", "");
  config.deviceToken = preferences.getString("device_tok", "");
  config.captureIntervalMs = preferences.getUInt("cadence", kDefaultCaptureIntervalMs);
  preferences.end();
  config.captureIntervalMs = constrain(config.captureIntervalMs, kMinimumCaptureIntervalMs, kMaximumCaptureIntervalMs);
}

bool saveConfiguration(const DeviceConfig &next) {
  if (!preferences.begin("careguard", false)) return false;
  bool ok = preferences.putString("wifi_ssid", next.wifiSsid) > 0;
  ok = preferences.putString("wifi_pass", next.wifiPassword) > 0 && ok;
  ok = preferences.putString("api_url", next.apiBaseUrl) > 0 && ok;
  ok = preferences.putString("device_id", next.deviceId) > 0 && ok;
  ok = preferences.putString("device_tok", next.deviceToken) > 0 && ok;
  ok = preferences.putUInt("cadence", next.captureIntervalMs) > 0 && ok;
  preferences.end();
  return ok;
}

bool connectWifi() {
  if (!config.complete()) return false;
  if (WiFi.status() == WL_CONNECTED) return true;
  WiFi.mode(WIFI_STA);
  WiFi.setAutoReconnect(true);
  WiFi.begin(config.wifiSsid.c_str(), config.wifiPassword.c_str());
  const uint32_t startedAt = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - startedAt < kWifiTimeoutMs) {
    delay(100);
  }
  return WiFi.status() == WL_CONNECTED;
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
    result.message = "Wi-Fi connection failed.";
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

  WiFiClientSecure tls;
  tls.setCACertBundle(rootca_crt_bundle_start);
  HTTPClient http;
  const String url = config.apiBaseUrl + "/api/devices/frame";
  if (!http.begin(tls, url)) {
    esp_camera_fb_return(frame);
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
  result.httpStatus = http.POST(frame->buf, frame->len);
  result.apiReachable = result.httpStatus > 0;
  result.inferenceAccepted = result.httpStatus >= 200 && result.httpStatus < 300;
  result.heartbeatUpdated = result.inferenceAccepted;
  result.message = result.inferenceAccepted ? "Test frame was accepted and applied." : "Frame upload was not accepted.";
  http.end();
  esp_camera_fb_return(frame);
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
  next.captureIntervalMs = payload["captureIntervalMs"] | kDefaultCaptureIntervalMs;
  const String requestedProfile = payload["cameraProfile"] | "";
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
  WiFi.disconnect(true, false);
  const bool connected = connectWifi();
  emitResult(requestId, true, connected ? "configured" : "configured_wifi_pending",
             connected ? "Configuration stored and Wi-Fi connected." : "Configuration stored; Wi-Fi will retry.");
  nextUploadAt = millis();
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
  Serial.begin(115200);
  serialLine.reserve(kMaximumSerialLine);
  loadConfiguration();
  cameraReady = initCamera();
  emitBootEvent(cameraReady ? "ready" : "camera_initialization_failed",
                cameraReady ? "ESP32-S3-CAM is ready." : "Camera initialization failed; verify PSRAM and pin profile.");
  if (config.complete()) {
    connectWifi();
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
