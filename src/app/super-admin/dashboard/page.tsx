'use client';

import { useState, useEffect } from 'react';
import { createBrowserClient } from '@supabase/ssr';

export default function SuperAdminDashboard() {
  const [supabase] = useState(() => createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  ));

  const [tenants, setTenants] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [newCompanyName, setNewCompanyName] = useState('');
  const [maxUsers, setMaxUsers] = useState(5);

  // Fetch all tenants
  const fetchTenants = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('tenants')
      .select('*, users(count)')
      .order('created_at', { ascending: false });

    if (data) setTenants(data);
    setLoading(false);
  };

  useEffect(() => {
    fetchTenants();
  }, []);

  // Create a new tenant
  const handleCreateTenant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCompanyName) return;

    const { error } = await supabase.from('tenants').insert({
      company_name: newCompanyName,
      max_users: Number(maxUsers),
      api_settings: {},
    });

    if (error) {
      alert(`Error creating tenant: ${error.message}`);
    } else {
      setNewCompanyName('');
      setMaxUsers(5);
      fetchTenants();
    }
  };

  return (
    <div className="min-h-screen bg-gray-950 text-white p-8">
      <div className="max-w-6xl mx-auto">
        <header className="flex justify-between items-center mb-8 border-b border-gray-800 pb-4">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight">Super Admin Control Center</h1>
            <p className="text-gray-400 text-sm mt-1">Manage global tenants, seat limits, and telephony gateways across 1,000+ accounts.</p>
          </div>
          <span className="px-3 py-1 bg-indigo-600 text-xs font-bold rounded-full">Global Super Admin</span>
        </header>

        {/* Create Tenant Form */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 mb-8 shadow-xl">
          <h2 className="text-lg font-semibold mb-4 text-indigo-400">Onboard New Enterprise Tenant</h2>
          <form onSubmit={handleCreateTenant} className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">Company Name</label>
              <input
                type="text"
                value={newCompanyName}
                onChange={(e) => setNewCompanyName(e.target.value)}
                placeholder="Acme Corp Call Center"
                className="w-full bg-gray-950 border border-gray-700 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">Max User Seats</label>
              <input
                type="number"
                value={maxUsers}
                onChange={(e) => setMaxUsers(Number(e.target.value))}
                min="1"
                max="500"
                className="w-full bg-gray-950 border border-gray-700 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                required
              />
            </div>
            <div className="flex items-end">
              <button
                type="submit"
                className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 font-semibold text-sm rounded transition shadow"
              >
                Create Tenant Account
              </button>
            </div>
          </form>
        </div>

        {/* Tenants Table */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden shadow-xl">
          <div className="p-6 border-b border-gray-800">
            <h2 className="text-lg font-semibold">Active Enterprise Tenants ({tenants.length})</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-950 text-gray-400 text-xs uppercase tracking-wider">
                  <th className="p-4">Company Name</th>
                  <th className="p-4">Tenant ID</th>
                  <th className="p-4">User Seat Limit</th>
                  <th className="p-4">Created Date</th>
                  <th className="p-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800 text-sm">
                {loading ? (
                  <tr>
                    <td colSpan={5} className="p-6 text-center text-gray-500">Loading tenants...</td>
                  </tr>
                ) : tenants.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-6 text-center text-gray-500">No tenants found. Create your first one above.</td>
                  </tr>
                ) : (
                  tenants.map((tenant) => (
                    <tr key={tenant.id} className="hover:bg-gray-850 transition">
                      <td className="p-4 font-semibold text-white">{tenant.company_name}</td>
                      <td className="p-4 font-mono text-xs text-gray-400">{tenant.id}</td>
                      <td className="p-4">
                        <span className="px-2.5 py-1 bg-gray-800 rounded font-mono text-xs text-indigo-300">
                          {tenant.max_users} seats
                        </span>
                      </td>
                      <td className="p-4 text-gray-400 text-xs">{new Date(tenant.created_at).toLocaleDateString()}</td>
                      <td className="p-4 text-right">
                        <button 
                          onClick={() => alert(`Configuring API settings for ${tenant.company_name}`)}
                          className="text-xs text-indigo-400 hover:text-indigo-300 font-medium bg-indigo-950 px-3 py-1 rounded border border-indigo-900"
                        >
                          Configure API
                        </button>
                      </td>
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
