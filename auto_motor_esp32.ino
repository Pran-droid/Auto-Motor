/*
 * ============================================================
 *  Auto Motor — ESP32 + PCA9685 + HiveMQ Cloud
 *  VERSION 2: ESP32 AS DATABASE (No Postgres)
 *  - STRICT SEQUENTIAL MOVEMENT & PWM SHUTOFF
 *  - DUAL TIME (NTP + DS1307 RTC Fallback)
 *  - FLASH MEMORY IS SINGLE SOURCE OF TRUTH
 *  - GET_CFG: React app requests config, ESP32 replies via MQTT
 *  - FIXED: Non-blocking Wi-Fi Reconnect
 *  - FIXED: Memory-safe MQTT Callback
 *  - FIXED: Strict CFG Validation
 *  - FIXED: 10-Second Hardware Safety Timeout
 * ============================================================
 */

#include <WiFi.h>
#include <Wire.h>
#include <Adafruit_PWMServoDriver.h>
#include <PubSubClient.h>
#include <WiFiClientSecure.h>
#include <time.h>
#include <WebServer.h>
#include <ESP2SOTA.h>
#include <RTClib.h>
#include <Preferences.h>

// --- WiFi Credentials ---
const char* ssid = "Reddy_5G";
const char* password = "Prabhu#1978";

// --- Web Server for OTA ---
WebServer server(80);

Adafruit_PWMServoDriver pwm = Adafruit_PWMServoDriver();
RTC_DS1307 rtc; 
Preferences preferences;

#define SERVOMIN  150
#define SERVOMAX  600
#define MOTOR_CH 15  
#define DOWN_CH   0   
#define FRONT_CH  8
#define BACK_CH   4   

#define LED_BUILTIN 2 

// --- HIVEMQ CLOUD ---
const char* mqtt_server = "3ced25e5a1194f8d822b5903ac4fa001.s1.eu.hivemq.cloud";
const int   mqtt_port   = 8883;        
const char* mqtt_user   = "Pran";
const char* mqtt_pass   = "automotor";

const char* topic_command = "home/servo/command";
const char* topic_status  = "home/servo/status";
const char* topic_lwt     = "home/servo/lwt";  // Last Will & Testament topic

WiFiClientSecure espClient;
PubSubClient     mqttClient(espClient);

// --- RECONNECT & SAFETY VARIABLES ---
unsigned long lastMqttReconnectAttempt = 0; 
unsigned long lastWiFiReconnectAttempt = 0; // FIX 1: Non-blocking WiFi reconnect
unsigned long stateTimeoutTimer = 0;        // FIX 4: Safety hardware timeout

// --- SCHEDULING VARIABLES ---
int lastTriggerMinute = -1; 
unsigned long lastRTCSync = 0; 

// --- Blinking LED variables ---
unsigned long previousMillis = 0;
const long interval = 1000; 
bool ledState = LOW;

// ==========================================
// TIME MANAGEMENT FUNCTIONS
// ==========================================
void updateInternalTimeFromRTC() {
    if (!rtc.isrunning()) {
        Serial.println("RTC is NOT running! Let's hope Wi-Fi connects to set the time!");
        return;
    }
    DateTime now = rtc.now();
    struct tm timeinfo;
    timeinfo.tm_year = now.year() - 1900;
    timeinfo.tm_mon  = now.month() - 1;
    timeinfo.tm_mday = now.day();
    timeinfo.tm_hour = now.hour();
    timeinfo.tm_min  = now.minute();
    timeinfo.tm_sec  = now.second();
    
    struct timeval tv;
    tv.tv_sec = mktime(&timeinfo);
    tv.tv_usec = 0;
    settimeofday(&tv, NULL);
    Serial.println("ESP32 internal clock loaded from Physical RTC.");
}

void updateRTCfromNTP() {
    struct tm timeinfo;
    if (getLocalTime(&timeinfo, 5000)) {
        if (timeinfo.tm_year > 120) { 
            rtc.adjust(DateTime(timeinfo.tm_year + 1900, timeinfo.tm_mon + 1, timeinfo.tm_mday, timeinfo.tm_hour, timeinfo.tm_min, timeinfo.tm_sec));
            Serial.println("Physical RTC module synced and corrected via WiFi NTP!");
        }
    }
}

void printCurrentTime() {
  struct tm timeinfo;
  if(!getLocalTime(&timeinfo)){
    Serial.println("Failed to obtain time");
    return;
  }
  Serial.println(&timeinfo, "Current Time: %A, %B %d %Y %H:%M:%S");
}

// ==========================================
// NON-BLOCKING MOTOR CLASS (PCA9685 PWM)
// ==========================================
class Motor {
  public:
    int onAngle = 120; 
    int offAngle = 80; 
    int pin = MOTOR_CH;
    int status = 0;
    bool scheduleEnabled = false; 
    int scheduleHour = 0;
    int scheduleMinute = 0;

    enum MotorState { M_IDLE, M_STARTING_ON, M_STARTING_OFF };
    MotorState mState = M_IDLE;
    unsigned long timer = 0;

    int angleToPulse(int angle) {
        return map(angle, 0, 180, SERVOMIN, SERVOMAX);
    }

    void triggerOn() {
      if(mState != M_IDLE) return;
      pwm.setPWM(pin, 0, angleToPulse(onAngle));
      mState = M_STARTING_ON;
      timer = millis();
    }

    void triggerOff() {
      if(mState != M_IDLE) return;
      pwm.setPWM(pin, 0, angleToPulse(offAngle));
      mState = M_STARTING_OFF;
      timer = millis();
    }

    void update() {
      if (mState == M_STARTING_ON && (millis() - timer >= 2000)) {
        pwm.setPWM(pin, 0, 4096); 
        mState = M_IDLE;
        status = 1;
      } 
      else if (mState == M_STARTING_OFF && (millis() - timer >= 2000)) {
        pwm.setPWM(pin, 0, 4096); 
        mState = M_IDLE;
        status = 0;
      }
    }

    bool isBusy() { return mState != M_IDLE; }
};

// ==========================================
// NON-BLOCKING TAP CLASS
// ==========================================
class Tap {
  public:
    int onAngle; 
    int offAngle; 
    int timer;
    int channel;
    bool enabled = false; 

    bool isMoving = false;
    bool isWaitingToRest = false;
    unsigned long restTimer = 0;
    unsigned long lastStepTime = 0;
    int currentAngle;
    int targetAngle;
    int stepDirection = 1;

  public:
    Tap(int onAngle, int offAngle, int timer, int channel){
      this->onAngle = onAngle;
      this->offAngle = offAngle;
      this->currentAngle = offAngle; 
      this->timer = timer;
      this->channel = channel;
    }

    void triggerOn() {
      if (currentAngle == onAngle && !isMoving && !isWaitingToRest) return;
      targetAngle = onAngle;
      stepDirection = (onAngle > currentAngle) ? 1 : -1;
      isMoving = true;
      isWaitingToRest = false;
      lastStepTime = millis();
    }

    void triggerOff() {
      if (currentAngle == offAngle && !isMoving && !isWaitingToRest) return;
      targetAngle = offAngle;
      stepDirection = (offAngle > currentAngle) ? 1 : -1;
      isMoving = true;
      isWaitingToRest = false;
      lastStepTime = millis();
    }

    void update() {
      if (isWaitingToRest) {
        if (millis() - restTimer >= 5000) {
          pwm.setPWM(channel, 0, 4096); 
          isWaitingToRest = false;
        }
      }

      if (!isMoving) return;
      
      if (millis() - lastStepTime >= 15) { 
        lastStepTime = millis();
        int pulse = map(currentAngle, 0, 180, SERVOMIN, SERVOMAX);
        pwm.setPWM(channel, 0, pulse);

        if (currentAngle == targetAngle) {
          isMoving = false;
          isWaitingToRest = true;
          restTimer = millis();
        } else {
          currentAngle += stepDirection;
        }
      }
    }

    bool isBusy() { return isMoving || isWaitingToRest; }
};

Motor motor;
Tap front(130, 40, 5000, FRONT_CH);
Tap back(130, 40, 5000, BACK_CH);
Tap down(130, 40, 5000, DOWN_CH);
Tap* taps[3] = {&down, &front, &back};

// ==========================================
// SEQUENCE STATE MACHINE
// ==========================================
enum SeqState { S_IDLE, S_START_MOTOR, S_STAGGER_START_TAPS, S_WAIT_STAGGER_TAP, S_WAIT_TAPS_CLOSED_START, S_WAIT_MOTOR_ON, S_FIND_NEXT_TAP, S_WAIT_CURRENT_TAP_CLOSE_BEFORE_NEXT, S_OPEN_NEXT_TAP, S_WAIT_NEXT_TAP_OPEN, S_POURING, S_CLOSE_CURRENT_TAP, S_WAIT_CURRENT_TAP_CLOSE, S_START_MOTOR_OFF, S_WAIT_MOTOR_OFF, S_ADJUST_TAPS_POST_SEQUENCE, S_WAIT_TAPS_POST_SEQUENCE };
SeqState currentSeqState = S_IDLE;

int currentTap = -1;
int nextTap = -1;
int staggerIndex = 0;
unsigned long pourTimer = 0;
unsigned long lastSyncPublish = 0; // tracks when we last sent TAP_SYNC to app

// FIX 4: Central Abort Function for MQTT OFF and Hardware Timeouts
void abortSequence(String reason) {
    Serial.println("SYSTEM ABORT: " + reason);
    if (mqttClient.connected()) mqttClient.publish(topic_status, ("Aborted: " + reason).c_str());
    
    // Instead of forcing all servos to move simultaneously (which causes a brownout), 
    // we instruct the state machine to run the clean staggered shutdown sequence safely.
    if (currentSeqState != S_IDLE) {
        currentSeqState = S_START_MOTOR_OFF; 
        stateTimeoutTimer = millis(); 
    }
}

// Safety check run during WAIT states
bool checkHardwareTimeout() {
    if (millis() - stateTimeoutTimer > 15000) { // Increased slightly to 15s to account for staggered overlaps
        abortSequence("Hardware Movement Timeout!");
        return true;
    }
    return false;
}

void startSequence() {
  if (currentSeqState == S_IDLE) {
    Serial.println("Starting the sequence.....");
    if (mqttClient.connected()) mqttClient.publish(topic_status, "Sequence Started");
    currentTap = -1;
    currentSeqState = S_START_MOTOR;
  } else {
    Serial.println("Sequence already in progress. Ignoring command.");
  }
}

void handleSequence() {
  switch (currentSeqState) {
    case S_IDLE: 
      break;

    case S_START_MOTOR: {
      staggerIndex = 0;
      currentSeqState = S_STAGGER_START_TAPS;
      break;
    }

    case S_STAGGER_START_TAPS: {
      if (staggerIndex >= 3) {
        stateTimeoutTimer = millis();
        currentSeqState = S_WAIT_TAPS_CLOSED_START;
        break;
      }
      
      int firstEnabledTap = -1;
      for (int i = 0; i < 3; i++) {
        if (taps[i]->enabled) {
          firstEnabledTap = i;
          break;
        }
      }

      if (staggerIndex != firstEnabledTap) taps[staggerIndex]->triggerOff();
      else if (firstEnabledTap != -1) taps[staggerIndex]->triggerOn();
      
      stateTimeoutTimer = millis();
      currentSeqState = S_WAIT_STAGGER_TAP;
      break;
    }

    case S_WAIT_STAGGER_TAP:
      if (checkHardwareTimeout()) break;
      if (!taps[staggerIndex]->isBusy()) {
        staggerIndex++;
        currentSeqState = S_STAGGER_START_TAPS;
      }
      break;

    case S_WAIT_TAPS_CLOSED_START:
      if (checkHardwareTimeout()) break;
      if (!taps[0]->isMoving && !taps[1]->isMoving && !taps[2]->isMoving) {
        if (motor.status == 0) motor.triggerOn();
        stateTimeoutTimer = millis();
        currentSeqState = S_WAIT_MOTOR_ON;
      }
      break;

    case S_WAIT_MOTOR_ON:
      if (checkHardwareTimeout()) break;
      if (!motor.isBusy() && !taps[0]->isBusy() && !taps[1]->isBusy() && !taps[2]->isBusy()) {
        currentSeqState = S_FIND_NEXT_TAP;
      }
      break;

    case S_FIND_NEXT_TAP:
      nextTap = -1;
      for (int i = currentTap + 1; i < 3; i++) {
        if (taps[i]->enabled) {
          nextTap = i;
          break;
        }
      }
      
      if (nextTap != -1) {
        currentSeqState = S_OPEN_NEXT_TAP;
      } else {
        currentSeqState = S_START_MOTOR_OFF; 
      }
      break;

    case S_OPEN_NEXT_TAP:
      taps[nextTap]->triggerOn();
      
      if (mqttClient.connected()) {
        String tapId = "";
        if (taps[nextTap]->channel == FRONT_CH) tapId = "front-tap";
        else if (taps[nextTap]->channel == BACK_CH) tapId = "back-tap";
        else if (taps[nextTap]->channel == DOWN_CH) tapId = "down-tap";
        String msg = "TAP_START:" + tapId;
        mqttClient.publish(topic_command, msg.c_str());
      }
      
      stateTimeoutTimer = millis();
      currentSeqState = S_WAIT_NEXT_TAP_OPEN;
      break;

    case S_WAIT_NEXT_TAP_OPEN:
      if (checkHardwareTimeout()) break;
      if (!taps[nextTap]->isBusy()) {
        if (currentTap != -1) {
          taps[currentTap]->triggerOff();
          stateTimeoutTimer = millis();
          currentSeqState = S_WAIT_CURRENT_TAP_CLOSE_BEFORE_NEXT;
        } else {
          currentTap = nextTap;
          pourTimer = millis();
          currentSeqState = S_POURING;
        }
      }
      break;

    case S_WAIT_CURRENT_TAP_CLOSE_BEFORE_NEXT:
      if (checkHardwareTimeout()) break;
      if (!taps[currentTap]->isBusy()) {
        currentTap = nextTap;
        pourTimer = millis();
        currentSeqState = S_POURING;
      }
      break;

    case S_POURING: {
      unsigned long elapsed = millis() - pourTimer;
      unsigned long duration = taps[currentTap]->timer;

      // Move to next tap when timer expires
      if (elapsed >= duration) {
        currentSeqState = S_FIND_NEXT_TAP;
        break;
      }

      // Publish TAP_SYNC every 5 seconds so the app timer stays accurate
      if (millis() - lastSyncPublish >= 2000) {
        lastSyncPublish = millis();
        if (mqttClient.connected()) {
          // Resolve tap id string from channel
          String tapId = "";
          if (taps[currentTap]->channel == FRONT_CH)      tapId = "front-tap";
          else if (taps[currentTap]->channel == BACK_CH)  tapId = "back-tap";
          else if (taps[currentTap]->channel == DOWN_CH)  tapId = "down-tap";

          unsigned long remaining = duration - elapsed;
          String msg = "TAP_SYNC:" + tapId + ":" + String(remaining);
          mqttClient.publish(topic_command, msg.c_str());
          Serial.println("[SYNC] " + msg);
        }
      }
      break;
    }

    case S_START_MOTOR_OFF:
      motor.triggerOff();
      stateTimeoutTimer = millis();
      currentSeqState = S_WAIT_MOTOR_OFF;
      break;

    case S_WAIT_MOTOR_OFF:
      if (checkHardwareTimeout()) break;
      if (!motor.isBusy()) {
        currentSeqState = S_CLOSE_CURRENT_TAP;
      }
      break;

    case S_CLOSE_CURRENT_TAP:
      if (currentTap != -1) {
        if (taps[currentTap]->channel != DOWN_CH) {
          taps[currentTap]->triggerOff();
        }
        stateTimeoutTimer = millis();
        currentSeqState = S_WAIT_CURRENT_TAP_CLOSE;
      } else {
        currentSeqState = S_ADJUST_TAPS_POST_SEQUENCE; 
      }
      break;

    case S_WAIT_CURRENT_TAP_CLOSE:
      if (checkHardwareTimeout()) break;
      if (!taps[currentTap]->isBusy()) {
        currentSeqState = S_ADJUST_TAPS_POST_SEQUENCE;
      }
      break;

    case S_ADJUST_TAPS_POST_SEQUENCE:
      for(int i = 0; i < 3; i++) {
        if (taps[i]->channel == DOWN_CH) taps[i]->triggerOn();
        else taps[i]->triggerOff();
      }
      stateTimeoutTimer = millis();
      currentSeqState = S_WAIT_TAPS_POST_SEQUENCE;
      break;

    case S_WAIT_TAPS_POST_SEQUENCE:
      if (checkHardwareTimeout()) break;
      if (!taps[0]->isMoving && !taps[1]->isMoving && !taps[2]->isMoving) {
        currentSeqState = S_IDLE;
        Serial.println("Sequence Complete!");
        if (mqttClient.connected()) mqttClient.publish(topic_command, "Sequence Complete");
      }
      break;
  }
}

// ==========================================
// MQTT & CONFIGURATION
// ==========================================
void parseConfigString(String payload) {
    if (!payload.startsWith("CFG:")) return;
    
    // FIX: Do not allow configuration changes while a sequence is running, 
    // as it reorders the taps[] array and overwrites timers, breaking the active state machine!
    if (currentSeqState != S_IDLE) {
        Serial.println("Sequence is running. Ignoring CFG string to prevent state corruption.");
        return;
    }
    
    int parts[12]; 
    int partIndex = 0;
    int startIdx = 4;
    
    for (unsigned int i = 4; i <= payload.length(); i++) {
        if (i == payload.length() || payload.charAt(i) == ':') {
            String part = payload.substring(startIdx, i);
            if (partIndex < 12) {
                parts[partIndex] = part.toInt();
            }
            partIndex++;
            startIdx = i + 1;
        }
    } 

    // FIX 3: Strict validation check
    if (partIndex != 12) {
        Serial.println("ERROR: Invalid CFG string received. Settings not saved.");
        return;
    }

    for(int i = 0; i < 3; i++) {
      if (parts[i * 3] == FRONT_CH) taps[i] = &front;
      else if (parts[i * 3] == BACK_CH) taps[i] = &back;
      else taps[i] = &down;
    }

    taps[0]->enabled = (parts[1] == 1); taps[0]->timer = parts[2];
    taps[1]->enabled = (parts[4] == 1); taps[1]->timer = parts[5];
    taps[2]->enabled = (parts[7] == 1); taps[2]->timer = parts[8];
    
    motor.scheduleEnabled = (parts[9] == 1);
    motor.scheduleHour    = parts[10];
    motor.scheduleMinute  = parts[11];
    
    preferences.putBool("t0_en", taps[0]->enabled);
    preferences.putInt("t0_timer", taps[0]->timer);
    preferences.putBool("t1_en", taps[1]->enabled);
    preferences.putInt("t1_timer", taps[1]->timer);
    preferences.putBool("t2_en", taps[2]->enabled);
    preferences.putInt("t2_timer", taps[2]->timer);
    
    preferences.putBool("m_sch_en", motor.scheduleEnabled);
    preferences.putInt("m_sch_h", motor.scheduleHour);
    preferences.putInt("m_sch_m", motor.scheduleMinute);

    // V2: Also save the tap ORDER to flash so publishConfig() can restore it
    auto tapToId = [](Tap* t) -> String {
        if (t->channel == FRONT_CH) return "front-tap";
        if (t->channel == BACK_CH)  return "back-tap";
        return "down-tap";
    };
    String tapOrder = tapToId(taps[0]) + "," + tapToId(taps[1]) + "," + tapToId(taps[2]);
    preferences.putString("tap_order", tapOrder);
    
    Serial.println("Config updated via CFG.");
    if (mqttClient.connected()) mqttClient.publish(topic_status, "Configuration Updated & Saved");
}

// ==========================================
// V2: PUBLISH FULL CONFIG TO REACT APP
// Called when React app sends "GET_CFG"
// ==========================================
void publishConfig() {
    // Read tap order from flash (stored as "front-tap,back-tap,down-tap")
    String order = preferences.getString("tap_order", "front-tap,back-tap,down-tap");

    // Build tap parts from the stored order
    // Format: pin:en:ms for each tap in order
    String tapParts = "";
    int idx = 0;
    String remaining = order;
    while (remaining.length() > 0 && idx < 3) {
        int comma = remaining.indexOf(',');
        String tapId = (comma == -1) ? remaining : remaining.substring(0, comma);
        tapId.trim();
        remaining = (comma == -1) ? "" : remaining.substring(comma + 1);

        int pin = 8; bool en = false; int ms = 900000;
        if (tapId == "front-tap") {
            pin = FRONT_CH;
            en  = preferences.getBool("t0_en", false);
            ms  = preferences.getInt("t0_timer", 900000);
        } else if (tapId == "back-tap") {
            pin = BACK_CH;
            en  = preferences.getBool("t1_en", false);
            ms  = preferences.getInt("t1_timer", 900000);
        } else if (tapId == "down-tap") {
            pin = DOWN_CH;
            en  = preferences.getBool("t2_en", false);
            ms  = preferences.getInt("t2_timer", 900000);
        }

        if (idx > 0) tapParts += ":";
        tapParts += String(pin) + ":" + (en ? "1" : "0") + ":" + String(ms);
        idx++;
    }

    bool schEn  = preferences.getBool("m_sch_en", false);
    int  schH   = preferences.getInt("m_sch_h", 8);
    int  schM   = preferences.getInt("m_sch_m", 0);

    // Build time string "HH:MM AM/PM"
    int displayH = schH % 12; if (displayH == 0) displayH = 12;
    String ampm = (schH < 12) ? "AM" : "PM";
    char timeStr[12];
    snprintf(timeStr, sizeof(timeStr), "%02d:%02d %s", displayH, schM, ampm.c_str());

    // Final payload: CFG_SYNC:schEn:timeStr:tapParts:order
    // e.g. CFG_SYNC:0:08:00 AM:8:1:900000:4:0:900000:0:1:900000:front-tap,back-tap,down-tap
    String msg = "CFG_SYNC:" + String(schEn ? "1" : "0") + ":" + String(timeStr) +
                 ":" + tapParts + ":" + order;

    Serial.println("[V2] Publishing config to app: " + msg);
    if (mqttClient.connected()) mqttClient.publish(topic_status, msg.c_str());
}

void mqttCallback(char* topic, byte* payload, unsigned int length) {
    // FIX 2: Memory-safe string generation directly from bytes
    String message = String((char*)payload, length);
    
    Serial.print("MQTT Received: ");
    Serial.println(message);

    if (message == "GET_CFG") {
        // V2: React app is requesting the full config from flash
        publishConfig();
    }
    else if (message.startsWith("CFG:")) {
        parseConfigString(message);
    } 
    else if (message == "ON") {
        startSequence();
    } 
    else if (message == "OFF") {
        abortSequence("Manual Override OFF");
    }
}

void reconnectMQTT() {
    unsigned long currentMillis = millis();
    if (currentMillis - lastMqttReconnectAttempt >= 5000) {
        lastMqttReconnectAttempt = currentMillis;
        
        String clientId = "ESP32-" + String(random(0xffff), HEX);
        // Connect with LWT: broker publishes "Offline" (retained) if we drop unexpectedly
        if (mqttClient.connect(clientId.c_str(), mqtt_user, mqtt_pass,
                               topic_lwt, 1, true, "Offline")) {
            mqttClient.subscribe(topic_command);
            // Announce we are online (retained so app sees it immediately on subscribe)
            mqttClient.publish(topic_lwt, "Online", true);
            Serial.println("MQTT Connected with LWT");
        } else {
            Serial.println("MQTT Reconnect failed. Trying again in 5 seconds...");
        }
    }
}

// ==========================================
// SCHEDULER
// ==========================================
void handleSchedule() {
    if (!motor.scheduleEnabled || currentSeqState != S_IDLE) return;

    struct tm timeinfo;
    if (getLocalTime(&timeinfo)) {
        if (timeinfo.tm_hour == motor.scheduleHour && timeinfo.tm_min == motor.scheduleMinute) {
            if (lastTriggerMinute != timeinfo.tm_min) {
                lastTriggerMinute = timeinfo.tm_min; 
                Serial.println("Schedule matched! Starting sequence...");
                startSequence();
            }
        } else {
            lastTriggerMinute = -1; 
        }
    }
}

void setup() {
    Serial.begin(115200);
    pinMode(LED_BUILTIN, OUTPUT);
    
    preferences.begin("automotor", false);
    
    taps[0]->enabled = preferences.getBool("t0_en", false);
    taps[0]->timer = preferences.getInt("t0_timer", 10000);
    taps[1]->enabled = preferences.getBool("t1_en", false);
    taps[1]->timer = preferences.getInt("t1_timer", 10000);
    taps[2]->enabled = preferences.getBool("t2_en", false);
    taps[2]->timer = preferences.getInt("t2_timer", 10000);
    
    motor.scheduleEnabled = preferences.getBool("m_sch_en", false);
    motor.scheduleHour = preferences.getInt("m_sch_h", 0);
    motor.scheduleMinute = preferences.getInt("m_sch_m", 0);
    
    Wire.begin();
    pwm.begin();
    pwm.setPWMFreq(50); 
    
    taps[0]->currentAngle = taps[0]->onAngle;  
    taps[1]->currentAngle = taps[1]->offAngle; 
    taps[2]->currentAngle = taps[2]->offAngle; 

    motor.triggerOff();
    while (motor.isBusy()) {
        motor.update();
        delay(1);
    }
    
    for (int i = 0; i < 3; i++) {
        if (taps[i]->channel == DOWN_CH) taps[i]->triggerOn();
        else taps[i]->triggerOff();
        
        while (taps[i]->isBusy()) {
            taps[i]->update();
            delay(1);
        }
    }
    
    if (!rtc.begin()) {
        Serial.println("Couldn't find RTC module! Check wiring.");
    } else {
        updateInternalTimeFromRTC(); 
    }

    Serial.print("Connecting to WiFi");
    WiFi.begin(ssid, password);
    
    int wifiWaitCount = 0;
    while (WiFi.status() != WL_CONNECTED && wifiWaitCount < 20) {
      delay(500);
      Serial.print(".");
      wifiWaitCount++;
    }
    
    if (WiFi.status() == WL_CONNECTED) {
        Serial.println("\nWiFi Connected!");
        Serial.print("IP Address: ");
        Serial.println(WiFi.localIP());
        configTime(19800, 0, "pool.ntp.org", "time.nist.gov");
        updateRTCfromNTP(); 
    } else {
        Serial.println("\nWiFi Failed. Running in offline mode using RTC time.");
    }

    printCurrentTime();

    ESP2SOTA.begin(&server);
    server.begin();
    Serial.println("OTA HTTP server started.");

    espClient.setInsecure();
    espClient.setTimeout(15000); 
    mqttClient.setServer(mqtt_server, mqtt_port);
    mqttClient.setCallback(mqttCallback);
    mqttClient.setBufferSize(1024);    
    mqttClient.setKeepAlive(60); 
}

void loop() {
  // FIX 1: Non-Blocking WiFi Reconnection
  if (WiFi.status() != WL_CONNECTED) {
      unsigned long currentMillis = millis();
      if (currentMillis - lastWiFiReconnectAttempt >= 10000) { // Try every 10 seconds
          Serial.println("WiFi dropped. Attempting to reconnect...");
          WiFi.disconnect();
          WiFi.begin(ssid, password);
          lastWiFiReconnectAttempt = currentMillis;
      }
  }

  // 1. Maintain OTA updates
  server.handleClient();

  // 2. Maintain MQTT Connection
  if (WiFi.status() == WL_CONNECTED) {
      if (!mqttClient.connected()) reconnectMQTT();
      mqttClient.loop(); 
      
      // Keep RTC perfectly synced twice a day
      if (millis() - lastRTCSync > 43200000) { 
          updateRTCfromNTP();
          lastRTCSync = millis();
      }
  }

  // 3. Non-Blocking Blinking LED
  unsigned long currentMillis = millis();
  if (currentMillis - previousMillis >= interval) {
    previousMillis = currentMillis;
    ledState = !ledState;
    digitalWrite(LED_BUILTIN, ledState);
  }

  // 4. Update active motors and taps
  motor.update();
  for (int i = 0; i < 3; i++) {
    taps[i]->update();
  }

  // 5. Progress the sequence logic if one is running
  handleSequence();

  // 6. Check Scheduled Time
  handleSchedule();

  // --- React App Stateless Recovery ---
  static unsigned long lastStatusPublish = 0;
  if (currentSeqState != S_IDLE && (currentMillis - lastStatusPublish >= 2000)) {
     lastStatusPublish = currentMillis;
     
     if (currentSeqState == S_POURING && currentTap != -1) {
         unsigned long elapsed = currentMillis - pourTimer;
         if (taps[currentTap]->timer > elapsed) {
             unsigned long timeLeft = taps[currentTap]->timer - elapsed;
             
             String tapId = "";
             if (taps[currentTap]->channel == FRONT_CH) tapId = "front-tap";
             else if (taps[currentTap]->channel == BACK_CH) tapId = "back-tap";
             else if (taps[currentTap]->channel == DOWN_CH) tapId = "down-tap";
             
             String msg = "TAP_SYNC:" + tapId + ":" + String(timeLeft);
             if (mqttClient.connected()) mqttClient.publish(topic_command, msg.c_str());
         }
     }
  }
}
