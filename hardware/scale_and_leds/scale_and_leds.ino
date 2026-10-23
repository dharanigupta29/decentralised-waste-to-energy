// OWNER: PERSON A. OPTIONAL physical demo for the hackathon table.
// Load cell (HX711) = "waste dumped". 8 LEDs = village streetlights, driven by the digital twin.
//
// Wiring (Arduino Uno / Nano):
//   HX711 DT  -> A1        HX711 SCK -> A0      HX711 VCC -> 5V, GND -> GND
//   LEDs (each with a 220 ohm resistor to GND): D2 D3 D4 D5 D6 D7 D8 D9
// Library: "HX711 Arduino Library" by Bogdan Necula (Library Manager).
//
// Protocol (115200 baud):
//   Arduino -> PC : "W:<grams>\n" every 150 ms
//   PC -> Arduino : "L:<count 0-8>,<brightness 0-255>\n"
//   Send "T" from Serial Monitor to tare.

#include "HX711.h"

const int DT_PIN = A1, SCK_PIN = A0;
const int LED_PINS[8] = {2, 3, 4, 5, 6, 7, 8, 9};
float CALIBRATION = 420.0;   // adjust: put a known weight on, change until grams read correctly

HX711 scale;
String rx;

void setLeds(int n) {
  for (int i = 0; i < 8; i++) digitalWrite(LED_PINS[i], i < n ? HIGH : LOW);
}

void setup() {
  Serial.begin(115200);
  for (int i = 0; i < 8; i++) pinMode(LED_PINS[i], OUTPUT);
  scale.begin(DT_PIN, SCK_PIN);
  scale.set_scale(CALIBRATION);
  scale.tare();
  for (int i = 0; i <= 8; i++) { setLeds(i); delay(60); }  // boot animation
  setLeds(0);
}

void loop() {
  static unsigned long last = 0;
  if (millis() - last > 150 && scale.is_ready()) {
    last = millis();
    float g = scale.get_units(3);
    if (g < 0) g = 0;
    Serial.print("W:"); Serial.println(g, 1);
  }
  while (Serial.available()) {
    char c = Serial.read();
    if (c == '\n') {
      if (rx.startsWith("L:")) setLeds(constrain(rx.substring(2).toInt(), 0, 8));
      else if (rx.startsWith("T")) scale.tare();
      rx = "";
    } else rx += c;
  }
}
