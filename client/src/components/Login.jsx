import React, { useState } from 'react';
import { API_BASE_URL } from '../config';
function Login({ onLoginSuccess }) {
  const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000';
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const handleRequestOTP = async (e) => {
    e.preventDefault();
    setLoading(true);
    setErrorMessage('');

    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/request-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (response.ok) {
        setStep(2); 
      } else {
        setErrorMessage(data.message || 'Verification initialization failed.');
      }
    } catch (err) {
      setErrorMessage('Cannot contact validation server. Check terminal engine logs.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOTP = async (e) => {
    e.preventDefault();
    setLoading(true);
    setErrorMessage('');

    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/verify-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, otp }),
      });

      const data = await response.json();

      if (response.ok) {
        localStorage.setItem('labPortalToken', data.token);
        onLoginSuccess(data.user);
      } else {
        setErrorMessage(data.message || 'Invalid or expired OTP authentication value.');
      }
    } catch (err) {
      setErrorMessage('Authentication pipeline broken. Please re-try.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0B132B] flex items-center justify-center p-4 font-sans text-slate-100">
      <div className="bg-[#111E43] w-full max-w-md rounded-2xl border border-slate-800 p-8 shadow-2xl relative overflow-hidden">
        <div className="absolute -top-10 -right-10 w-32 h-32 bg-blue-500/10 rounded-full blur-2xl pointer-events-none"></div>

        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold tracking-tight text-white">APEL Lab Management</h1>
          <p className="text-xs text-slate-400 mt-1">Secure Passwordless Authorization Gateway</p>
        </div>

        {errorMessage && (
          <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-xs p-3 rounded-xl mb-6 font-medium">
            ⚠️ {errorMessage}
          </div>
        )}

        {/* STEP 1: INPUT LAB EMAIL ID ROUTINE */}
        {step === 1 ? (
          <form onSubmit={handleRequestOTP} className="space-y-5">
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                Registered Lab Email Address
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="scholar@university.edu"
                className="w-full px-4 py-3 bg-slate-900 border border-slate-800 rounded-xl focus:outline-none focus:border-blue-500 text-sm tracking-wide text-white transition-all placeholder:text-slate-600"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 text-white font-semibold text-sm py-3 rounded-xl shadow-lg shadow-blue-600/10 transition-all flex items-center justify-center"
            >
              {loading ? 'Processing Registry Request...' : 'Generate Passkey OTP'}
            </button>
          </form>
        ) : (
          
          /* STEP 2: INPUT VALIDATION OTP DIGITS ROUTINE */
          <form onSubmit={handleVerifyOTP} className="space-y-5">
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                Enter Verification OTP Code
              </label>
              <input
                type="text"
                maxLength="6"
                required
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                placeholder="6-Digit Code"
                className="w-full px-4 py-3 bg-slate-900 border border-slate-800 rounded-xl focus:outline-none focus:border-blue-500 text-center text-lg font-mono tracking-[0.5em] text-white transition-all placeholder:text-slate-600"
              />
              <p className="text-[11px] text-slate-500 mt-2 text-center">
                A verification code has been dispatched to <span className="text-slate-300 font-medium">{email}</span>.
              </p>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-800 text-white font-semibold text-sm py-3 rounded-xl shadow-lg shadow-emerald-600/10 transition-all flex items-center justify-center"
            >
              {loading ? 'Authenticating Token Parameters...' : 'Verify Passcode & Enter'}
            </button>

            <button
              type="button"
              onClick={() => setStep(1)}
              className="w-full text-center text-xs text-slate-500 hover:text-slate-300 transition-colors pt-1"
            >
              Change Target Email Account
            </button>
          </form>
        )}

      </div>
    </div>
  );
}

export default Login;