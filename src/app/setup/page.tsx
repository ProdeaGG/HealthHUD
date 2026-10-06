"use client";

import React, { useState } from 'react';

export default function SetupWizard() {
  const [step, setStep] = useState(1);
  const [clientId, setClientId] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [status, setStatus] = useState('');

  // Set browser title & check URL for step override
  React.useEffect(() => {
    document.title = "Setup HealthHUD";
    const params = new URLSearchParams(window.location.search);
    const s = params.get('step');
    if (s) setStep(parseInt(s, 10));
  }, []);

  const [chestGoal, setChestGoal] = useState('');
  const [waistGoal, setWaistGoal] = useState('');
  const [bicepsGoal, setBicepsGoal] = useState('');

  const handleSaveWithings = async () => {
    setStatus('Connecting to Withings...');
    try {
      const callbackUrl = `${window.location.origin}/api/setup/withings-callback`;
      const res = await fetch('/api/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ withingsClientId: clientId, withingsClientSecret: clientSecret, withingsRedirectUri: callbackUrl })
      });
      if (res.ok) {
        // Redirect to Withings for OAuth
        const redirectUri = encodeURIComponent(callbackUrl);
        const scope = encodeURIComponent('user.metrics');
        const state = encodeURIComponent('step3'); // so we know where to return
        const authUrl = `https://account.withings.com/oauth2_user/authorize2?response_type=code&client_id=${clientId}&state=${state}&scope=${scope}&redirect_uri=${redirectUri}`;
        window.location.href = authUrl;
      } else {
        const errorData = await res.json();
        setStatus(`Error saving credentials: ${errorData.error}`);
      }
    } catch (e: any) {
      setStatus(`Error saving credentials: ${e.message}`);
    }
  };

  const handleSaveGoals = async () => {
    setStatus('Saving goals...');
    try {
      const res = await fetch('/api/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ goals: { Chest: parseFloat(chestGoal), Waist: parseFloat(waistGoal), Biceps: parseFloat(bicepsGoal) } })
      });
      if (res.ok) {
        setStatus('');
        setStep(4);
      } else {
        const errorData = await res.json();
        setStatus(`Error saving goals: ${errorData.error}`);
      }
    } catch (e: any) {
      setStatus(`Error saving goals: ${e.message}`);
    }
  };

  const handleCompleteSetup = async () => {
    setStatus('Finalizing setup...');
    try {
      const res = await fetch('/api/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ setupComplete: true })
      });
      if (res.ok) {
        window.location.href = '/';
      } else {
        const errorData = await res.json();
        setStatus(`Error finalizing setup: ${errorData.error}`);
      }
    } catch (e: any) {
      setStatus(`Error finalizing: ${e.message}`);
    }
  };

  return (
    <div className="bg-gray-900 min-h-screen flex items-center justify-center p-4 font-sans text-white">
      <div className="bg-gray-800 p-8 rounded-xl shadow-lg border-2 border-gray-700 w-full max-w-2xl">
        
        {/* Step 1: Welcome */}
        {step === 1 && (
          <div className="animate-fade-in">
            <h2 className="text-3xl font-bold mb-4 text-[#75a3ed]">Welcome to HealthHUD!</h2>
            <p className="text-lg text-gray-300 mb-6">
              Your database has been automatically configured and migrated. We just need to link your data sources to get your dashboard live.
            </p>
            <button onClick={() => setStep(2)} className="w-full bg-[#75a3ed] hover:bg-blue-600 text-white font-bold py-3 rounded uppercase tracking-wide">
              Let&apos;s Go
            </button>
          </div>
        )}

        {/* Step 2: Withings */}
        {step === 2 && (
          <div className="animate-fade-in">
            <h2 className="text-2xl font-bold mb-4 text-[#ef9c3f]">Step 1: Withings Connection</h2>
            
            <details className="mb-6 bg-gray-700/50 p-4 rounded-lg cursor-pointer">
              <summary className="text-sm font-bold text-[#ef9c3f] select-none">How do I find my Client ID and Secret?</summary>
              <div className="mt-3 text-sm text-gray-300 space-y-2 leading-relaxed cursor-auto">
                <p>1. Go to the <a href="https://developer.withings.com/" target="_blank" rel="noreferrer" className="text-blue-400 underline">Withings Developer Portal</a> and log in.</p>
                <p>2. Create a new "Partner App" (you can name it HealthHUD).</p>
                <p>3. Set the <strong>Callback URI</strong> to exactly: <code className="bg-black px-1 rounded text-orange-300">{typeof window !== 'undefined' ? window.location.origin : 'http://<YOUR_IP>:3000'}/api/setup/withings-callback</code></p>
                <p>4. Once created, Withings will give you a <strong>Client ID</strong> and a <strong>Consumer Secret</strong>. Paste them below!</p>
              </div>
            </details>
            
            <div className="mb-4">
              <label className="block text-sm font-semibold mb-2">Client ID</label>
              <input type="text" value={clientId} onChange={e => setClientId(e.target.value)} className="w-full p-2 rounded bg-gray-700 border border-gray-600 focus:border-[#ef9c3f] outline-none" />
            </div>

            <div className="mb-6">
              <label className="block text-sm font-semibold mb-2">Client Secret</label>
              <input type="text" value={clientSecret} onChange={e => setClientSecret(e.target.value)} className="w-full p-2 rounded bg-gray-700 border border-gray-600 focus:border-[#ef9c3f] outline-none" />
            </div>

            <button onClick={handleSaveWithings} className="w-full bg-[#ef9c3f] hover:bg-orange-500 text-white font-bold py-3 rounded uppercase tracking-wide">
              Connect to Withings
            </button>
            <button onClick={() => setStep(3)} className="w-full mt-2 bg-gray-700 hover:bg-gray-600 text-gray-300 font-bold py-3 rounded uppercase tracking-wide text-sm">
              Skip for Now
            </button>
            {status && <p className="mt-4 text-center text-sm font-semibold text-red-400 break-words">{status}</p>}
          </div>
        )}

        {/* Step 3: Thicc Boy Goals */}
        {step === 3 && (
          <div className="animate-fade-in">
            <h2 className="text-2xl font-bold mb-4 text-[#75a3ed]">Step 2: Thicc Boy Goals</h2>
            <p className="text-sm text-gray-400 mb-4">
              Set your target body measurements. You can always change these later via the dashboard.
            </p>
            
            <div className="mb-4">
              <label className="block text-sm font-semibold mb-2">Chest Goal (inches)</label>
              <input type="number" step="0.1" value={chestGoal} onChange={e => setChestGoal(e.target.value)} className="w-full p-2 rounded bg-gray-700 border border-gray-600 focus:border-[#75a3ed] outline-none" />
            </div>

            <div className="mb-4">
              <label className="block text-sm font-semibold mb-2">Waist (at belly button) Goal (inches)</label>
              <input type="number" step="0.1" value={waistGoal} onChange={e => setWaistGoal(e.target.value)} className="w-full p-2 rounded bg-gray-700 border border-gray-600 focus:border-[#75a3ed] outline-none" />
            </div>

            <div className="mb-6">
              <label className="block text-sm font-semibold mb-2">Biceps Goal (inches)</label>
              <input type="number" step="0.1" value={bicepsGoal} onChange={e => setBicepsGoal(e.target.value)} className="w-full p-2 rounded bg-gray-700 border border-gray-600 focus:border-[#75a3ed] outline-none" />
            </div>

            <button onClick={handleSaveGoals} className="w-full bg-[#75a3ed] hover:bg-blue-600 text-white font-bold py-3 rounded uppercase tracking-wide">
              Save Goals
            </button>
            {status && <p className="mt-4 text-center text-sm font-semibold text-red-400">{status}</p>}
          </div>
        )}

        {/* Step 4: Apple Health */}
        {step === 4 && (
          <div className="animate-fade-in">
            <h2 className="text-2xl font-bold mb-4 text-[#7a9e64]">Step 3: Apple Health Hook</h2>
            <p className="text-sm text-gray-300 mb-4">
              Open the <strong>Health Auto Export</strong> app on your iPhone. Create a new Automation and set the destination URL to:
            </p>
            
            <div className="bg-black p-4 rounded-lg font-mono text-sm text-green-400 mb-6 text-center select-all">
              http://{"<your-home-server-ip>"}:3000/api/ingest/apple-health
            </div>

            <p className="text-sm text-gray-400 mb-6">
              Set it to export JSON format, and select the metrics you want to track (Steps, Active Energy, Sleep Analysis, etc). 
            </p>

            <button onClick={handleCompleteSetup} className="w-full bg-[#7a9e64] hover:bg-green-600 text-white font-bold py-3 rounded uppercase tracking-wide">
              Complete Setup & Launch
            </button>
            {status && <p className="mt-4 text-center text-sm font-semibold text-red-400">{status}</p>}
          </div>
        )}

      </div>
    </div>
  );
}
