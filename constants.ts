// Standard Bluetooth Low Energy UUIDs
export const BLE_SERVICES = {
  HEART_RATE: 0x180D,
  BATTERY: 0x180F,
  BLOOD_PRESSURE: 0x1810, 
  GLUCOSE: 0x1808, // Continuous Glucose Monitoring
};

export const BLE_CHARACTERISTICS = {
  HEART_RATE_MEASUREMENT: 0x2A37,
  BODY_SENSOR_LOCATION: 0x2A38,
  BATTERY_LEVEL: 0x2A19,
  BLOOD_PRESSURE_MEASUREMENT: 0x2A35,
  GLUCOSE_MEASUREMENT: 0x2A18,
};

export const MOCK_DATA_INTERVAL = 2000; // ms

export const DEFAULT_METRICS = {
  heartRate: 72,
  systolicBP: 120,
  diastolicBP: 80,
  hrv: 45,
  glucose: 98,
  lastUpdated: new Date(),
};

export const DEFAULT_PROFILE = {
  age: 45,
  weight: 85,
  height: 175,
  waist: 90
};