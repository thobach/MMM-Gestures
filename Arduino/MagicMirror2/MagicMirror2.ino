/*
  RunningMedian library, taken from
  https://github.com/RobTillaart/Arduino/tree/master/libraries/RunningMedian
*/
#include <RunningMedian.h>

/*
  DistanceSensor library for GP2Y0A21YK, taken from
  https://github.com/jeroendoggen/Arduino-distance-sensor-library/tree/master/DistanceSensor
*/
#include <DistanceGP2Y0A21YK.h>

/*
  Arduino Wire library, included by default
  https://www.arduino.cc/en/Reference/Wire
*/ 
#include <Wire.h>

/*
  SparkFun_APDS9960 library for APDS-9960 gesture sensor, taken from
  https://github.com/sparkfun/APDS-9960_RGB_and_Gesture_Sensor
*/
#include <SparkFun_APDS9960.h>

/*
  Magic Mirror 2.0

  Collects gesture events from gesture sensor APDS-9960 and distance from distance
  sensor GP2Y0A21YK (10-80cm), which are then forwarded on the serial port as text.

  The circuit for an Arduino Uno:
  * input 1: APDS-9960 on digital pin 2 (interrupt) + I2C (SDA on pin A4, SCL on pin A5) + GND & VCC (3.3V)
  * input 2: GP2Y0A21YK on analog pin 0 (analog) + GND & VCC (5V)
  * output: serial out on USB
  
  In order to compile you'll need to copy the libraries from above to Arduino's library folder.

  Created 2016-08-24 by Thomas Bachmann (https://github.com/thobach)

  License: MIT

*/

// LIBRARY MODIFICATIONS

// Caution: You'll need to overwrite the fowlloing in the SparkFun_APDS9960 lib to
// prevent gesture sensor interrupt when just standing in front of mirror, this will
// reduce infrared LED power:
// #define DEFAULT_GGAIN           GGAIN_1X // was: GGAIN_4X
// #define DEFAULT_GLDRIVE         LED_DRIVE_25MA // was: LED_DRIVE_100MA


// PINS

// gesture sensor interrup pin
#define APDS9960_INT    2 // Needs to be an interrupt pin


// GLOBAL VARIABLES

// distance sensor
DistanceGP2Y0A21YK distanceSensor;

// gesture sensor
SparkFun_APDS9960 gestureSensor = SparkFun_APDS9960();

// distance is calculated on a running median using the last 8 values
RunningMedian distanceMedian = RunningMedian(8);


// CONSTANTS

// input voltage area from which a person is considered in front of the mirror
// full input voltage area 0-1023, output voltage curve: 
// https://cdn.sparkfun.com//assets/parts/1/8/4/IRSensor-3.jpg

// the higher the value (voltage), the closer one is to the mirror

// standing in front / in use: from about 60cm to 5cm
int inUseThreshold = 100; // 100/1023 * 5V = 0.5 => (less than 5cm or) less than 60cm
// away / idle: more than about 80cm away
int awayThreshold = 80; // 80/1023 * 5V = 0.4V => (less than 2cm or) more than 80cm


// STATE

// mirror is in use or not (someone stands in front of it)
boolean inUse = false;

// interrupt was received and gesture should be read from sensor
int isr_flag = 0;

// counter to ensure person is long enough away before marking mirror as idle
int countAway = 0;

// setup function is called on boot
void setup() {

  // init gesture sensor

  // Set interrupt pin as input for gesture sensor
  pinMode(APDS9960_INT, INPUT);

  Serial.begin(9600);

  // Initialize gesture sensor APDS-9960 (configure I2C and initial values)
  if (gestureSensor.init()) {

    Serial.println(F("INFO: APDS-9960 initialization complete"));

    attachInterrupt(digitalPinToInterrupt(APDS9960_INT), interruptRoutine, FALLING);

  } else {

    Serial.println(F("ERROR: Something went wrong during APDS-9960 init!"));

  }

  // start listening to distance sensor
  distanceSensor.begin(A0);
  int initDistance = distanceSensor.getDistanceRaw();

  Serial.print(F("INFO: Distance sensor listening, initial distance: "));
  Serial.println(initDistance);

}

// main loop that is called repeatedly after setup
void loop() {

  // enable gesture sensor if distance sensor shows someone in front of the mirror (distance > 100)
  if (!inUse && distanceMedian.getMedian() > inUseThreshold) {

    activateGestureSensorAndReportMirrorUse();

  }
  // disable gesture sensor if nobody is on front of mirror (distance < 80)
  else if (inUse && distanceMedian.getMedian() < awayThreshold) {

    disableGestureSensorAndReportMirrorIdle();

  }

  // get distance from distance sensor
  // range 0-1023
  int distanceRaw = distanceSensor.getDistanceRaw();
  
  // only consider running median of last 8 values
  distanceMedian.add(distanceRaw);

  // get gestures
  if (inUse) {

    // check if there was an interrupt in the meantime
    handleInterrupt();

  }
  // wait before checking distance again and activate gesture sensor
  else {

    // wait 50ms until next measurement
    delay(50);

  }

}

void activateGestureSensorAndReportMirrorUse() {

  countAway = 0;
  inUse = true;
  Serial.println(F("Person: PRESENT"));

  if (gestureSensor.enableGestureSensor(true)) {
    Serial.println(F("INFO: Gesture sensor is now running"));
  } else {
    Serial.println(F("ERROR: Something went wrong during gesture sensor enable!"));
  }

}

void disableGestureSensorAndReportMirrorIdle() {

  countAway++;

  if (countAway > 100) {

    inUse = false;
    Serial.println(F("Person: AWAY"));

    if (gestureSensor.disableGestureSensor()) {
      Serial.println(F("INFO: Gesture sensor is now disabled"));
    } else {
      Serial.println(F("ERROR: Something went wrong during gesture sensor disable!"));
    }

  }

}

// check for interrupt, if one is present it means gesture is present,
// in that case stop interrupt handler, handle gesture and attach
// interrupt handler again
void handleInterrupt() {

  // if interrupt was set, read and print gesture, reset interrupt flag
  if (isr_flag == 1) {

    detachInterrupt(digitalPinToInterrupt(APDS9960_INT));

    handleGesture();

    isr_flag = 0;

    attachInterrupt(digitalPinToInterrupt(APDS9960_INT), interruptRoutine, FALLING);

  }

}

// interrupt function for interrupt pin that APDS9960 is attached to
void interruptRoutine() {

  isr_flag = 1;

}

// on gestor sensor interrupt send serial message with gesture
void handleGesture() {

  if (gestureSensor.isGestureAvailable()) {

    switch (gestureSensor.readGesture()) {
      case DIR_UP:
        Serial.println(F("Gesture: UP"));
        break;
      case DIR_DOWN:
        Serial.println(F("Gesture: DOWN"));
        break;
      case DIR_LEFT:
        Serial.println(F("Gesture: LEFT"));
        break;
      case DIR_RIGHT:
        Serial.println(F("Gesture: RIGHT"));
        break;
      case DIR_NEAR:
        Serial.println(F("Gesture: NEAR"));
        break;
      case DIR_FAR:
        Serial.println(F("Gesture: FAR"));
        break;
      default:
        Serial.println(F("Gesture: NONE"));
    }

  }

}

