import React, { useState, useRef } from 'react';
import { Camera, Upload, Loader2, Utensils, CheckCircle } from 'lucide-react';
import { analyzeFood } from '../services/geminiService';
import { FoodAnalysisResult } from '../types';

export const FoodScanner: React.FC = () => {
  const [image, setImage] = useState<string | null>(null);
  const [result, setResult] = useState<FoodAnalysisResult | null>(null);
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = reader.result as string;
        setImage(base64);
        processImage(base64.split(',')[1]); // Remove data:image/jpeg;base64, prefix
      };
      reader.readAsDataURL(file);
    }
  };

  const processImage = async (base64Data: string) => {
    setLoading(true);
    setResult(null);
    try {
      const data = await analyzeFood(base64Data);
      setResult(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-surface border border-slate-700 rounded-xl p-6 shadow-lg">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-3 bg-purple-500/20 rounded-full">
            <Utensils className="w-6 h-6 text-purple-400" />
        </div>
        <div>
            <h3 className="text-xl font-bold text-white">AI Food Scanner</h3>
            <p className="text-sm text-slate-400">Estimate Glycemic Load via Camera</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Upload Area */}
        <div 
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-slate-600 rounded-xl flex flex-col items-center justify-center p-8 cursor-pointer hover:bg-slate-800/50 transition-colors h-64 relative overflow-hidden"
        >
          {image ? (
            <img src={image} alt="Food" className="absolute inset-0 w-full h-full object-cover opacity-50" />
          ) : (
             <div className="text-center">
                <Camera className="w-10 h-10 text-slate-400 mx-auto mb-3" />
                <p className="text-sm text-slate-300">Tap to take photo</p>
             </div>
          )}
          <input 
             ref={fileInputRef}
             type="file" 
             accept="image/*" 
             capture="environment"
             className="hidden" 
             onChange={handleCapture}
          />
          
          {loading && (
             <div className="absolute inset-0 flex items-center justify-center bg-black/60 backdrop-blur-sm">
                <Loader2 className="w-8 h-8 text-purple-400 animate-spin" />
             </div>
          )}
        </div>

        {/* Results */}
        <div className="flex flex-col justify-center">
            {result ? (
                <div className="space-y-4 animate-fade-in">
                    <div>
                        <h4 className="text-2xl font-bold text-white">{result.foodName}</h4>
                        <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold mt-2 uppercase ${
                            result.riskColor === 'green' ? 'bg-green-500/20 text-green-400' :
                            result.riskColor === 'yellow' ? 'bg-yellow-500/20 text-yellow-400' :
                            'bg-red-500/20 text-red-400'
                        }`}>
                            GL Risk: {result.riskColor}
                        </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                        <div className="bg-slate-800 p-3 rounded-lg">
                            <span className="text-slate-400 text-xs">Glycemic Load</span>
                            <p className="text-xl font-bold text-white">{result.glycemicLoad}</p>
                        </div>
                        <div className="bg-slate-800 p-3 rounded-lg">
                            <span className="text-slate-400 text-xs">Carbs</span>
                            <p className="text-xl font-bold text-white">{result.carbs}g</p>
                        </div>
                    </div>

                    <p className="text-sm text-slate-300 italic">"{result.analysis}"</p>
                </div>
            ) : (
                <div className="text-center text-slate-500">
                    <p>Take a photo of your meal to analyze its impact on your blood sugar.</p>
                </div>
            )}
        </div>
      </div>
    </div>
  );
};