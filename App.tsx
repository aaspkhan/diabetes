import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  Heart, 
  Activity, 
  Bluetooth, 
  BluetoothConnected, 
  ShieldCheck, 
  AlertTriangle,
  RotateCcw,
  Zap,
  Loader2
} from 'lucide-react';
import { BluetoothService } from './services/bluetoothService';
import { analyzeDiabetesRisk } from './services/geminiService';
import { MetricCard } from './components/MetricCard';
import { HeartChart } from './components/HeartChart';
import { RiskGauge } from './components/RiskGauge';
import { HealthMetrics, RiskAnalysisResult, DeviceConnectionState } from './types';
import { DEFAULT_METRICS } from './constants';

export default function App() {
  // State
  const [connectionState, setConnectionState] = useState<DeviceConnectionState>({
    isConnected: false,
    deviceName: null,
    batteryLevel: null,
    error: null,
  });

  const [metrics, setMetrics] = useState<HealthMetrics>(DEFAULT_METRICS);
  const [bpmHistory, setBpmHistory] = useState<{time: string, bpm: number}[]>([]);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [riskData, setRiskData] = useState<RiskAnalysisResult | null>(null);
  const [scanningHeartRate, setScanningHeartRate] = useState(false);
  
  // Refs
  const bluetoothService = useRef<BluetoothService | null>(null);

  // Initialize Bluetooth Service and Idle Simulation
  useEffect(() => {
    bluetoothService.current = new BluetoothService(
      (hr) => {
        handleNewHeartRate(hr);
      },
      () => {
        setConnectionState(prev => ({ ...prev, isConnected: false, deviceName: null, error: "Device disconnected" }));
      }
    );

    // Initial dummy history
    const initialHistory = Array.from({ length: 20 }, (_, i) => ({
      time: new Date(Date.now() - (20 - i) * 1000).toLocaleTimeString([], { hour12: false, minute: '2-digit', second: '2-digit' }),
      bpm: 72 + (Math.random() * 2 - 1)
    }));
    setBpmHistory(initialHistory);

    // Simulation Timer (Runs when NOT connected to keep the UI alive)
    const interval = setInterval(() => {
        setMetrics(prev => {
             // Only simulate if NOT connected
             if (connectionState.isConnected) return prev;

             const sysChange = Math.floor(Math.random() * 5) - 2;
             const diaChange = Math.floor(Math.random() * 3) - 1;
             
             // Simulate slight HR fluctuation for the graph
             const currentHr = prev.heartRate;
             const hrChange = Math.random() > 0.5 ? 1 : -1;
             const newHr = Math.max(60, Math.min(100, currentHr + (Math.random() > 0.7 ? hrChange : 0)));

             const newMetrics = {
                 ...prev,
                 heartRate: newHr,
                 systolicBP: Math.max(90, Math.min(180, prev.systolicBP + (Math.random() > 0.8 ? sysChange : 0))),
                 diastolicBP: Math.max(60, Math.min(110, prev.diastolicBP + (Math.random() > 0.8 ? diaChange : 0))),
                 lastUpdated: new Date()
             };

             // Update history manually for simulation
             setBpmHistory(h => {
                const newPoint = {
                    time: new Date().toLocaleTimeString([], { hour12: false, minute: '2-digit', second: '2-digit' }),
                    bpm: newHr
                };
                const newHistory = [...h, newPoint];
                if (newHistory.length > 30) newHistory.shift(); 
                return newHistory;
             });

             return newMetrics;
        });
    }, 1000); // Update every second to make the graph move

    return () => clearInterval(interval);
  }, [connectionState.isConnected]);

  const handleNewHeartRate = (hr: number) => {
    setMetrics(prev => ({ ...prev, heartRate: hr, lastUpdated: new Date() }));
    setBpmHistory(prev => {
      const newPoint = {
        time: new Date().toLocaleTimeString([], { hour12: false, minute: '2-digit', second: '2-digit' }),
        bpm: hr
      };
      const newHistory = [...prev, newPoint];
      if (newHistory.length > 30) newHistory.shift(); // Keep last 30 points
      return newHistory;
    });
  };

  const connectDevice = async () => {
    setConnectionState(prev => ({ ...prev, error: null }));
    setIsConnecting(true);
    
    try {
      if (bluetoothService.current) {
        const name = await bluetoothService.current.connect();
        setConnectionState({
          isConnected: true,
          deviceName: name,
          batteryLevel: 85, // Mock battery for now
          error: null
        });
      }
    } catch (err: any) {
        console.error("Connection error:", err);
        let errorMsg = "Failed to connect";
        
        if (err.name === 'NotFoundError') {
             errorMsg = "No device selected. Please try again.";
        } else if (err.name === 'SecurityError') {
             errorMsg = "Security Block: Check permissions or site SSL.";
        } else if (err.message && err.message.includes('permissions policy')) {
             errorMsg = "Bluetooth blocked by Permissions Policy.";
        } else if (err.message) {
             errorMsg = err.message;
        }
        
        setConnectionState(prev => ({ 
            ...prev, 
            error: errorMsg,
        }));
    } finally {
        setIsConnecting(false);
    }
  };

  const measureHeartRate = async () => {
      if (!connectionState.isConnected) {
          connectDevice();
          return;
      }
      
      if (!bluetoothService.current) return;

      setScanningHeartRate(true);
      try {
          // This will wait for the next data packet from the watch
          const hr = await bluetoothService.current.requestHeartRate();
          // Update immediately just in case (though listener usually handles it)
          handleNewHeartRate(hr);
      } catch (err) {
          console.error("Manual scan timed out or failed", err);
          // Alert the user if timeout happens
          setConnectionState(prev => ({
              ...prev,
              error: "Scan Timed Out: Please tap your watch screen to wake it up."
          }));
          setTimeout(() => setConnectionState(prev => ({ ...prev, error: null })), 5000);
      } finally {
          setScanningHeartRate(false);
      }
  };

  const handleAnalyzeRisk = async () => {
    setAnalyzing(true);
    setAnalysisError(null);
    try {
      // Use metrics + mock user profile (Age 45, Weight 85kg)
      const result = await analyzeDiabetesRisk(metrics, 45, 85);
      setRiskData(result);
    } catch (e: any) {
      console.error(e);
      // We shouldn't reach here often now that analyzeDiabetesRisk catches its own errors
      setAnalysisError("Risk analysis failed. Please check your internet connection.");
    } finally {
      setAnalyzing(false);
    }
  };

  return (
    <div className="min-h-screen bg-dark text-slate-200 pb-10">
      
      {/* Header */}
      <header className="bg-surface border-b border-slate-700 sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Activity className="text-primary w-6 h-6" />
            <h1 className="text-xl font-bold tracking-tight text-white">GlucoGuard AI</h1>
          </div>
          <div className="flex items-center gap-4">
            <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium ${connectionState.isConnected ? 'bg-green-500/10 text-green-400' : 'bg-slate-700 text-slate-400'}`}>
              {connectionState.isConnected ? <BluetoothConnected className="w-4 h-4" /> : <Bluetooth className="w-4 h-4" />}
              {connectionState.isConnected ? connectionState.deviceName : 'Disconnected'}
            </div>
            {connectionState.isConnected && connectionState.batteryLevel && (
               <span className="text-xs text-slate-400">{connectionState.batteryLevel}% Bat</span>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 pt-6 space-y-6">

        {/* Connection Hero (Visible if not connected) */}
        {!connectionState.isConnected && (
            <div className="bg-gradient-to-r from-blue-900/40 to-indigo-900/40 border border-blue-800 rounded-2xl p-6 md:p-8 text-center space-y-4 relative overflow-hidden">
                {/* Error Banner */}
                {connectionState.error && (
                    <div className="absolute top-0 left-0 right-0 bg-red-500/90 text-white text-sm py-2 px-4 flex items-center justify-center gap-2 animate-pulse">
                        <AlertTriangle className="w-4 h-4" />
                        {connectionState.error}
                    </div>
                )}

                <div className="bg-blue-600/20 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 mt-4">
                    <Bluetooth className="w-8 h-8 text-blue-400 animate-pulse" />
                </div>
                <h2 className="text-2xl font-bold text-white">Connect your Watch</h2>
                <p className="text-slate-400 max-w-md mx-auto">
                    Pair your Bluetooth Low Energy (BLE) device to start tracking Heart Rate and analyzing your metabolic health in real-time.
                </p>
                <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
                    <button 
                        onClick={connectDevice}
                        disabled={isConnecting}
                        className={`bg-primary hover:bg-sky-600 text-white px-6 py-3 rounded-lg font-semibold transition-all shadow-lg shadow-sky-900/20 flex items-center justify-center gap-2 ${isConnecting ? 'opacity-70 cursor-wait' : ''}`}
                    >
                        {isConnecting ? (
                            <>
                                <Loader2 className="w-5 h-5 animate-spin" />
                                Scanning...
                            </>
                        ) : (
                            <>
                                <Bluetooth className="w-5 h-5" />
                                Find Device
                            </>
                        )}
                    </button>
                </div>
                
                {/* Additional Help Text */}
                <p className="text-xs text-slate-500 mt-4">
                    Note: Ensure Bluetooth is on and site permission is allowed in browser settings.
                </p>
            </div>
        )}

        {/* Metrics Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <MetricCard 
            title="Heart Rate" 
            value={metrics.heartRate} 
            unit="BPM" 
            icon={Heart} 
            colorClass="text-rose-500" 
            trend={metrics.heartRate > 100 ? "Elevated" : "Normal Resting"}
            onClick={measureHeartRate}
            isLoading={scanningHeartRate}
          />
          <MetricCard 
            title="Blood Pressure" 
            value={`${metrics.systolicBP}/${metrics.diastolicBP}`} 
            unit="mmHg" 
            icon={Activity} 
            colorClass="text-primary" 
            trend={metrics.systolicBP > 130 ? "Monitor Closely" : "Optimal"}
          />
        </div>

        {/* Chart Section */}
        <div className="bg-surface border border-slate-700 rounded-xl p-4 md:p-6 shadow-lg">
           <div className="flex justify-between items-center mb-6">
                <h3 className="text-lg font-semibold text-white">Live Heart Rate</h3>
                <span className="text-xs text-slate-400 bg-slate-800 px-2 py-1 rounded">Last 60s</span>
           </div>
           <HeartChart data={bpmHistory} />
        </div>

        {/* AI Analysis Section */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            
            {/* Action Card */}
            <div className="bg-gradient-to-br from-indigo-900/50 to-purple-900/50 border border-indigo-500/30 rounded-xl p-6 flex flex-col justify-center items-start shadow-lg">
                <div className="mb-4">
                    <h2 className="text-2xl font-bold text-white mb-2">Diabetes Risk AI</h2>
                    <p className="text-indigo-200 text-sm mb-4">
                        Analyze your current biometrics (BPM, BP) combined with your profile to estimate metabolic risk factors using Gemini 1.5.
                    </p>
                </div>
                <button
                    onClick={handleAnalyzeRisk}
                    disabled={analyzing}
                    className={`w-full py-3 rounded-lg font-bold flex items-center justify-center gap-2 transition-all ${
                        analyzing 
                        ? 'bg-slate-700 text-slate-400 cursor-not-allowed' 
                        : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-900/50'
                    }`}
                >
                    {analyzing ? (
                        <>
                            <RotateCcw className="w-5 h-5 animate-spin" />
                            Analyzing...
                        </>
                    ) : (
                        <>
                            <Zap className="w-5 h-5 fill-current" />
                            Calculate Risk
                        </>
                    )}
                </button>
            </div>

            {/* Results Area */}
            <div className="md:col-span-2 bg-surface border border-slate-700 rounded-xl p-4 md:p-6 min-h-[250px] relative overflow-hidden">
                {!riskData && !analyzing && !analysisError && (
                    <div className="flex flex-col items-center justify-center h-full text-slate-500 text-center">
                        <ShieldCheck className="w-16 h-16 mb-3 opacity-20" />
                        <p>Press "Calculate Risk" to generate an assessment.</p>
                    </div>
                )}

                {analyzing && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-surface z-10">
                        <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mb-4"></div>
                        <p className="text-indigo-400 animate-pulse">Consulting Gemini Medical Model...</p>
                    </div>
                )}
                
                {analysisError && !analyzing && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-surface z-10 text-center px-6">
                        <AlertTriangle className="w-12 h-12 text-red-500 mb-2" />
                        <h3 className="text-white font-bold mb-1">Analysis Failed</h3>
                        <p className="text-slate-400 text-sm">{analysisError}</p>
                        <button 
                            onClick={() => setAnalysisError(null)}
                            className="mt-4 text-indigo-400 hover:text-indigo-300 text-sm"
                        >
                            Try Again
                        </button>
                    </div>
                )}

                {riskData && !analyzing && !analysisError && (
                    <div className="flex flex-col md:flex-row gap-6 animate-fade-in">
                        <div className="flex-shrink-0 flex flex-col items-center justify-center md:w-1/3 border-r border-slate-700 pr-4">
                            <RiskGauge score={riskData.score} level={riskData.riskLevel} />
                        </div>
                        <div className="flex-1">
                             <h3 className="text-xl font-bold text-white mb-2">Analysis Report</h3>
                             <p className="text-slate-300 text-sm leading-relaxed mb-4">
                                {riskData.summary}
                             </p>
                             
                             <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Recommendations</h4>
                             <ul className="space-y-2">
                                {riskData.recommendations.map((rec, idx) => (
                                    <li key={idx} className="flex items-start gap-2 text-sm text-slate-300">
                                        <div className="min-w-[6px] h-[6px] rounded-full bg-primary mt-1.5"></div>
                                        {rec}
                                    </li>
                                ))}
                             </ul>
                        </div>
                    </div>
                )}
            </div>
        </div>

      </main>
    </div>
  );
}