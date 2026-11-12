'use client';

import { useState, useEffect } from 'react';
import { createBrowserClient } from '@supabase/ssr';

export default function AgentDialerPage() {
  const [supabase] = useState(() => createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  ));

  const [currentLead, setCurrentLead] = useState<any>(null);
  const [callStatus, setCallStatus] = useState<'idle' | 'dialing' | 'connected' | 'ended'>('idle');
  const [accessNumber, setAccessNumber] = useState<string>('');
  const [tranId, setTranId] = useState<string>('');
  const [loading, setLoading] = useState(false);

  // Fetch next pending lead in queue
  const fetchNextLead = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('leads')
      .select('*')
      .eq('status', 'pending')
      .limit(1)
      .single();

    if (data) {
      setCurrentLead(data);
    } else {
      setCurrentLead(null);
      alert('No pending leads in queue!');
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchNextLead();
  }, []);

  // Handle Click-to-Call Initiation
  const handleInitiateCall = async () => {
    if (!currentLead) return;
    setCallStatus('dialing');

    try {
      const res = await fetch('/api/telephony/dial', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leadId: currentLead.id,
          customerPhone: currentLead.phone_number,
        }),
      });

      const data = await res.json();
      if (!data.success) throw new Error(data.error);

      setTranId(data.tran_id);
      setAccessNumber(data.access_number);
      setCallStatus('connected');

    } catch (err: any) {
      alert(`Call failed: ${err.message}`);
      setCallStatus('idle');
    }
  };

  // Handle Call Disconnect / Disposition
  const handleDisposition = async (status: 'connected' | 'not_connected' | 'busy') => {
    if (!currentLead) return;

    // Update lead status in database
    await supabase
      .from('leads')
      .update({ status, last_call_tran_id: tranId })
      .eq('id', currentLead.id);

    // Reset state and fetch next lead
    setCallStatus('idle');
    setTranId('');
    setAccessNumber('');
    fetchNextLead();
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <div className="max-w-4xl mx-auto bg-gray-800 rounded-xl p-6 shadow-2xl border border-gray-700">
        <div className="flex justify-between items-center border-b border-gray-700 pb-4 mb-6">
          <h1 className="text-2xl font-bold">Agent Live Dialer Console</h1>
          <span className="px-3 py-1 bg-green-600 text-xs font-semibold rounded-full uppercase">Online</span>
        </div>

        {currentLead ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Lead Details Card */}
            <div className="bg-gray-900 p-5 rounded-lg border border-gray-700">
              <h2 className="text-sm font-medium text-gray-400 uppercase tracking-wider mb-3">Current Lead Target</h2>
              <p className="text-xl font-bold mb-1">{currentLead.customer_name}</p>
              <p className="text-lg text-indigo-400 font-mono mb-4">{currentLead.phone_number}</p>
              <div className="flex items-center gap-2">
                <span className="text-xs bg-gray-800 px-2 py-1 rounded text-gray-300">Status: {currentLead.status}</span>
              </div>
            </div>

            {/* Softphone & Call Controls */}
            <div className="bg-gray-900 p-5 rounded-lg border border-gray-700 flex flex-col justify-between">
              <div>
                <h2 className="text-sm font-medium text-gray-400 uppercase tracking-wider mb-3">Telephony State</h2>
                <div className="mb-4">
                  <p className="text-xs text-gray-400">Call State:</p>
                  <p className={`text-lg font-semibold uppercase ${callStatus === 'connected' ? 'text-green-400' : callStatus === 'dialing' ? 'text-yellow-400' : 'text-gray-400'}`}>
                    {callStatus}
                  </p>
                </div>

                {accessNumber && (
                  <div className="mb-4 p-3 bg-indigo-950 border border-indigo-800 rounded">
                    <p className="text-xs text-indigo-300">Bridge Access Number (CLI):</p>
                    <p className="text-xl font-mono font-bold text-indigo-200">{accessNumber}</p>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="space-y-3">
                {callStatus === 'idle' && (
                  <button
                    onClick={handleInitiateCall}
                    disabled={loading}
                    className="w-full py-3 bg-green-600 hover:bg-green-500 font-bold rounded-lg transition shadow-lg"
                  >
                    Initiate Call
                  </button>
                )}

                {callStatus === 'connected' && (
                  <div className="grid grid-cols-3 gap-2">
                    <button onClick={() => handleDisposition('connected')} className="py-2 bg-blue-600 hover:bg-blue-500 text-xs font-semibold rounded">
                      Connected
                    </button>
                    <button onClick={() => handleDisposition('not_connected')} className="py-2 bg-yellow-600 hover:bg-yellow-500 text-xs font-semibold rounded">
                      No Answer
                    </button>
                    <button onClick={() => handleDisposition('busy')} className="py-2 bg-red-600 hover:bg-red-500 text-xs font-semibold rounded">
                      Busy / Hangup
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center py-12">
            <p className="text-gray-400 text-lg">No leads available in the active campaign queue.</p>
          </div>
        )}
      </div>
    </div>
  );
}
