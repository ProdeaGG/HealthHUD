"use client";

import React, { useState } from 'react';

export default function InputMeasurements() {
  const [chest, setChest] = useState('');
  const [waist, setWaist] = useState('');
  const [biceps, setBiceps] = useState('');
  const [status, setStatus] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus('Saving...');
    try {
      const res = await fetch('/api/measurements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chest: parseFloat(chest), waist: parseFloat(waist), biceps: parseFloat(biceps) })
      });
      if (res.ok) setStatus('Saved successfully!');
      else setStatus('Error saving.');
    } catch (err) {
      setStatus('Error saving.');
    }
  };

  return (
    <div className="bg-gray-900 min-h-screen flex items-center justify-center p-4 font-sans text-white">
      <form onSubmit={handleSubmit} className="bg-gray-800 p-8 rounded-xl shadow-lg border-2 border-gray-700 w-full max-w-md">
        <h2 className="text-2xl font-bold mb-6 text-center text-[#75a3ed]">Manual Measurements</h2>
        
        <div className="mb-4">
          <label className="block text-sm font-semibold mb-2">Chest (inches)</label>
          <input type="number" step="0.1" value={chest} onChange={e => setChest(e.target.value)} required className="w-full p-2 rounded bg-gray-700 border border-gray-600 focus:border-[#75a3ed] outline-none" />
        </div>

        <div className="mb-4">
          <label className="block text-sm font-semibold mb-2">Waist at Belly Button (inches)</label>
          <input type="number" step="0.1" value={waist} onChange={e => setWaist(e.target.value)} required className="w-full p-2 rounded bg-gray-700 border border-gray-600 focus:border-[#75a3ed] outline-none" />
        </div>

        <div className="mb-6">
          <label className="block text-sm font-semibold mb-2">Biceps (inches)</label>
          <input type="number" step="0.1" value={biceps} onChange={e => setBiceps(e.target.value)} required className="w-full p-2 rounded bg-gray-700 border border-gray-600 focus:border-[#75a3ed] outline-none" />
        </div>

        <button type="submit" className="w-full bg-[#75a3ed] hover:bg-blue-600 text-white font-bold py-3 rounded uppercase tracking-wide">
          Save Measurements
        </button>

        {status && <p className="mt-4 text-center text-sm font-semibold text-green-400">{status}</p>}
      </form>
    </div>
  );
}
