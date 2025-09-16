---

# Arduino (EEPROM + sets/scoreboard)

**What’s new**
- Persists **P1/P2 scores**, **set scores**, **current player**, and **target** in **EEPROM**
- Best-of-3 **sets**, win game by 2
- Writes to EEPROM **only when values change** (limits wear)
- On boot, reads state and resumes

**Pins** (unchanged from before; one extra button for “New Game” optional)
- Hall OUT → D2 (INPUT_PULLUP, active-LOW typical)
- Buzzer → D8
- Reset Match → D3 (to GND, INPUT_PULLUP)
- Next Player → D4 (to GND, INPUT_PULLUP)
- New Game → D5 (optional; to GND, INPUT_PULLUP)
- OLED I²C → SDA A4, SCL A5 (Uno/Nano)

## `arduino/hook_and_ring_scorer.ino`
```cpp
// Hook & Ring — Arduino Scorer with EEPROM + Sets
// - Two players, game to TARGET, win by 2
// - Best-of-3 sets (first to 2)
// - EEPROM persistence for scores, sets, current player, target
// - Hall sensor detects magnet on ring (active-LOW typical)

#include <Arduino.h>
#include <EEPROM.h>

#define USE_OLED 1
#if USE_OLED
  #include <Adafruit_GFX.h>
  #include <Adafruit_SSD1306.h>
  #define SCREEN_WIDTH 128
  #define SCREEN_HEIGHT 64
  Adafruit_SSD1306 display(SCREEN_WIDTH, SCREEN_HEIGHT, &Wire, -1);
#endif

// ---- Pins ----
const int HALL_PIN   = 2;  // sensor OUT (INPUT_PULLUP)
const int BUZZ_PIN   = 8;  // buzzer
const int BTN_RESET  = 3;  // match reset (active LOW)
const int BTN_NEXT   = 4;  // force next player (active LOW)
const int BTN_NEWGM  = 5;  // new game (keep sets) (active LOW)

// ---- Game Config ----
const int TARGET_DEFAULT = 21;
const int BEST_OF_SETS   = 3; // first to 2
const unsigned long DEBOUNCE_MS = 700;

// ---- Game State ----
struct State {
  uint16_t p1;
  uint16_t p2;
  uint8_t  sets1;
  uint8_t  sets2;
  uint8_t  current; // 1 or 2
  uint8_t  target;
  uint8_t  checksum; // simple checksum
} st;

// ---- EEPROM layout ----
const int EE_ADDR = 0; // store entire struct at 0

uint8_t computeChecksum(const State &s) {
  // very simple sum, excluding checksum field
  uint16_t sum = 0;
  sum += s.p1;
  sum += s.p2;
  sum += s.sets1;
  sum += s.sets2;
  sum += s.current;
  sum += s.target;
  return (uint8_t)(sum & 0xFF);
}

void writeState() {
  State tmp = st;
  tmp.checksum = computeChecksum(tmp);
  EEPROM.put(EE_ADDR, tmp);
}

bool readState() {
  State tmp;
  EEPROM.get(EE_ADDR, tmp);
  if (tmp.target == 0 || tmp.target > 99) return false;
  if (tmp.current < 1 || tmp.current > 2) return false;
  if (tmp.checksum != computeChecksum(tmp)) return false;
  st = tmp;
  return true;
}

void resetMatch() {
  st.p1 = st.p2 = 0;
  st.sets1 = st.sets2 = 0;
  st.current = 1;
  st.target = TARGET_DEFAULT;
  writeState();
}

void newGameKeepSets() {
  st.p1 = st.p2 = 0;
  // alternate starting player by last set winner? You can change this policy.
  // Here we just keep current as-is.
  writeState();
}

bool winByTwo(int a, int b, int tgt) {
  int hi = max(a,b), lo = min(a,b);
  return (hi >= tgt) && (hi - lo) >= 2;
}

int setsToWin() { return (BEST_OF_SETS / 2) + 1; }

// ---- Timing / Debounce ----
unsigned long lastTriggerMs = 0;
bool prevMagnet = false;

// ---- Buzzer ----
void beep(int ms = 80, int freq = 1800) {
  tone(BUZZ_PIN, freq);
  delay(ms);
  noTone(BUZZ_PIN);
}

// ---- Draw OLED ----
void drawOLED(const char* status = "") {
#if USE_OLED
  display.clearDisplay();
  display.setTextColor(SSD1306_WHITE);

  display.setTextSize(1);
  display.setCursor(0,0); display.print("Hook & Ring");

  display.setCursor(84,0);
  display.print("Tgt:");
  display.print(st.target);

  display.setCursor(0,12);
  display.print("Turn:");
  display.print(st.current == 1 ? "P1" : "P2");

  display.setCursor(64,12);
  display.print(status);

  display.setTextSize(2);
  display.setCursor(0, 28);  display.print("P1:");
  display.print(st.p1);

  display.setCursor(64, 28); display.print("P2:");
  display.print(st.p2);

  display.setTextSize(1);
  display.setCursor(0, 52);
  display.print("Sets  P1:");
  display.print(st.sets1);
  display.print(" P2:");
  display.print(st.sets2);

  display.display();
#endif
}

// ---- Safe write: only write when changed ----
void safeWriteState(const State &oldS) {
  if (memcmp(&oldS, &st, sizeof(State)) != 0) {
    writeState();
  }
}

void setup() {
  pinMode(HALL_PIN, INPUT_PULLUP);
  pinMode(BUZZ_PIN, OUTPUT);
  pinMode(BTN_RESET, INPUT_PULLUP);
  pinMode(BTN_NEXT, INPUT_PULLUP);
  pinMode(BTN_NEWGM, INPUT_PULLUP);

  Serial.begin(115200);
  Serial.println("Hook & Ring Scorer (EEPROM + Sets)");

#if USE_OLED
  if(!display.begin(SSD1306_SWITCHCAPVCC, 0x3C)) {
    Serial.println("OLED not found; continuing headless.");
  } else {
    display.clearDisplay(); display.display();
  }
#endif

  if (!readState()) {
    resetMatch();
  }
  drawOLED("Ready");
}

void loop() {
  State before = st;

  // Buttons
  if (digitalRead(BTN_RESET) == LOW) {
    delay(20);
    if (digitalRead(BTN_RESET) == LOW) {
      resetMatch();
      drawOLED("Match Reset");
      beep(120, 1400);
      while (digitalRead(BTN_RESET) == LOW) {}
      delay(150);
    }
  }
  if (digitalRead(BTN_NEWGM) == LOW) {
    delay(20);
    if (digitalRead(BTN_NEWGM) == LOW) {
      newGameKeepSets();
      drawOLED("New Game");
      beep(80, 1200);
      while (digitalRead(BTN_NEWGM) == LOW) {}
      delay(150);
    }
  }
  if (digitalRead(BTN_NEXT) == LOW) {
    delay(20);
    if (digitalRead(BTN_NEXT) == LOW) {
      st.current = (st.current == 1) ? 2 : 1;
      drawOLED("Next Turn");
      beep(60, 1000);
      while (digitalRead(BTN_NEXT) == LOW) {}
      delay(150);
    }
  }

  // Sensor
  bool magnetPresent = (digitalRead(HALL_PIN) == LOW); // typical: LOW when magnet
  unsigned long now = millis();

  if (!prevMagnet && magnetPresent) {
    if (now - lastTriggerMs > DEBOUNCE_MS) {
      lastTriggerMs = now;

      // Score
      if (st.current == 1) st.p1++; else st.p2++;
      Serial.print("Score -> P1:"); Serial.print(st.p1);
      Serial.print(" P2:"); Serial.println(st.p2);
      drawOLED("Score!");
      beep(90, 1900);

      // Game win?
      int gw = 0;
      if (winByTwo(st.p1, st.p2, st.target)) {
        gw = (st.p1 > st.p2) ? 1 : 2;
      }

      if (gw != 0) {
        if (gw == 1) st.sets1++; else st.sets2++;
        drawOLED("Set Won");
        // celebration
        beep(120, 1600); delay(80);
        beep(120, 1800); delay(80);
        beep(160, 2000);

        // Match win?
        int need = (BEST_OF_SETS / 2) + 1;
        if (st.sets1 >= need || st.sets2 >= need) {
          drawOLED("MATCH!");
          // triple-long beep
          beep(160, 1400); delay(100);
          beep(200, 1600); delay(120);
          beep(240, 1800);
          resetMatch();        // auto reset full match
          drawOLED("Ready");
        } else {
          // New game (keep sets), alternate starting player to loser’s serve:
          st.p1 = st.p2 = 0;
          // Start next game with the player who lost the set:
          st.current = (gw == 1) ? 2 : 1;
          drawOLED("New Game");
        }
      } else {
        // Alternate turn after made hook
        st.current = (st.current == 1) ? 2 : 1;
        drawOLED("Next Turn");
      }
    }
  }
  prevMagnet = magnetPresent;

  // Persist if changed
  safeWriteState(before);
}