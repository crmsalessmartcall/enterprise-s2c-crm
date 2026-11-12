'use client';

import { useState, useEffect } from 'react';
import { createBrowserClient } from '@supabase/ssr';

export default function TenantDashboard() {
  const [supabase] = useState(() => createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  ));

  const [projects, setProjects] = useState<any[]>([]);
  const [projectName, setProjectName] = useState('');
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState('');

  // Fetch tenant projects / campaigns
  const fetchProjects = async () => {
    const { data, error } = await supabase
      .from('projects')
      .select('*, leads(count)')
      .order('created_at', { ascending: false });

    if (data) {
      setProjects(data);
      if (data.length > 0 && !selectedProjectId) {
        setSelectedProjectId(data[0].id);
      }
    }
  };

  useEffect(() => {
    fetchProjects();
  }, []);

  // Create new project/campaign
  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectName) return;

    // Get current user's tenant_id first
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    const { data: userData } = await supabase
      .from('users')
      .select('tenant_id')
      .eq('id', session.user.id)
      .single();

    if (!userData) return;

    const { error } = await supabase.from('projects').insert({
      tenant_id: userData.tenant_id,
      project_name: projectName,
      status: 'active',
    });

    if (error) {
      alert(`Error creating project: ${error.message}`);
    } else {
      setProjectName('');
      fetchProjects();
    }
  };

  // Handle CSV File Upload
  const handleUploadCSV = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file || !selectedProjectId) {
      alert('Please select a project and a CSV file.');
      return;
    }

    setUploading(true);
    setMessage('');

    const formData = new FormData();
    formData.append('file', file);
    formData.append('project_id', selectedProjectId);

    try {
      const res = await fetch('/api/leads/upload', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Upload failed');

      setMessage(data.message);
      setFile(null);
      fetchProjects();
    } catch (err: any) {
      setMessage(`Error: ${err.message}`);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-950 text-white p-8">
      <div className="max-w-6xl mx-auto">
        <header className="flex justify-between items-center mb-8 border-b border-gray-800 pb-4">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight">Tenant Admin Operations Center</h1>
            <p className="text-gray-400 text-sm mt-1">Manage calling campaigns, upload lead lists, and oversee agent queues.</p>
          </div>
          <a href="/agent/dialer" className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 font-semibold text-xs rounded transition shadow">
            Launch Agent Dialer →
          </a>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
          {/* Create Campaign Card */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 shadow-xl">
            <h2 className="text-lg font-semibold mb-4 text-indigo-400">1. Create New Campaign / Project</h2>
            <form onSubmit={handleCreateProject} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">Campaign Name</label>
                <input
                  type="text"
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  placeholder="e.g., Q2 Enterprise Outbound"
                  className="w-full bg-gray-950 border border-gray-700 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                  required
                />
              </div>
              <button
                type="submit"
                className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 font-semibold text-sm rounded transition shadow"
              >
                Create Campaign
              </button>
            </form>
          </div>

          {/* Upload Leads Card */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 shadow-xl">
            <h2 className="text-lg font-semibold mb-4 text-indigo-400">2. Upload Lead List (CSV)</h2>
            <form onSubmit={handleUploadCSV} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">Select Campaign</label>
                <select
                  value={selectedProjectId}
                  onChange={(e) => setSelectedProjectId(e.target.value)}
                  className="w-full bg-gray-950 border border-gray-700 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                  required
                >
                  {projects.map((proj) => (
                    <option key={proj.id} value={proj.id}>{proj.project_name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">CSV File (customer_name, phone_number)</label>
                <input
                  type="file"
                  accept=".csv"
                  onChange={(e) => setFile(e.target.files?.[0] || null)}
                  className="w-full text-sm text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-xs file:font-semibold file:bg-gray-800 file:text-indigo-300 hover:file:bg-gray-700"
                  required
                />
              </div>
              <button
                type="disabled"
                disabled={uploading}
                type="submit"
                className="w-full py-2.5 bg-green-600 hover:bg-green-500 font-semibold text-sm rounded transition shadow disabled:opacity-50"
              >
                {uploading ? 'Parsing & Uploading...' : 'Upload & Queue Leads'}
              </button>
              {message && <p className="text-xs text-indigo-300 mt-2 font-mono">{message}</p>}
            </form>
          </div>
        </div>

        {/* Projects / Campaigns Overview Table */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden shadow-xl">
          <div className="p-6 border-b border-gray-800">
            <h2 className="text-lg font-semibold">Active Campaigns & Lead Queues</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-950 text-gray-400 text-xs uppercase tracking-wider">
                  <th className="p-4">Campaign Name</th>
                  <th className="p-4">Status</th>
                  <th className="p-4">Total Leads Queued</th>
                  <th className="p-4">Created Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800 text-sm">
                {projects.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="p-6 text-center text-gray-500">No campaigns created yet. Create one above.</td>
                  </tr>
                ) : (
                  projects.map((proj) => (
                    <tr key={proj.id} className="hover:bg-gray-850 transition">
                      <td className="p-4 font-semibold text-white">{proj.project_name}</td>
                      <td className="p-4">
                        <span className="px-2.5 py-1 bg-green-950 border border-green-800 text-green-300 rounded text-xs uppercase font-mono">
                          {proj.status}
                        </span>
                      </td>
                      <td className="p-4 font-mono text-indigo-300">{proj.leads?.[0]?.count || 0} leads</td>
                      <td className="p-4 text-gray-400 text-xs">{new Date(proj.created_at).toLocaleDateString()}</td>
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
