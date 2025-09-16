# Hook & Ring 

A hybrid project bringing the classic bar game **Hook & Ring** into both the **digital** and **physical** worlds.

- **Visual Browser Sim** — play a 2-player drag-and-throw mini game right in your browser 
- **Arduino Scorer** — add automatic scoring to a real hook & ring setup with a hall sensor + magnet.

---

## Features

### Visual (Canvas Mini Sim)
- Mouse drag → aim and throw a ring
- Gravity + bounce physics
- Hook detection + scoring
- Two-player alternating turns
- Win condition: race to 21, must win by 2
- Deployable to **GitHub Pages**

### Arduino Scorer
- Hall sensor detects when a magnetized ring lands on the hook
- Auto score counter for **Player 1** and **Player 2**
- Target to 21, win by 2
- Optional:
  - Piezo buzzer feedback
  - SSD1306 OLED display (scoreboard)
  - Reset + next-player buttons
- Configurable debounce + target score

---

---

## Visual Game (Browser)

### Run Locally
```bash
cd visual
python3 -m http.server 8000
# open http://localhost:8000

---

Deploy on GitHub Pages
	1.	Push repo to GitHub.
	2.	Go to Settings → Pages.
	3.	Source: main branch, folder = /visual.
	4.	Save. Your game will be live at:

https://<ginesthoii>.github.io/hook-and-ring/


---

Arduino Scorer

Hardware Needed
	•	Arduino Uno/Nano
	•	A3144 Hall sensor (or reed switch)
	•	Small neodymium magnet (epoxied to ring)
	•	Buzzer (optional)
	•	SSD1306 128x64 OLED I²C (optional)
	•	Push buttons (optional reset + next)
	•	Breadboard + jumpers

Core Wiring
	•	Hall OUT → D2
	•	Buzzer + → D8
	•	OLED SDA → A4, SCL → A5 (Uno/Nano)
	•	Buttons → D3/D4 (active LOW)

Upload
	1.	Open arduino/hook_and_ring_scorer.ino in Arduino IDE.
	2.	Install required libraries if using OLED:
	•	Adafruit SSD1306
	•	Adafruit GFX
	3.	Compile + upload.


Next Steps / Ideas
	•	Visual sim: add rope arc constraint for realism
	•	Arduino: save scores in EEPROM
	•	Add 3D-printed hook mount + enclosure
	•	Multiplayer sets + scoreboard mode


# Advanced Modes

### Visual Rope Physics
- Fixed rope length with pendulum update (`angle`, `angVel`, `angAcc`)
- Damping for realistic slow-down
- Hook capture radius with snap + score
- Best-of-3 sets with match victory overlay

### Arduino Persistence & Sets
- EEPROM saves scores, sets, current player, target
- Writes only on change to reduce wear
- Buttons:
  - **D3** Match Reset
  - **D4** Next Player
  - **D5** New Game (keep sets)
- Best-of-3 sets; game to 21 (win by 2); configurable in code

### 3D Printed Mount
- `hardware/hook_sensor_mount.scad` parametric OpenSCAD
- Backplate + standoff pocket for Hall sensor
- Wire channel, screw holes