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
  Loader2,
  Utensils,
  TrendingUp,
  User,
  Clock
} from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { BluetoothService } from './services/bluetoothService';
import { analyzeDiabetesRisk } from './services/geminiService';
import { logHealthMetric, getHealthHistory } from './services/supabaseClient';
import { MetricCard } from './components/MetricCard';
import { HeartChart } from './components/HeartChart';
import { RiskGauge } from './components/RiskGauge';
import { FoodScanner } from './components/FoodScanner';
import { HealthMetrics, RiskAnalysisResult, DeviceConnectionState, UserProfile } from './types';
import { DEFAULT_METRICS, DEFAULT_PROFILE } from './constants';

export default function App() {
  // --- Navigation State ---
  const [activeTab, setActiveTab] = useState<'dashboard' | 'food' | 'trends' | 'profile'>('dashboard');

  // --- Core State ---
  const [connectionState, setConnectionState] = useState<DeviceConnectionState>({
    isConnected: false,
    deviceName: null,
    batteryLevel: null,
    error: null,
  });

  const [metrics, setMetrics] = useState<HealthMetrics>(DEFAULT_METRICS);
  const [profile, setProfile] = useState<UserProfile>(DEFAULT_PROFILE);
  const [bpmHistory, setBpmHistory] = useState<{time: string, bpm: number}[]>([]);
  
  // --- Feature States ---
  const [rrBuffer, setRrBuffer] = useState<number[]>([]); // For HRV calc
  const [postMealMode, setPostMealMode] = useState(false);
  const [postMealTimer, setPostMealTimer] = useState(0);

  // --- UI States ---
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [riskData, setRiskData] = useState<RiskAnalysisResult | null>(null);
  
  const bluetoothService = useRef<BluetoothService | null>(null);

  // Initialize Bluetooth and Listeners
  useEffect(() => {
    bluetoothService.current = new BluetoothService(
      (hr) => handleNewHeartRate(hr),
      () => setConnectionState(p => ({ ...p, isConnected: false, deviceName: null })),
      (rr) => handleRRInterval(rr),
      (glucose) => setMetrics(p => ({ ...p, glucose, lastUpdated: new Date() }))
    );

    // Initial dummy data
    const initialHistory = Array.from({ length: 20 }, (_, i) => ({
      time: new Date(Date.now() - (20 - i) * 1000).toLocaleTimeString([], { hour12: false, minute: '2-digit', second: '2-digit' }),
      bpm: 72 + (Math.random() * 2 - 1)
    }));
    setBpmHistory(initialHistory);

    // Simulation & Post Meal Timer
    const interval = setInterval(() => {
      // Post Meal Timer
      if (postMealMode) {
          setPostMealTimer(t => t + 1);
      }

      setMetrics(prev => {
        if (connectionState.isConnected) return prev;

        // Mock Data Generation
        const newHr = Math.max(60, Math.min(100, prev.heartRate + (Math.random() > 0.5 ? 1 : -1)));
        
        // Update History
        setBpmHistory(h => {
            const newPoint = {
                time: new Date().toLocaleTimeString([], { hour12: false, minute: '2-digit', second: '2-digit' }),
                bpm: newHr
            };
            const newH = [...h, newPoint];
            if (newH.length > 30) newH.shift(); 
            return newH;
        });

        return {
            ...prev,
            heartRate: newHr,
            glucose: prev.glucose + (Math.random() > 0.8 ? (Math.random() > 0.5 ? 1 : -1) : 0),
            hrv: Math.floor(40 + Math.random() * 20),
            lastUpdated: new Date()
        };
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [connectionState.isConnected, postMealMode]);

  // Handle Incoming Data
  const handleNewHeartRate = (hr: number) => {
    setMetrics(prev => ({ ...prev, heartRate: hr, lastUpdated: new Date() }));
    
    // Log RHR occasionally (simplified logic: log every 100th reading or specialized trigger)
    // For demo, we rely on the component mount fetch.
    
    setBpmHistory(prev => {
      const newPoint = {
        time: new Date().toLocaleTimeString([], { hour12: false, minute: '2-digit', second: '2-digit' }),
        bpm: hr
      };
      const newHistory = [...prev, newPoint];
      if (newHistory.length > 30) newHistory.shift(); 
      return newHistory;
    });
  };

  const handleRRInterval = (rrMs: number) => {
      setRrBuffer(prev => {
          const newBuff = [...prev, rrMs];
          if (newBuff.length > 20) newBuff.shift();
          
          // Calculate RMSSD
          if (newBuff.length > 2) {
              let sumSquares = 0;
              for(let i=1; i<newBuff.length; i++) {
                  const diff = newBuff[i] - newBuff[i-1];
                  sumSquares += diff * diff;
              }
              const rmssd = Math.sqrt(sumSquares / (newBuff.length - 1));
              setMetrics(m => ({...m, hrv: Math.round(rmssd)}));
          }
          return newBuff;
      });
  };

  const connectDevice = async () => {
    setIsConnecting(true);
    try {
      if (bluetoothService.current) {
        const name = await bluetoothService.current.connect();
        setConnectionState({ isConnected: true, deviceName: name, batteryLevel: 85, error: null });
      }
    } catch (err: any) {
        setConnectionState(p => ({ ...p, error: err.message || "Connection failed" }));
    } finally {
        setIsConnecting(false);
    }
  };

  const handleAnalyzeRisk = async () => {
    setAnalyzing(true);
    setAnalysisError(null);
    try {
      const result = await analyzeDiabetesRisk(metrics, profile.age, profile.weight, profile.waist, profile.height);
      setRiskData(result);
      // Log risk calc to supabase if needed
    } catch (e) {
      setAnalysisError("Risk analysis failed.");
    } finally {
      setAnalyzing(false);
    }
  };

  const formatTime = (seconds: number) => {
      const mins = Math.floor(seconds / 60);
      const secs = seconds % 60;
      return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const renderDashboard = () => (
      <div className="space-y-6 animate-fade-in">
        {/* Connection Alert */}
        {!connectionState.isConnected && (
            <div className="bg-blue-900/20 border border-blue-800 rounded-xl p-6 flex flex-col md:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    <div className="bg-blue-600/20 p-3 rounded-full">
                        <Bluetooth className="w-6 h-6 text-blue-400" />
                    </div>
                    <div>
                        <h3 className="text-white font-semibold">Connect Smartwatch</h3>
                        <p className="text-sm text-slate-400">Pair via Bluetooth to enable real-time tracking.</p>
                    </div>
                </div>
                <button 
                    onClick={connectDevice}
                    disabled={isConnecting}
                    className="bg-primary hover:bg-sky-600 text-white px-5 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
                >
                    {isConnecting ? <Loader2 className="w-4 h-4 animate-spin"/> : <Bluetooth className="w-4 h-4" />}
                    {isConnecting ? 'Connecting...' : 'Connect Now'}
                </button>
            </div>
        )}

        {/* Post Meal Monitor */}
        {postMealMode ? (
            <div className="bg-orange-900/20 border border-orange-700/50 rounded-xl p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <Utensils className="w-5 h-5 text-orange-400" />
                    <div>
                        <span className="text-orange-100 font-bold block">Post-Meal Monitor Active</span>
                        <span className="text-xs text-orange-300">Tracking spike response...</span>
                    </div>
                </div>
                <div className="flex items-center gap-4">
                    <span className="text-2xl font-mono text-white">{formatTime(postMealTimer)}</span>
                    <button 
                        onClick={() => { setPostMealMode(false); setPostMealTimer(0); }}
                        className="bg-red-500/20 text-red-400 px-3 py-1 rounded text-xs hover:bg-red-500/30"
                    >Stop</button>
                </div>
            </div>
        ) : (
             <button 
                onClick={() => setPostMealMode(true)}
                className="w-full bg-surface border border-slate-700 hover:border-slate-500 rounded-xl p-3 flex items-center justify-center gap-2 text-slate-300 transition-all"
             >
                <Utensils className="w-4 h-4" />
                <span>I Just Ate (Start Post-Prandial Track)</span>
             </button>
        )}

        {/* Metrics */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <MetricCard 
            title="Heart Rate" 
            value={metrics.heartRate} 
            unit="BPM" 
            icon={Heart} 
            colorClass="text-rose-500" 
          />
          <MetricCard 
            title="HRV" 
            value={metrics.hrv} 
            unit="ms" 
            icon={Activity} 
            colorClass="text-purple-500" 
            trend={metrics.hrv < 30 ? "Low (Stress)" : "Good"}
          />
          <MetricCard 
            title="Glucose (CGM)" 
            value={metrics.glucose} 
            unit="mg/dL" 
            icon={Zap} 
            colorClass="text-yellow-500" 
          />
          <MetricCard 
            title="Blood Pressure" 
            value={`${metrics.systolicBP}/${metrics.diastolicBP}`} 
            unit="mmHg" 
            icon={Activity} 
            colorClass="text-sky-500" 
          />
        </div>

        {/* Live Chart */}
        <div className="bg-surface border border-slate-700 rounded-xl p-6 shadow-lg h-[300px]">
           <h3 className="text-sm font-medium text-slate-400 mb-4 flex items-center gap-2">
               <Activity className="w-4 h-4" /> Live Rhythm
           </h3>
           <HeartChart data={bpmHistory} />
        </div>

        {/* Risk Analysis */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-gradient-to-br from-indigo-900/40 to-purple-900/40 border border-indigo-500/30 rounded-xl p-6 flex flex-col justify-center shadow-lg">
                <h2 className="text-xl font-bold text-white mb-2">Diabetes Risk AI</h2>
                <p className="text-indigo-200 text-sm mb-4">
                    Combined analysis of HRV, RHR, WHtR, and Glucose trends.
                </p>
                <button
                    onClick={handleAnalyzeRisk}
                    disabled={analyzing}
                    className="w-full py-3 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold flex items-center justify-center gap-2 transition-all shadow-lg shadow-indigo-900/50"
                >
                    {analyzing ? <RotateCcw className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
                    {analyzing ? 'Analyzing...' : 'Calculate Risk'}
                </button>
            </div>

            <div className="md:col-span-2 bg-surface border border-slate-700 rounded-xl p-6 min-h-[200px]">
                {riskData ? (
                    <div className="flex flex-col md:flex-row gap-6 animate-fade-in">
                        <div className="flex-shrink-0 flex flex-col items-center justify-center md:w-1/3 border-r border-slate-700 pr-4">
                            <RiskGauge score={riskData.score} level={riskData.riskLevel} />
                        </div>
                        <div className="flex-1">
                             <p className="text-slate-300 text-sm leading-relaxed mb-4">{riskData.summary}</p>
                             <ul className="space-y-2">
                                {riskData.recommendations.map((rec, i) => (
                                    <li key={i} className="flex gap-2 text-xs text-slate-400">
                                        <div className="min-w-[4px] h-[4px] bg-primary rounded-full mt-1.5"></div>
                                        {rec}
                                    </li>
                                ))}
                             </ul>
                        </div>
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center h-full text-slate-600">
                        <ShieldCheck className="w-12 h-12 mb-2 opacity-20" />
                        <p className="text-sm">Run analysis to view full report</p>
                    </div>
                )}
            </div>
        </div>
      </div>
  );

  const renderProfile = () => (
      <div className="max-w-xl mx-auto space-y-6 animate-fade-in">
          <div className="bg-surface border border-slate-700 rounded-xl p-6">
              <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
                  <User className="w-5 h-5 text-primary" /> Body Metrics
              </h3>
              
              <div className="space-y-4">
                  <div>
                      <label className="block text-xs text-slate-400 uppercase mb-1">Waist Circumference (cm)</label>
                      <input 
                        type="number" 
                        value={profile.waist} 
                        onChange={e => setProfile({...profile, waist: Number(e.target.value)})}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-white focus:border-primary outline-none"
                      />
                      <p className="text-xs text-slate-500 mt-1">Used for Waist-to-Height Ratio (Risk Factor)</p>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                      <div>
                          <label className="block text-xs text-slate-400 uppercase mb-1">Height (cm)</label>
                          <input 
                            type="number" 
                            value={profile.height}
                            onChange={e => setProfile({...profile, height: Number(e.target.value)})}
                            className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-white focus:border-primary outline-none"
                          />
                      </div>
                      <div>
                          <label className="block text-xs text-slate-400 uppercase mb-1">Weight (kg)</label>
                          <input 
                            type="number" 
                            value={profile.weight}
                            onChange={e => setProfile({...profile, weight: Number(e.target.value)})}
                            className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-white focus:border-primary outline-none"
                          />
                      </div>
                  </div>

                  <div>
                      <label className="block text-xs text-slate-400 uppercase mb-1">Age</label>
                      <input 
                        type="number" 
                        value={profile.age}
                        onChange={e => setProfile({...profile, age: Number(e.target.value)})}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-white focus:border-primary outline-none"
                      />
                  </div>
              </div>

              <div className="mt-6 pt-6 border-t border-slate-700">
                  <div className="flex justify-between items-center text-sm">
                      <span className="text-slate-400">Waist-to-Height Ratio:</span>
                      <span className={`font-bold ${(profile.waist / profile.height) > 0.5 ? 'text-red-400' : 'text-green-400'}`}>
                          {(profile.waist / profile.height).toFixed(2)}
                      </span>
                  </div>
                  {(profile.waist / profile.height) > 0.5 && (
                      <p className="text-xs text-red-500/80 mt-2">
                          * A ratio above 0.5 indicates increased risk of central obesity and diabetes.
                      </p>
                  )}
              </div>
          </div>
      </div>
  );

  const renderTrends = () => (
      <div className="space-y-6 animate-fade-in">
          <div className="bg-surface border border-slate-700 rounded-xl p-6">
              <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-primary" /> Resting Heart Rate (30 Days)
              </h3>
              <div className="h-64">
                   <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={[
                            // Mock data for trends demo (in real app, use Supabase 'data' state)
                            {name: '1', val: 68}, {name: '5', val: 69}, {name: '10', val: 67}, 
                            {name: '15', val: 70}, {name: '20', val: 72}, {name: '25', val: 71}, {name: '30', val: 74}
                        ]}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                            <XAxis dataKey="name" tick={{fill: '#94a3b8', fontSize: 10}} axisLine={false} tickLine={false} />
                            <Tooltip contentStyle={{backgroundColor: '#1e293b', border: '1px solid #475569'}} />
                            <Area type="monotone" dataKey="val" stroke="#0ea5e9" fill="rgba(14, 165, 233, 0.2)" />
                        </AreaChart>
                   </ResponsiveContainer>
              </div>
              <p className="text-xs text-slate-500 mt-4 text-center">
                  * An increasing trend in RHR is an early indicator of metabolic stress.
              </p>
          </div>
      </div>
  );

  return (
    <div className="min-h-screen bg-dark text-slate-200 pb-24 md:pb-10">
      
      {/* Header */}
      <header className="bg-surface border-b border-slate-700 sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Activity className="text-primary w-6 h-6" />
            <h1 className="text-xl font-bold tracking-tight text-white">GlucoGuard AI</h1>
          </div>
          <div className="flex items-center gap-4">
            <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium transition-colors ${connectionState.isConnected ? 'bg-green-500/10 text-green-400' : 'bg-slate-700 text-slate-400'}`}>
              {connectionState.isConnected ? <BluetoothConnected className="w-3 h-3" /> : <Bluetooth className="w-3 h-3" />}
              <span className="hidden sm:inline">{connectionState.isConnected ? connectionState.deviceName : 'Disconnected'}</span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-5xl mx-auto px-4 pt-6">
          {activeTab === 'dashboard' && renderDashboard()}
          {activeTab === 'food' && <FoodScanner />}
          {activeTab === 'trends' && renderTrends()}
          {activeTab === 'profile' && renderProfile()}
      </main>

      {/* Mobile/Tab Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-surface border-t border-slate-700 pb-safe z-40">
          <div className="max-w-5xl mx-auto flex justify-around p-2">
              <button onClick={() => setActiveTab('dashboard')} className={`flex flex-col items-center p-2 rounded-lg ${activeTab === 'dashboard' ? 'text-primary' : 'text-slate-500'}`}>
                  <Activity className="w-6 h-6" />
                  <span className="text-[10px] mt-1">Monitor</span>
              </button>
              <button onClick={() => setActiveTab('food')} className={`flex flex-col items-center p-2 rounded-lg ${activeTab === 'food' ? 'text-primary' : 'text-slate-500'}`}>
                  <Utensils className="w-6 h-6" />
                  <span className="text-[10px] mt-1">Food AI</span>
              </button>
              <button onClick={() => setActiveTab('trends')} className={`flex flex-col items-center p-2 rounded-lg ${activeTab === 'trends' ? 'text-primary' : 'text-slate-500'}`}>
                  <TrendingUp className="w-6 h-6" />
                  <span className="text-[10px] mt-1">Trends</span>
              </button>
              <button onClick={() => setActiveTab('profile')} className={`flex flex-col items-center p-2 rounded-lg ${activeTab === 'profile' ? 'text-primary' : 'text-slate-500'}`}>
                  <User className="w-6 h-6" />
                  <span className="text-[10px] mt-1">Risk Profile</span>
              </button>
          </div>
      </nav>
    </div>
  );
}