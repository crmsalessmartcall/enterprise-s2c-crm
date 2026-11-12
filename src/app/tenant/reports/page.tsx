'use client';

import { useState, useEffect } from 'react';
import { createBrowserClient } from '@supabase/ssr';

export default function SupervisorReportsPage() {
  const [supabase] = useState(() => createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  ));

  const [callLogs, setCallLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ totalCalls: 0, connected: 0, failed: 0 });

  // Fetch call logs and compute metrics
  const fetchCallLogs = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('call_logs')
      .select('*, leads(customer_name, phone_number), users(full_name)')
      .order('created_at', { ascending: false })
      .limit(50);

    if (data) {
      setCallLogs(data);
      
      // Calculate quick summary metrics
      const total = data.length;
      const connected = data.filter((log: any) => log.status === 'completed' || log.status === 'answered').length;
      const failed = data.filter((log: any) => log.status === 'failed').length;
      
      setStats({ totalCalls: total, connected, failed });
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchCallLogs();

    // Subscribe to Realtime changes for live call monitoring
    const channel = supabase
      .channel('public:call_logs')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'call_logs' }, () => {
        fetchCallLogs();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return (
    <div className="min-h-screen bg-gray-950 text-white p-8">
      <div className="max-w-6xl mx-auto">
        <header className="flex justify-between items-center mb-8 border-b border-gray-800 pb-4">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight">Supervisor CDR & Real-Time Analytics</h1>
            <p className="text-gray-400 text-sm mt-1">Live monitoring of telephony sessions, agent activity logs, and call dispositions.</p>
          </div>
          <a href="/tenant/dashboard" className="px-4 py-2 bg-gray-800 hover:bg-gray-700 font-semibold text-xs rounded transition text-gray-300">
            ← Back to Campaign Hub
          </a>
        </header>

        {/* Metrics Overview Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 shadow-xl">
            <p className="text-xs uppercase font-medium text-gray-400">Total Recent Calls Logged</p>
            <p className="text-3xl font-bold font-mono mt-2 text-white">{stats.totalCalls}</p>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 shadow-xl">
            <p className="text-xs uppercase font-medium text-gray-400">Successful Connections</p>
            <p className="text-3xl font-bold font-mono mt-2 text-green-400">{stats.connected}</p>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 shadow-xl">
            <p className="text-xs uppercase font-medium text-gray-400">Failed / Unanswered</p>
            <p className="text-3xl font-bold font-mono mt-2 text-red-400">{stats.failed}</p>
          </div>
        </div>

        {/* Call Logs Table */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden shadow-xl">
          <div className="p-6 border-b border-gray-800 flex justify-between items-center">
            <h2 className="text-lg font-semibold">Live Call Detail Records (CDR)</h2>
            <span className="text-xs font-mono text-indigo-400 bg-indigo-950 px-3 py-1 rounded border border-indigo-900">
              Auto-syncing via Supabase Realtime
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-950 text-gray-400 text-xs uppercase tracking-wider">
                  <th className="p-4">Customer</th>
                  <th className="p-4">Agent</th>
                  <th className="p-4">Transaction ID (`tran_id`)</th>
                  <th className="p-4">Status</th>
                  <th className="p-4">Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800 text-sm">
                {loading ? (
                  <tr>
                    <td colSpan={5} className="p-6 text-center text-gray-500">Loading call activity...</td>
                  </tr>
                ) : callLogs.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-6 text-center text-gray-500">No call logs recorded yet. Start dialing from the agent console.</td>
                  </tr>
                ) : (
                  callLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-gray-850 transition">
                      <td className="p-4">
                        <p className="font-semibold text-white">{log.leads?.customer_name || 'Unknown Lead'}</p>
                        <p className="text-xs font-mono text-gray-400">{log.leads?.phone_number}</p>
                      </td>
                      <td className="p-4 text-gray-300">{log.users?.full_name || 'Unassigned Agent'}</td>
                      <td className="p-4 font-mono text-xs text-indigo-300">{log.tran_id || 'N/A'}</td>
                      <td className="p-4">
                        <span className={`px-2.5 py-1 rounded text-xs uppercase font-mono border ${
                          log.status === 'completed' || log.status === 'answered'
                            ? 'bg-green-950 border-green-800 text-green-300'
                            : log.status === 'initiated'
                            ? 'bg-yellow-950 border-yellow-800 text-yellow-300'
                            : 'bg-red-950 border-red-800 text-red-300'
                        }`}>
                          {log.status}
                        </span>
                      </td>
                      <td className="p-4 text-gray-400 text-xs">{new Date(log.created_at).toLocaleTimeString()}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
