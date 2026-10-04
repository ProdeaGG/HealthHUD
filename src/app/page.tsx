"use client";

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function Dashboard() {
  const router = useRouter();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  
  // Modal States
  const [showGoalModal, setShowGoalModal] = useState(false);
  const [showGlobalSettingsModal, setShowGlobalSettingsModal] = useState(false);
  const [showManualWeightModal, setShowManualWeightModal] = useState(false);
  const [showMeasurementModal, setShowMeasurementModal] = useState(false);
  
  // State
  const [settings, setSettings] = useState<any>({});
  const [manualWeightForm, setManualWeightForm] = useState({ date: new Date().toISOString().split('T')[0], weight: '' });
  const [measurementForm, setMeasurementForm] = useState({
    date: new Date().toISOString().split('T')[0],
    chest: '',
    waist: '',
    biceps: ''
  });
  const [goalForm, setGoalForm] = useState({ chest: '', waist: '', biceps: '', strength: '' });

  useEffect(() => {
    async function loadData() {
      try {
        // Check setup status first
        const setupRes = await fetch('/api/setup');
        const setupData = await setupRes.json();
        setSettings(setupData);
        
        if (!setupData.setupComplete) {
          router.push('/setup');
          return;
        }

        // Fetch dashboard data
        const res = await fetch('/api/dashboard');
        const json = await res.json();
        setData(json);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    loadData();
    
    // Refresh data every 60 seconds
    const interval = setInterval(loadData, 60000);
    return () => clearInterval(interval);
  }, [router]);

  if (loading) {
    return <div className="bg-gray-900 min-h-screen flex items-center justify-center text-white text-2xl">Loading HealthHUD...</div>;
  }

  if (!data) {
    return <div className="bg-gray-900 min-h-screen flex items-center justify-center text-white text-2xl">Error loading data.</div>;
  }

  const handleOpenGoalModal = () => {
      setGoalForm({
          chest: data.measurements.find((m: any) => m.name === 'Chest')?.goal || '',
          waist: data.measurements.find((m: any) => m.name.includes('Waist'))?.goal || '',
          biceps: data.measurements.find((m: any) => m.name === 'Biceps')?.goal || '',
          strength: data.consistency.strengthTarget || ''
      });
      setShowGoalModal(true);
  };

  const handleSaveGoals = async () => {
      await fetch('/api/setup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
              goals: {
                  Chest: parseFloat(goalForm.chest),
                  Waist: parseFloat(goalForm.waist),
                  Biceps: parseFloat(goalForm.biceps),
                  StrengthSessions: parseInt(goalForm.strength)
              }
          })
      });
      setShowGoalModal(false);
      window.location.reload();
  };

  const handleSaveManualWeight = async () => {
      await fetch('/api/weight', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
              date: manualWeightForm.date,
              weightLbs: manualWeightForm.weight
          })
      });
      setShowManualWeightModal(false);
      window.location.reload();
  };

  const handleOpenMeasurementModal = () => {
      setMeasurementForm({
          date: new Date().toISOString().split('T')[0],
          chest: data?.measurements?.find((m: any) => m.name === 'Chest')?.current || '',
          waist: data?.measurements?.find((m: any) => m.name.includes('Waist'))?.current || '',
          biceps: data?.measurements?.find((m: any) => m.name === 'Biceps')?.current || ''
      });
      setShowMeasurementModal(true);
  };

  const handleSaveMeasurement = async () => {
      await fetch('/api/measurements', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(measurementForm)
      });
      setShowMeasurementModal(false);
      window.location.reload();
  };

  return (
    <div className="bg-gray-900 min-h-screen flex flex-col items-center justify-center p-4 md:p-8 font-sans text-white">
      {/* Global Settings Button */}
      <button 
          onClick={() => setShowGlobalSettingsModal(true)}
          className="absolute top-4 right-4 z-50 text-gray-500 hover:text-white transition-colors"
          title="Global Settings"
      >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 010 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 010-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.327.123.723.062 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28Z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0Z" />
          </svg>
      </button>
      {/* Dashboard Container */}
      <div className="w-full max-w-7xl flex flex-col lg:grid lg:grid-cols-2 lg:grid-rows-2 gap-4 lg:gap-0 border-8 border-gray-700 bg-gray-500 relative shadow-2xl lg:h-[calc(100vh-6rem)] lg:min-h-[700px] overflow-hidden">
        
        {/* Center Divider Lines (Desktop Only) */}
        <div className="hidden lg:flex absolute inset-0 pointer-events-none items-center justify-center z-50">
            <div className="w-full h-2 bg-gray-700"></div>
            <div className="h-full w-2 bg-gray-700 absolute"></div>
        </div>

        {/* Top Left: Vitals (Orange) */}
        <div className="border-4 lg:border-0 border-[#333] flex flex-col justify-between p-4 lg:p-6" style={{ backgroundColor: '#ef9c3f', textShadow: '1px 1px 2px rgba(0,0,0,0.2)' }}>
            <div className="text-center mt-2 lg:mt-4">
                <h2 className="text-2xl lg:text-3xl mb-1 lg:mb-2 font-semibold">Vitals</h2>
                <h1 className="text-6xl lg:text-7xl xl:text-8xl font-bold mb-1 lg:mb-2 uppercase leading-none">{data.vitals.weightLbs} lbs</h1>
                <div className="flex items-center justify-center space-x-3 mt-2">
                    <p className="text-sm lg:text-base font-medium opacity-90 uppercase tracking-widest text-orange-200">
                        7-Day Rolling Avg: {data.vitals.weightSevenDayAvg || data.vitals.weightLbs} lbs
                    </p>
                    {data.vitals.weightTrend ? (
                        <div className={`px-2 py-0.5 rounded text-xs font-bold tracking-widest bg-black/40 ${
                            parseFloat(data.vitals.weightTrend) < 0 ? 'text-green-400' : 
                            parseFloat(data.vitals.weightTrend) > 0 ? 'text-red-400' : 'text-gray-400'
                        }`}>
                            {parseFloat(data.vitals.weightTrend) < 0 ? '↓' : parseFloat(data.vitals.weightTrend) > 0 ? '↑' : '-'} {Math.abs(parseFloat(data.vitals.weightTrend)).toFixed(1)} LBS
                        </div>
                    ) : (
                        <div className="px-2 py-0.5 rounded text-[10px] lg:text-xs font-bold tracking-widest bg-black/30 text-white/70 italic">
                            WEIGH DAILY TO UNLOCK TREND
                        </div>
                    )}
                </div>
            </div>
            
            <div className="flex justify-center mt-2">
                {settings?.allowManualWeight !== false && (
                    <button 
                        onClick={() => setShowManualWeightModal(true)}
                        className="text-xs font-bold uppercase tracking-wider text-white/70 hover:text-white hover:bg-black/20 px-3 py-1 rounded transition-colors"
                    >
                        + Manual Weight Entry
                    </button>
                )}
            </div>
            
            <div className="flex justify-between items-center mt-4 lg:mt-6 px-2 lg:px-4 text-base lg:text-lg font-semibold relative">
                <div className="text-left">
                    <p className="mb-0 lg:mb-1 uppercase text-xs lg:text-sm tracking-wide text-orange-200">This Week Steps</p>
                    <p className="text-2xl lg:text-3xl">{data.vitals.steps.thisWeekDailyAvg} / day</p>
                </div>
                
                {/* Centered Step Count Pill */}
                <div className="bg-black/50 text-white px-3 py-1 rounded-full text-[10px] lg:text-xs uppercase tracking-widest hidden sm:block mx-4 shadow-sm">
                    Step Count
                </div>

                <div className="text-right">
                    <p className="mb-0 lg:mb-1 text-red-200 text-sm lg:text-base">{data.vitals.steps.difference > 0 ? '+' : ''}{data.vitals.steps.difference} vs Last Wk</p>
                    <p className="uppercase text-xs lg:text-sm tracking-wide text-orange-200">Last Week Steps</p>
                    <p>{data.vitals.steps.lastWeekDailyAvg} / day</p>
                </div>
            </div>
        </div>

        {/* Top Right: Consistency Tracker (Pink) */}
        <div className="border-4 lg:border-0 lg:border-l-4 border-[#333] flex flex-col justify-between p-4 lg:p-6" style={{ backgroundColor: '#d99596', textShadow: '1px 1px 2px rgba(0,0,0,0.2)' }}>
            <div className="text-center mt-2 lg:mt-4">
                <h2 className="text-2xl lg:text-3xl mb-2 lg:mb-4 font-semibold">Consistency Tracker</h2>
                <p className="text-lg lg:text-xl xl:text-2xl uppercase tracking-wide mb-2 lg:mb-4">Strength: {data.consistency.strengthSessions} / {data.consistency.strengthTarget} Sessions</p>
                <p className="text-lg lg:text-xl xl:text-2xl uppercase font-bold tracking-wide mb-4 lg:mb-6">Wkly Daily Burn: {Math.round(data.consistency.dailyBurnAvg)} Kcals</p>
            </div>
            
            <div className="w-full px-2 lg:px-6 mb-2 lg:mb-4">
                <div className="flex justify-between items-end space-x-1 lg:space-x-2">
                    {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((day, idx) => (
                        <div key={idx} className="flex flex-col items-center flex-1">
                            <div className={`w-full h-2 rounded-sm mb-1 lg:mb-2 shadow-sm shadow-black/30 transition-colors ${data.consistency.strengthDays[idx] ? 'bg-green-400' : 'bg-red-500'}`}></div>
                            <span className="text-xs lg:text-sm font-bold opacity-90 drop-shadow-md">{day}</span>
                        </div>
                    ))}
                </div>
            </div>

            <div className="flex justify-between text-center pb-0 lg:pb-2 px-1 lg:px-2">
                <div className="flex-1">
                    <p className="text-[10px] lg:text-xs mb-1 opacity-90">Cardio Sessions</p>
                    <p className="text-3xl lg:text-4xl font-bold leading-none">{data.consistency.cardioSessions}</p>
                </div>
                <div className="flex-1 border-x border-[#333]/30">
                    <p className="text-[10px] lg:text-xs mb-1 opacity-90">Cardio Minutes</p>
                    <p className="text-3xl lg:text-4xl font-bold leading-none">{data.consistency.cardioMinutes}</p>
                </div>
                <div className="flex-1">
                    <p className="text-[10px] lg:text-xs mb-1 opacity-90">Cardio Avg HR</p>
                    <p className="text-3xl lg:text-4xl font-bold leading-none">{data.consistency.heartRateAvg ? `${Math.round(data.consistency.heartRateAvg)}` : '-'}</p>
                </div>
            </div>
        </div>

        {/* Bottom Left: Recovery HUD (Green) */}
        <div className="border-4 lg:border-0 lg:border-t-4 border-[#333] flex flex-col justify-between p-3 lg:p-5 pb-2 lg:pb-3" style={{ backgroundColor: '#7a9e64', textShadow: '1px 1px 2px rgba(0,0,0,0.2)' }}>
            <div className="text-center pt-0 lg:pt-1">
                <h2 className="text-xl lg:text-2xl mb-1 font-semibold">Recovery HUD (sleep data)</h2>
                <h3 className="uppercase text-green-200 tracking-wide text-[10px] lg:text-xs mb-0 lg:mb-1">Last Night</h3>
                <h1 className="text-5xl lg:text-6xl font-bold mb-1 leading-none">{data.recovery.sleepHours} HRS</h1>
                <p className="text-sm lg:text-base mb-0">7D AVG: {data.recovery.sevenDayAvg} HRS</p>
            </div>
            
            {/* Bar Chart Area */}
            <div className="mt-auto pt-1 lg:pt-2 relative">
                {/* The Chart bounds */}
                <div className="relative h-16 lg:h-24 px-1 lg:px-2 border-b-2 border-white/40 flex justify-between items-end space-x-1 lg:space-x-2">
                    {/* 7D Average Line */}
                    <div className="absolute left-0 w-full border-t-2 border-dashed border-white/50 z-20 flex items-center" style={{ bottom: `${Math.min((data.recovery.sevenDayAvg / 10) * 100, 100)}%` }}>
                        <span className="text-[10px] text-white/70 bg-[#7a9e64] px-1 -translate-y-1/2 ml-1">AVG</span>
                    </div>

                    {data.recovery.sleepData.length > 0 ? data.recovery.sleepData.map((d: any, i: number) => (
                        <div key={i} className="flex flex-col items-center flex-1 h-full justify-end z-10 relative">
                            <div className="w-full bg-black transition-all rounded-t-sm flex items-end justify-center pb-1" style={{ height: `${Math.min((d.hours / 10) * 100, 100)}%` }}>
                                <span className="text-white text-[10px] lg:text-[11px] font-normal opacity-90">{d.hours > 0 ? d.hours : ''}</span>
                            </div>
                        </div>
                    )) : (
                        <div className="w-full text-center text-xs lg:text-sm opacity-50 pb-4">No sleep data yet. Send data to Apple Health Webhook.</div>
                    )}
                </div>

                {/* Days below the line */}
                <div className="flex justify-between items-end space-x-1 lg:space-x-2 px-1 lg:px-2 mt-1">
                    {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((day, idx) => (
                        <div key={idx} className="flex flex-col items-center flex-1">
                            <span className="text-[10px] lg:text-xs font-bold opacity-80">{day}</span>
                        </div>
                    ))}
                </div>
            </div>
        </div>

        {/* Bottom Right: Manual Measurements (Blue) */}
        <div className="border-4 lg:border-0 lg:border-t-4 lg:border-l-4 border-[#333] flex flex-col justify-between p-3 lg:p-6" style={{ backgroundColor: '#75a3ed', textShadow: '1px 1px 2px rgba(0,0,0,0.2)' }}>
            <div className="text-center pt-2 relative">
                <h2 className="text-lg lg:text-2xl mb-2 lg:mb-4 font-semibold">Thicc Boy Measurements</h2>
                {/* Actions: Log Measurement (+) & Adjust Goals (⚙️) */}
                <div className="absolute top-0 right-0 lg:right-2 flex items-center space-x-2">
                    <button 
                        onClick={handleOpenMeasurementModal} 
                        className="text-xl lg:text-2xl font-black bg-blue-700/50 hover:bg-blue-700 text-white rounded-md w-7 h-7 flex items-center justify-center opacity-85 hover:opacity-100 transition-all leading-none shadow-sm" 
                        title="Log New Measurement"
                    >
                        +
                    </button>
                    <button 
                        onClick={handleOpenGoalModal} 
                        className="text-xl lg:text-2xl opacity-75 hover:opacity-100 transition-opacity" 
                        title="Adjust Goals"
                    >
                        ⚙️
                    </button>
                </div>
            </div>
            
            <div className="w-full px-1 lg:px-6 mt-1 lg:mt-2">
                {/* Table Headers */}
                <div className="grid grid-cols-4 gap-1 lg:gap-2 mb-1 lg:mb-2 text-center text-[10px] lg:text-sm font-bold uppercase tracking-wider text-blue-100">
                    <div></div>
                    <div>Current</div>
                    <div>Goal</div>
                    <div>to Goal</div>
                </div>
                
                {data.measurements.map((row: any, i: number) => {
                    const percentToGoal = row.goal > 0 ? Math.min((row.goal / row.current) * 100, 100) : 0; 
                    return (
                        <div key={i} className="mb-2 lg:mb-3 bg-blue-400 border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,0.3)]">
                            <div className="grid grid-cols-4 gap-0 text-black">
                                <div className="p-1 lg:p-2 border-r-2 border-black font-bold text-white text-xs lg:text-lg flex items-center justify-center bg-[#75a3ed]">{row.name}</div>
                                <div className="p-1 lg:p-2 border-r-2 border-black text-center font-bold text-white bg-[#75a3ed] flex items-center justify-center text-xs lg:text-lg">{row.current || '-'}</div>
                                <div className="p-1 lg:p-2 border-r-2 border-black text-center font-bold text-white bg-[#75a3ed] flex items-center justify-center text-xs lg:text-lg">{row.goal || '-'}</div>
                                <div className="p-1 lg:p-2 text-center font-bold text-white bg-[#75a3ed] flex items-center justify-center text-xs lg:text-lg">{row.diff}</div>
                            </div>
                            {/* Distinct Progress Bar underneath stats */}
                            <div className="w-full h-1 lg:h-2 bg-blue-900 border-t-2 border-black flex">
                                <div className="h-full bg-green-400 transition-all duration-500 border-r-2 border-black" style={{ width: `${percentToGoal}%` }}></div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>

      </div>
      
      {/* Last Synced Indicators */}
      <div className="w-full max-w-7xl mt-4 lg:mt-6 flex flex-col lg:flex-row justify-between text-xs text-gray-500 font-medium tracking-wide space-y-2 lg:space-y-0 text-center lg:text-left">
          <div>Apple Health: <span className="text-gray-400">{data.lastSynced?.appleHealth ? new Date(data.lastSynced.appleHealth).toLocaleString() : 'Never'}</span>
              {data.lastSynced?.appleHealthStatus && (
                  <span className={`block text-[10px] mt-1 ${data.lastSynced.appleHealthStatus.startsWith('OK') ? 'text-green-500' : 'text-red-400'}`}>{data.lastSynced.appleHealthStatus}</span>
              )}
          </div>
          <div>Withings: <span className="text-gray-400">{data.lastSynced?.withings ? new Date(data.lastSynced.withings).toLocaleString() : 'Never'}</span></div>
      </div>

      {/* Global Settings Modal */}
      {showGlobalSettingsModal && (
          <div className="fixed inset-0 bg-black/80 z-[100] flex items-center justify-center p-4">
              <div className="bg-gray-800 text-white rounded-lg shadow-2xl border-2 border-gray-600 p-6 lg:p-8 max-w-3xl w-full max-h-[90vh] overflow-y-auto">
                  <div className="flex justify-between items-center mb-6">
                      <h2 className="text-2xl font-bold">Global Configuration</h2>
                      <button onClick={() => setShowGlobalSettingsModal(false)} className="text-gray-400 hover:text-white text-3xl leading-none">&times;</button>
                  </div>
                  
                  <div className="space-y-8">
                      {/* Section 1: Apple Health Setup */}
                      <div className="bg-gray-900 p-4 rounded border border-gray-700 shadow-inner">
                          <h3 className="text-xl font-semibold mb-2 text-blue-300">Apple Health (Auto Export)</h3>
                          <p className="text-sm text-gray-400 mb-4">
                              To sync steps, calories, sleep, and workouts, download the iOS app <strong>Health Auto Export</strong>.
                          </p>
                          <div className="text-sm bg-black/50 p-4 rounded font-mono break-all border border-black shadow">
                              <span className="text-gray-500">// Webhook URL</span><br/>
                              <span className="text-green-400">{typeof window !== 'undefined' ? window.location.origin : 'http://<YOUR_IP>:3000'}/api/ingest/apple-health</span><br/><br/>
                              <span className="text-gray-500">// Format Configuration</span><br/>
                              <span>Export Format: JSON</span><br/>
                              <span>Period: Daily</span><br/><br/>
                              <span className="text-gray-500">// Metrics to Toggle</span><br/>
                              <span>Step Count, Active Energy, Sleep Analysis, Resting Heart Rate, Workouts</span>
                          </div>
                      </div>

                      {/* Section 2: Withings Auth */}
                      <div className="bg-gray-900 p-4 rounded border border-gray-700 shadow-inner">
                          <h3 className="text-xl font-semibold mb-2 text-green-300">Withings Weight Sync</h3>
                          <p className="text-sm text-gray-400 mb-4">
                              Withings OAuth2 handles automatic daily weight pulls. Re-authenticate only if syncing completely breaks.
                          </p>
                          <div className="text-sm bg-black/50 p-4 rounded font-mono break-all border border-black shadow mb-4">
                              <span className="text-gray-500">// Required Withings Callback URI</span><br/>
                              <span className="text-yellow-400">{typeof window !== 'undefined' ? window.location.origin : 'http://<YOUR_IP>:3000'}/api/setup/withings-callback</span>
                          </div>
                          <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-4">
                              <button onClick={() => { if(confirm("Are you sure you want to re-authenticate Withings? This will wipe your current tokens.")) router.push('/setup?step=2') }} className="bg-red-600/80 hover:bg-red-600 font-bold text-white px-4 py-2 rounded text-sm transition-colors border border-red-800">
                                  Re-Authenticate Withings
                              </button>
                              <a href="https://developer.withings.com" target="_blank" rel="noreferrer" className="text-sm flex items-center underline text-blue-400 hover:text-blue-300">
                                  Open Withings Dev Portal &rarr;
                              </a>
                          </div>
                      </div>

                      {/* Section 2.5: Feature Toggles */}
                      <div className="bg-gray-900 p-4 rounded border border-gray-700 shadow-inner">
                          <h3 className="text-xl font-semibold mb-2 text-orange-300">Feature Toggles</h3>
                          <label className="flex items-center space-x-3 cursor-pointer">
                              <input 
                                  type="checkbox" 
                                  className="w-5 h-5 text-orange-500 rounded focus:ring-orange-500 border-gray-600 bg-gray-700"
                                  checked={settings?.allowManualWeight !== false}
                                  onChange={async (e) => {
                                      const newVal = e.target.checked;
                                      setSettings({ ...settings, allowManualWeight: newVal });
                                      await fetch('/api/setup', {
                                          method: 'POST',
                                          headers: { 'Content-Type': 'application/json' },
                                          body: JSON.stringify({ allowManualWeight: newVal })
                                      });
                                  }}
                              />
                              <span className="text-gray-300 text-sm font-medium">Enable Manual Weight Entry Button on Dashboard</span>
                          </label>
                      </div>

                      {/* Section 3: V2 Features Placeholder */}
                      <div className="bg-gray-900 p-4 rounded border border-gray-700 opacity-60 shadow-inner">
                          <h3 className="text-xl font-semibold mb-2 text-pink-300">V2 Dashboard Themes</h3>
                          <p className="text-sm text-gray-400 mb-2">Toggle between different visual styles. (Coming in V2)</p>
                          <select disabled className="w-full bg-black/50 border border-gray-600 p-3 rounded text-sm outline-none cursor-not-allowed">
                              <option>Default (Clinical Grid)</option>
                              <option>Shonen Anime (RPG Status)</option>
                              <option>Cybernetic Command Center</option>
                          </select>
                      </div>
                  </div>
              </div>
          </div>
      )}

      {/* Goals Modal */}
      {showGoalModal && (
          <div className="fixed inset-0 bg-black/80 z-[100] flex items-center justify-center p-4">
              <div className="bg-blue-900 text-white rounded-lg shadow-[0_0_40px_rgba(59,130,246,0.3)] border-2 border-blue-400 p-6 lg:p-8 max-w-md w-full">
                  <div className="flex justify-between items-center mb-6">
                      <h2 className="text-2xl font-bold">Update Goals</h2>
                      <button onClick={() => setShowGoalModal(false)} className="text-blue-200 hover:text-white text-3xl leading-none">&times;</button>
                  </div>
                  <div className="space-y-5">
                      <div>
                          <label className="block text-sm font-semibold mb-2">Chest Goal (in)</label>
                          <input type="number" value={goalForm.chest} onChange={e => setGoalForm({...goalForm, chest: e.target.value})} className="w-full bg-black/40 border border-blue-500 rounded p-3 text-white outline-none focus:border-blue-300" />
                      </div>
                      <div>
                          <label className="block text-sm font-semibold mb-2">Waist Goal (in)</label>
                          <input type="number" value={goalForm.waist} onChange={e => setGoalForm({...goalForm, waist: e.target.value})} className="w-full bg-black/40 border border-blue-500 rounded p-3 text-white outline-none focus:border-blue-300" />
                      </div>
                      <div>
                          <label className="block text-sm font-semibold mb-2">Biceps Goal (in)</label>
                          <input type="number" value={goalForm.biceps} onChange={e => setGoalForm({...goalForm, biceps: e.target.value})} className="w-full bg-black/40 border border-blue-500 rounded p-3 text-white outline-none focus:border-blue-300" />
                      </div>
                      <div>
                          <label className="block text-sm font-semibold mb-2">Weekly Strength Sessions Goal</label>
                          <input type="number" value={goalForm.strength} onChange={e => setGoalForm({...goalForm, strength: e.target.value})} className="w-full bg-black/40 border border-blue-500 rounded p-3 text-white outline-none focus:border-blue-300" />
                      </div>
                      <button onClick={handleSaveGoals} className="w-full bg-blue-500 hover:bg-blue-400 text-white font-bold py-4 rounded mt-4 transition-colors shadow-lg shadow-blue-500/20">
                          Save & Update
                      </button>
                  </div>
              </div>
          </div>
      )}

      {/* Manual Weight Modal */}
      {showManualWeightModal && (
          <div className="fixed inset-0 bg-black/80 z-[100] flex items-center justify-center p-4">
              <div className="bg-orange-900 text-white rounded-lg shadow-[0_0_40px_rgba(239,156,63,0.3)] border-2 border-orange-400 p-6 lg:p-8 max-w-md w-full">
                  <div className="flex justify-between items-center mb-6">
                      <h2 className="text-2xl font-bold text-orange-200">Manual Weight Entry</h2>
                      <button onClick={() => setShowManualWeightModal(false)} className="text-orange-200 hover:text-white text-3xl leading-none">&times;</button>
                  </div>
                  <div className="space-y-5">
                      <div>
                          <label className="block text-sm font-semibold mb-2">Date</label>
                          <input type="date" value={manualWeightForm.date} onChange={e => setManualWeightForm({...manualWeightForm, date: e.target.value})} className="w-full bg-black/40 border border-orange-500 rounded p-3 text-white outline-none focus:border-orange-300" />
                      </div>
                      <div>
                          <label className="block text-sm font-semibold mb-2">Weight (lbs)</label>
                          <input type="number" step="0.1" value={manualWeightForm.weight} onChange={e => setManualWeightForm({...manualWeightForm, weight: e.target.value})} className="w-full bg-black/40 border border-orange-500 rounded p-3 text-white outline-none focus:border-orange-300" placeholder="e.g. 185.2" />
                      </div>
                      <button onClick={handleSaveManualWeight} className="w-full bg-orange-500 hover:bg-orange-400 text-white font-bold py-4 rounded mt-4 transition-colors shadow-lg shadow-orange-500/20">
                          Save Weight Entry
                      </button>
                  </div>
              </div>
          </div>
      )}

      {/* Measurement Entry Modal */}
      {showMeasurementModal && (
          <div className="fixed inset-0 bg-black/80 z-[100] flex items-center justify-center p-4">
              <div className="bg-blue-950 text-white rounded-lg shadow-[0_0_40px_rgba(59,130,246,0.3)] border-2 border-blue-400 p-6 lg:p-8 max-w-md w-full">
                  <div className="flex justify-between items-center mb-6">
                      <div>
                          <h2 className="text-2xl font-bold text-blue-200">Log Measurements</h2>
                          <p className="text-xs text-blue-300/70 mt-1">Record your latest body tape measurements</p>
                      </div>
                      <button onClick={() => setShowMeasurementModal(false)} className="text-blue-200 hover:text-white text-3xl leading-none">&times;</button>
                  </div>
                  <div className="space-y-4">
                      <div>
                          <label className="block text-sm font-semibold mb-1">Date</label>
                          <input type="date" value={measurementForm.date} onChange={e => setMeasurementForm({...measurementForm, date: e.target.value})} className="w-full bg-black/40 border border-blue-500 rounded p-3 text-white outline-none focus:border-blue-300" />
                      </div>
                      <div>
                          <label className="block text-sm font-semibold mb-1">Chest (inches)</label>
                          <input type="number" step="0.1" value={measurementForm.chest} onChange={e => setMeasurementForm({...measurementForm, chest: e.target.value})} className="w-full bg-black/40 border border-blue-500 rounded p-3 text-white outline-none focus:border-blue-300" placeholder="e.g. 44.5" />
                      </div>
                      <div>
                          <label className="block text-sm font-semibold mb-1">Waist - Belly Button (inches)</label>
                          <input type="number" step="0.1" value={measurementForm.waist} onChange={e => setMeasurementForm({...measurementForm, waist: e.target.value})} className="w-full bg-black/40 border border-blue-500 rounded p-3 text-white outline-none focus:border-blue-300" placeholder="e.g. 34.0" />
                      </div>
                      <div>
                          <label className="block text-sm font-semibold mb-1">Biceps (inches)</label>
                          <input type="number" step="0.1" value={measurementForm.biceps} onChange={e => setMeasurementForm({...measurementForm, biceps: e.target.value})} className="w-full bg-black/40 border border-blue-500 rounded p-3 text-white outline-none focus:border-blue-300" placeholder="e.g. 16.0" />
                      </div>
                      <button onClick={handleSaveMeasurement} className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-4 rounded mt-4 transition-colors shadow-lg shadow-blue-500/20">
                          Save Measurements
                      </button>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
}
