import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../utils/api';
import { supabase } from '../utils/supabase';
import { Upload, Trash2, ArrowLeft, CheckCircle2, XCircle, Mail, Clock } from 'lucide-react';

const StatusBadge = ({ status }) => {
  const styles = {
    pending: 'bg-gray-500/10 text-gray-400',
    sent: 'bg-blue-500/10 text-blue-400',
    follow_up_1: 'bg-amber-500/10 text-amber-500',
    follow_up_2: 'bg-orange-500/10 text-orange-500',
    replied: 'bg-green-500/10 text-green-400',
    bounced: 'bg-red-500/10 text-red-400',
    completed: 'bg-slate-500/10 text-slate-400'
  };
  return <span className={`badge ${styles[status] || styles.pending}`}>{status.replace('_', ' ')}</span>;
};

const CampaignDetail = () => {
  const { id } = useParams();
  const [campaign, setCampaign] = useState(null);
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [csvPreview, setCsvPreview] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);

  const fetchData = async () => {
    try {
      const [cRes, lRes] = await Promise.all([
        api.get(`/campaigns/${id}`),
        api.get(`/campaigns/${id}/leads`)
      ]);
      setCampaign(cRes.data);
      setLeads(lRes.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();

    // Real-time sync for leads in this campaign
    const channel = supabase
      .channel(`campaign-leads-${id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'leads',
          filter: `campaign_id=eq.${id}`
        },
        () => {
          fetchData();
        }
      )
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [id]);

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setSelectedFile(file);
    
    // Simple preview for first 5 rows (just for UI, actual import happens on server)
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target.result;
      const rows = text.split('\n').slice(0, 6).map(row => row.split(','));
      setCsvPreview(rows);
    };
    reader.readAsText(file);
  };

  const handleImport = async () => {
    if (!selectedFile) return;
    setImporting(true);
    const formData = new FormData();
    formData.append('file', selectedFile);
    
    try {
      await api.post(`/campaigns/${id}/leads/import`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setSelectedFile(null);
      setCsvPreview(null);
      fetchData();
    } catch (err) {
      alert('Import failed. Make sure CSV has name, email, company columns.');
    } finally {
      setImporting(false);
    }
  };

  const handleDeleteLead = async (leadId) => {
    if (!window.confirm('Delete this lead?')) return;
    try {
      await api.delete(`/leads/${leadId}`);
      setLeads(leads.filter(l => l.id !== leadId));
    } catch (err) {
      console.error(err);
    }
  };

  const updateStatus = async (leadId, status) => {
    try {
      await api.put(`/leads/${leadId}/status`, { status });
      fetchData();
    } catch (err) {
      console.error(err);
    }
  };

  if (loading) return <div className="p-8 text-center text-gray-500 font-sans">Loading campaign details...</div>;

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link to="/campaigns" className="p-2 rounded-lg bg-card border border-border text-gray-400 hover:text-white transition-colors">
            <ArrowLeft size={20} />
          </Link>
          <div>
            <h2 className="text-3xl font-extrabold text-white">{campaign?.name}</h2>
            <p className="text-gray-400 text-sm">Leads management and import.</p>
          </div>
        </div>
        <div className="flex gap-3">
          <button onClick={() => setImporting(true)} className="btn btn-secondary flex items-center gap-2">
            <Upload size={18} /> Import CSV
          </button>
        </div>
      </header>

      {/* Stats Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="glass p-4 rounded-2xl">
          <p className="text-[10px] text-gray-500 uppercase font-bold tracking-widest mb-1">Total Leads</p>
          <p className="text-2xl font-bold text-white">{leads.length}</p>
        </div>
        <div className="glass p-4 rounded-2xl">
          <p className="text-[10px] text-gray-500 uppercase font-bold tracking-widest mb-1">Contacted</p>
          <p className="text-2xl font-bold text-blue-400">{leads.filter(l => l.status !== 'pending').length}</p>
        </div>
        <div className="glass p-4 rounded-2xl">
          <p className="text-[10px] text-gray-500 uppercase font-bold tracking-widest mb-1">Replied</p>
          <p className="text-2xl font-bold text-green-400">{leads.filter(l => l.status === 'replied').length}</p>
        </div>
        <div className="glass p-4 rounded-2xl">
          <p className="text-[10px] text-gray-500 uppercase font-bold tracking-widest mb-1">Success Rate</p>
          <p className="text-2xl font-bold text-purple-400">
            {leads.length > 0 ? ((leads.filter(l => l.status === 'replied').length / leads.length) * 100).toFixed(1) : 0}%
          </p>
        </div>
      </div>

      {/* Leads Table */}
      <div className="glass rounded-3xl overflow-hidden border border-border/50">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-card/80 border-b border-border">
              <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase">Lead</th>
              <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase">Company</th>
              <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase">Status</th>
              <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase">Follow-ups</th>
              <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase">Last Contact</th>
              <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/50">
            {leads.map(lead => (
              <tr key={lead.id} className="hover:bg-card/30 transition-colors group">
                <td className="px-6 py-4">
                  <p className="font-bold text-white text-sm">{lead.name}</p>
                  <p className="text-xs text-gray-500">{lead.email}</p>
                </td>
                <td className="px-6 py-4 text-sm text-gray-300">{lead.company}</td>
                <td className="px-6 py-4">
                  <StatusBadge status={lead.status} />
                </td>
                <td className="px-6 py-4 text-sm text-gray-400">{lead.follow_ups}</td>
                <td className="px-6 py-4 text-xs text-gray-500">
                  {lead.last_contact ? new Date(lead.last_contact).toLocaleDateString() : '—'}
                </td>
                <td className="px-6 py-4 text-right">
                  <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button 
                      onClick={() => updateStatus(lead.id, 'replied')}
                      title="Mark as Replied"
                      className="p-1.5 rounded-lg text-green-500 hover:bg-green-500/10 transition-colors"
                    >
                      <CheckCircle2 size={18} />
                    </button>
                    <button 
                      onClick={() => handleDeleteLead(lead.id)}
                      className="p-1.5 rounded-lg text-gray-500 hover:text-red-500 hover:bg-red-500/10 transition-colors"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {leads.length === 0 && (
              <tr>
                <td colSpan="6" className="px-6 py-12 text-center text-gray-500 italic">No leads found for this campaign.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Import Modal */}
      {importing && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="glass w-full max-w-xl rounded-3xl p-8">
            <h3 className="text-2xl mb-4">Import Leads</h3>
            <p className="text-sm text-gray-400 mb-6 leading-relaxed">
              Upload a CSV file with <span className="text-white font-mono">name, email, company</span> columns.
            </p>
            
            {!csvPreview ? (
              <div className="border-2 border-dashed border-border rounded-2xl p-12 text-center hover:border-primary/50 transition-colors cursor-pointer group relative">
                <input 
                  type="file" 
                  accept=".csv" 
                  onChange={handleFileChange}
                  className="absolute inset-0 opacity-0 cursor-pointer"
                />
                <Upload size={40} className="mx-auto text-gray-600 mb-4 group-hover:text-primary transition-colors" />
                <p className="text-gray-500 font-sans">Click to browse or drag and drop CSV</p>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="bg-card/50 rounded-xl border border-border p-4 max-h-48 overflow-y-auto">
                  <p className="text-[10px] text-gray-500 uppercase font-bold mb-3">Preview (First 5 rows)</p>
                  <table className="w-full text-xs text-left">
                    <tbody>
                      {csvPreview.map((row, i) => (
                        <tr key={i} className="border-b border-border last:border-0">
                          {row.map((cell, j) => (
                            <td key={j} className="py-2 px-1 text-gray-400 truncate max-w-[100px]">{cell}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="flex justify-end gap-3 pt-4 border-t border-border">
                  <button onClick={() => { setCsvPreview(null); setSelectedFile(null); }} className="btn btn-secondary">Clear</button>
                  <button onClick={handleImport} className="btn btn-primary flex items-center gap-2">
                    <CheckCircle2 size={18} /> Confirm Import
                  </button>
                </div>
              </div>
            )}
            <button onClick={() => { setImporting(false); setCsvPreview(null); }} className="mt-4 text-xs text-gray-500 hover:text-white mx-auto block">Close</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default CampaignDetail;
