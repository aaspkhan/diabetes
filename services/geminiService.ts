import { GoogleGenAI, Type } from "@google/genai";
import { HealthMetrics, RiskAnalysisResult, FoodAnalysisResult } from "../types";

export async function analyzeDiabetesRisk(metrics: HealthMetrics, age: number, weight: number, waist: number, height: number): Promise<RiskAnalysisResult> {
  const model = "gemini-3-flash-preview";
  
  // Calculate WHtR (Waist to Height Ratio)
  const whtr = waist / height;
  const whtrRisk = whtr > 0.5 ? "High (Central Obesity)" : "Normal";

  const prompt = `
    Analyze health metrics for: Age ${age}, Weight ${weight}kg, Waist ${waist}cm, Height ${height}cm.
    
    Metrics:
    - RHR: ${metrics.heartRate} bpm
    - HRV: ${metrics.hrv} ms (Lower is worse)
    - BP: ${metrics.systolicBP}/${metrics.diastolicBP}
    - Glucose: ${metrics.glucose} mg/dL
    - Waist-to-Height Ratio: ${whtr.toFixed(2)} (${whtrRisk})

    Estimate Type 2 Diabetes risk. Return JSON.
  `;

  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

    const response = await ai.models.generateContent({
      model: model,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            riskLevel: { type: Type.STRING, enum: ["Low", "Moderate", "High", "Critical"] },
            score: { type: Type.NUMBER },
            summary: { type: Type.STRING },
            recommendations: { type: Type.ARRAY, items: { type: Type.STRING } }
          },
          required: ["riskLevel", "score", "summary", "recommendations"]
        }
      }
    });

    if (!response.text) throw new Error("Empty response from AI");
    return JSON.parse(response.text) as RiskAnalysisResult;

  } catch (error) {
    console.error("Analysis Failed:", error);
    // Return a fallback/error object for risk analysis to prevent app crash, 
    // but log the error clearly.
    return {
      riskLevel: "Moderate",
      score: 50,
      summary: "Could not connect to AI service. Please check your internet connection or .env configuration.",
      recommendations: ["Monitor manually", "Consult a doctor"]
    };
  }
}

export async function analyzeFood(base64Image: string): Promise<FoodAnalysisResult> {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    const prompt = "Identify this food. Estimate the total carbohydrates (g) and Glycemic Load (0-100). Provide a short health analysis for a diabetic.";

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: {
                parts: [
                    { inlineData: { mimeType: 'image/jpeg', data: base64Image } },
                    { text: prompt }
                ]
            },
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        foodName: { type: Type.STRING },
                        glycemicLoad: { type: Type.NUMBER },
                        carbs: { type: Type.NUMBER },
                        analysis: { type: Type.STRING },
                        riskColor: { type: Type.STRING, enum: ["green", "yellow", "red"] }
                    },
                    required: ["foodName", "glycemicLoad", "carbs", "analysis", "riskColor"]
                }
            }
        });

        if (!response.text) throw new Error("No response generated.");
        return JSON.parse(response.text) as FoodAnalysisResult;
    } catch (e: any) {
        console.error("Food Analysis Error:", e);
        throw new Error(e.message || "Failed to analyze food image.");
    }
}