export interface HealthMetrics {
  heartRate: number;
  systolicBP: number;
  diastolicBP: number;
  hrv: number; // Heart Rate Variability (ms)
  glucose: number; // mg/dL
  lastUpdated: Date;
}

export interface UserProfile {
  age: number;
  weight: number; // kg
  height: number; // cm
  waist: number; // cm
}

export interface FoodAnalysisResult {
  foodName: string;
  glycemicLoad: number; // 0-100
  carbs: number; // grams
  analysis: string;
  riskColor: string;
}

export interface RiskAnalysisResult {
  riskLevel: 'Low' | 'Moderate' | 'High' | 'Critical';
  score: number; // 0 to 100
  summary: string;
  recommendations: string[];
}

export interface DeviceConnectionState {
  isConnected: boolean;
  deviceName: string | null;
  batteryLevel: number | null;
  error: string | null;
}