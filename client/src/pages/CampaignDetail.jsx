import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../utils/api';
import { supabase } from '../utils/supabase';
import { 
  Upload, Trash2, ArrowLeft, CheckCircle2, XCircle, Mail, Clock, 
  Camera, MessageCircle, Send, Briefcase, Globe, Phone, Plus, Settings, Activity, History, Edit
} from 'lucide-react';

import { useAuth } from '../context/AuthContext';

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
  return <span className={`badge ${styles[status] || styles.pending}`}>{status ? status.replace('_', ' ') : 'pending'}</span>;
};

const CampaignDetail = () => {
  const { id } = useParams();
  const { isAdmin } = useAuth();
  const [campaign, setCampaign] = useState(null);
  const [leads, setLeads] = useState([]);
  const [activityLogs, setActivityLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [csvPreview, setCsvPreview] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [manualAdd, setManualAdd] = useState(false);
  const [adding, setAdding] = useState(false);
  const [newLead, setNewLead] = useState({
    name: '', email: '', company: '', website: '', phone: '',
    instagram: '', facebook: '', twitter: '', linkedin: '',
    reviews: '', review_score: ''
  });
  const [activeTab, setActiveTab] = useState('leads');
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsData, setSettingsData] = useState({
    name: '', sender_name: '', from_email: '',
    follow_up_delays: [], templates: {}
  });
  const [replyingTo, setReplyingTo] = useState(null);
  const [sendingReply, setSendingReply] = useState(false);
  const [replyForm, setReplyForm] = useState({ subject: '', body: '' });
  const [editingLead, setEditingLead] = useState(null);
  const [updatingLead, setUpdatingLead] = useState(false);
  const fetchData = async () => {
    setLoading(true);
    try {
      const cRes = await api.get(`/campaigns/${id}`);
      setCampaign(cRes.data);
      setSettingsData({
        name: cRes.data.name,
        sender_name: cRes.data.sender_name,
        from_email: cRes.data.from_email,
        follow_up_delays: cRes.data.follow_up_delays,
        templates: cRes.data.templates
      });
      
      // Fetch leads and logs separately so one failure doesn't block everything
      api.get(`/campaigns/${id}/leads`).then(res => setLeads(res.data)).catch(console.error);
      api.get(`/campaigns/${id}/logs`).then(res => setActivityLogs(res.data)).catch(console.error);
      
    } catch (err) {
      console.error(err);
      const msg = err.response?.data?.error || err.message;
      alert(`Error loading campaign: ${msg}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const channel = supabase.channel(`campaign-leads-${id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'leads', filter: `campaign_id=eq.${id}` }, fetchData)
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, [id]);

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setSelectedFile(file);
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
      await api.post(`/campaigns/${id}/leads/import`, formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      setSelectedFile(null); setCsvPreview(null); fetchData();
    } catch (err) {
      alert(err.response?.data?.error || 'Import failed.');
    } finally {
      setImporting(false);
    }
  };

  const handleManualAdd = async (e) => {
    e.preventDefault();
    if (!newLead.email || !newLead.company) { alert('Email and Company are mandatory.'); return; }
    setAdding(true);
    try {
      await api.post(`/campaigns/${id}/leads`, newLead);
      setManualAdd(false);
      setNewLead({ name: '', email: '', company: '', website: '', phone: '', instagram: '', facebook: '', twitter: '', linkedin: '', reviews: '', review_score: '' });
      fetchData();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to add lead.');
    } finally {
      setAdding(false);
    }
  };

  const handleDeleteLead = async (leadId) => {
    if (!window.confirm('Delete this lead?')) return;
    try {
      await api.delete(`/leads/${leadId}`);
      setLeads(leads.filter(l => l.id !== leadId));
    } catch (err) { 
      console.error(err);
      alert(err.response?.data?.error || 'Failed to delete lead.');
    }
  };

  const updateStatus = async (leadId, status) => {
    try {
      await api.put(`/leads/${leadId}/status`, { status });
      fetchData();
    } catch (err) { 
      console.error(err);
      alert(err.response?.data?.error || 'Failed to update status.');
    }
  };

  const handleUpdateSettings = async (e) => {
    e.preventDefault();
    setSavingSettings(true);
    try {
      await api.put(`/campaigns/${id}`, settingsData);
      fetchData();
      alert('Campaign updated successfully!');
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to update campaign.');
    } finally {
      setSavingSettings(false);
    }
  };

  const openReplyModal = (lead) => {
    setReplyingTo(lead);
    setReplyForm({
      subject: `Re: ${campaign?.name || 'Our conversation'}`,
      body: `Hi ${lead.name || 'there'},\n\n`
    });
  };

  const handleSendReply = async (e) => {
    e.preventDefault();
    setSendingReply(true);
    try {
      await api.post(`/leads/${replyingTo.id}/reply`, replyForm);
      setReplyingTo(null);
      fetchData();
      alert('Reply sent successfully!');
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to send reply.');
    } finally {
      setSendingReply(false);
    }
  };

  const handleEditLead = async (e) => {
    e.preventDefault();
    setUpdatingLead(true);
    try {
      await api.put(`/leads/${editingLead.id}`, editingLead);
      setEditingLead(null);
      fetchData();
      alert('Lead updated successfully!');
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to update lead.');
    } finally {
      setUpdatingLead(false);
    }
  };

  if (loading) return <div className="p-8 text-center text-gray-500">Loading details...</div>;

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <header className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link to="/campaigns" className="p-2 rounded-lg bg-card border border-border text-gray-400 hover:text-white transition-colors">
            <ArrowLeft size={20} />
          </Link>
          <div>
            <h2 className="text-2xl md:text-3xl font-extrabold text-white">{campaign?.name}</h2>
            <p className="text-gray-400 text-sm">Leads, Activity, and Settings.</p>
          </div>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
          {isAdmin && (
            <>
              <button onClick={() => setManualAdd(true)} className="btn btn-primary flex items-center gap-2">
                <Plus size={18} /> Add Lead
              </button>
              <button onClick={() => setImporting(true)} className="btn btn-secondary flex items-center gap-2">
                <Upload size={18} /> Import CSV
              </button>
            </>
          )}
        </div>
      </header>

      {/* Stats Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
        <div className="glass p-4 rounded-2xl">
          <p className="text-[10px] text-gray-500 uppercase font-bold tracking-widest mb-1">Total</p>
          <p className="text-xl md:text-2xl font-bold text-white">{leads.length}</p>
        </div>
        <div className="glass p-4 rounded-2xl">
          <p className="text-[10px] text-gray-500 uppercase font-bold tracking-widest mb-1">Sent</p>
          <p className="text-xl md:text-2xl font-bold text-blue-400">{leads.filter(l => l.status !== 'pending').length}</p>
        </div>
        <div className="glass p-4 rounded-2xl">
          <p className="text-[10px] text-gray-500 uppercase font-bold tracking-widest mb-1">Replied</p>
          <p className="text-xl md:text-2xl font-bold text-green-400">{leads.filter(l => l.status === 'replied').length}</p>
        </div>
        <div className="glass p-4 rounded-2xl">
          <p className="text-[10px] text-gray-500 uppercase font-bold tracking-widest mb-1">Success</p>
          <p className="text-xl md:text-2xl font-bold text-purple-400">
            {leads.length > 0 ? ((leads.filter(l => l.status === 'replied').length / leads.length) * 100).toFixed(1) : 0}%
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 p-1 bg-card/50 border border-border rounded-xl w-fit">
        {['leads', 'activity', 'settings'].map(tab => (
          <button 
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-6 py-2 rounded-lg text-sm font-bold capitalize transition-all ${activeTab === tab ? 'bg-primary text-white shadow-lg' : 'text-gray-500 hover:text-white'}`}
          >
            {tab}
          </button>
        ))}
      </div>

      {activeTab === 'leads' && (
        <div className="glass rounded-3xl overflow-hidden border border-border/50">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[800px] md:min-w-full">
              <thead>
                <tr className="bg-card/80 border-b border-border">
                  <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase">Lead</th>
                  <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase">Company</th>
                  <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase">Contact</th>
                  <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase">Stats</th>
                  <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase">Status</th>
                  <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {Array.isArray(leads) && leads.map(lead => (
                  <tr key={lead.id} className="hover:bg-card/30 transition-colors group text-sm">
                    <td className="px-6 py-4">
                      <p className="font-bold text-white">{lead.name}</p>
                      <p className="text-xs text-gray-500">{lead.email}</p>
                    </td>
                    <td className="px-6 py-4 text-gray-300">{lead.company}</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        {lead.website && <a href={lead.website.startsWith('http') ? lead.website : `https://${lead.website}`} target="_blank" rel="noreferrer" className="p-1 rounded bg-card border border-border text-gray-400 hover:text-primary"><Globe size={12} /></a>}
                        {lead.phone && <a href={`tel:${lead.phone}`} className="p-1 rounded bg-card border border-border text-gray-400 hover:text-primary"><Phone size={12} /></a>}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-xs text-gray-400">
                      F-Ups: {lead.follow_ups}
                    </td>
                    <td className="px-6 py-4">
                      <StatusBadge status={lead.status} />
                    </td>
                    <td className="px-6 py-4 text-right">
                      {isAdmin && (
                        <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => setEditingLead(lead)} title="Edit Lead" className="p-1.5 rounded-lg text-amber-500 hover:bg-amber-500/10 transition-colors"><Edit size={18} /></button>
                          <button onClick={() => openReplyModal(lead)} title="Direct Reply" className="p-1.5 rounded-lg text-primary hover:bg-primary/10 transition-colors"><Mail size={18} /></button>
                          <button onClick={() => updateStatus(lead.id, 'replied')} title="Mark Replied" className="p-1.5 rounded-lg text-green-500 hover:bg-green-500/10 transition-colors"><CheckCircle2 size={18} /></button>
                          <button onClick={() => handleDeleteLead(lead.id)} title="Delete" className="p-1.5 rounded-lg text-red-500 hover:bg-red-500/10 transition-colors"><Trash2 size={18} /></button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
                {(!Array.isArray(leads) || leads.length === 0) && (
                  <tr>
                    <td colSpan="6" className="px-6 py-20 text-center text-gray-500 italic">No leads found for this campaign.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'activity' && (
        <div className="glass rounded-3xl overflow-hidden border border-border/50 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[800px] md:min-w-full">
              <thead>
                <tr className="bg-card/80 border-b border-border">
                  <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase">Event</th>
                  <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase">Lead</th>
                  <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase">Status</th>
                  <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase text-right">Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {activityLogs.map(log => (
                  <tr key={log.id} className="hover:bg-card/30 transition-colors text-sm">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${log.status === 'sent' ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'}`}><History size={16} /></div>
                        <span className="font-bold text-white capitalize">{log.type.replace('_', ' ')}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <p className="font-bold text-white">{log.leads?.name}</p>
                      <p className="text-[10px] text-gray-500">{log.leads?.email}</p>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`text-xs font-bold uppercase ${log.status === 'sent' ? 'text-green-500' : 'text-red-500'}`}>{log.status}</span>
                    </td>
                    <td className="px-6 py-4 text-right text-xs text-gray-500 font-mono">{new Date(log.sent_at).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'settings' && (
        <div className="glass rounded-3xl p-8 max-w-2xl border border-border/50 animate-in slide-in-from-bottom-4 duration-500">
          <h3 className="text-xl font-extrabold text-white mb-6">Campaign Settings</h3>
          <form onSubmit={handleUpdateSettings} className="space-y-6">
            <div className="space-y-2">
              <label className="text-xs font-bold text-gray-500 uppercase">Campaign Name</label>
              <input 
                type="text" 
                required 
                placeholder={campaign?.name || 'Campaign Name'}
                value={settingsData.name || ''} 
                onChange={(e) => setSettingsData({...settingsData, name: e.target.value})} 
                className="w-full bg-card border border-border rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-primary/20 outline-none transition-all" 
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-500 uppercase">Sender Name</label>
                <input 
                  type="text" 
                  required 
                  placeholder={campaign?.sender_name || 'Your Name'}
                  value={settingsData.sender_name || ''} 
                  onChange={(e) => setSettingsData({...settingsData, sender_name: e.target.value})} 
                  className="w-full bg-card border border-border rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-primary/20 outline-none transition-all" 
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-500 uppercase">From Email</label>
                <input 
                  type="email" 
                  required 
                  placeholder={campaign?.from_email || 'hello@example.com'}
                  value={settingsData.from_email || ''} 
                  onChange={(e) => setSettingsData({...settingsData, from_email: e.target.value})} 
                  className="w-full bg-card border border-border rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-primary/20 outline-none transition-all" 
                />
              </div>
            </div>
            <div className="pt-6 border-t border-border">
              <button type="submit" disabled={savingSettings} className="btn btn-primary px-8 py-3">{savingSettings ? 'Saving...' : 'Save Changes'}</button>
            </div>
          </form>
        </div>
      )}

      {/* Modals */}
      {importing && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="glass w-full max-w-xl rounded-3xl p-8">
            <h3 className="text-2xl mb-4 font-extrabold text-white">Import Leads</h3>
            <p className="text-sm text-gray-400 mb-6">Upload a CSV file. email and company are mandatory.</p>
            {!csvPreview ? (
              <div className="border-2 border-dashed border-border rounded-2xl p-12 text-center relative">
                <input type="file" accept=".csv" onChange={handleFileChange} className="absolute inset-0 opacity-0 cursor-pointer" />
                <Upload size={40} className="mx-auto text-gray-600 mb-4" />
                <p className="text-gray-500">Click to browse or drag and drop CSV</p>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="bg-card/50 rounded-xl border border-border p-4 max-h-48 overflow-y-auto">
                  <table className="w-full text-xs text-left">
                    <tbody>
                      {csvPreview.map((row, i) => (
                        <tr key={i} className="border-b border-border last:border-0">
                          {row.map((cell, j) => <td key={j} className="py-2 px-1 text-gray-400 truncate max-w-[100px]">{cell}</td>)}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="flex justify-end gap-3"><button onClick={() => { setCsvPreview(null); setSelectedFile(null); }} className="btn btn-secondary">Clear</button><button onClick={handleImport} className="btn btn-primary">Confirm Import</button></div>
              </div>
            )}
            <button onClick={() => { setImporting(false); setCsvPreview(null); }} className="mt-4 text-xs text-gray-500 hover:text-white mx-auto block">Close</button>
          </div>
        </div>
      )}

      {manualAdd && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="glass w-full max-w-2xl rounded-3xl p-8 my-8">
            <div className="flex justify-between items-center mb-6"><h3 className="text-2xl font-extrabold text-white">Add Lead</h3><button onClick={() => setManualAdd(false)} className="text-gray-400 hover:text-white"><XCircle size={24} /></button></div>
            <form onSubmit={handleManualAdd} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2"><label className="text-xs font-bold text-gray-500 uppercase">Email *</label><input type="email" required value={newLead.email} onChange={(e) => setNewLead({...newLead, email: e.target.value})} className="w-full bg-card border border-border rounded-xl px-4 py-3 text-white" /></div>
                <div className="space-y-2"><label className="text-xs font-bold text-gray-500 uppercase">Company *</label><input type="text" required value={newLead.company} onChange={(e) => setNewLead({...newLead, company: e.target.value})} className="w-full bg-card border border-border rounded-xl px-4 py-3 text-white" /></div>
                <div className="space-y-2"><label className="text-xs font-bold text-gray-500 uppercase">Name</label><input type="text" value={newLead.name} onChange={(e) => setNewLead({...newLead, name: e.target.value})} className="w-full bg-card border border-border rounded-xl px-4 py-3 text-white" /></div>
                <div className="space-y-2"><label className="text-xs font-bold text-gray-500 uppercase">Website</label><input type="text" value={newLead.website} onChange={(e) => setNewLead({...newLead, website: e.target.value})} className="w-full bg-card border border-border rounded-xl px-4 py-3 text-white" /></div>
              </div>
              <div className="flex justify-end gap-3 pt-6 border-t border-border"><button type="button" onClick={() => setManualAdd(false)} className="btn btn-secondary">Cancel</button><button type="submit" disabled={adding} className="btn btn-primary min-w-[140px]">{adding ? 'Adding...' : 'Save Lead'}</button></div>
            </form>
          </div>
        </div>
      )}

      {replyingTo && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="glass w-full max-w-2xl rounded-3xl p-8">
            <div className="flex justify-between items-center mb-6"><div><h3 className="text-2xl font-extrabold text-white">Direct Reply</h3><p className="text-sm text-gray-400">To: <span className="text-primary">{replyingTo.email}</span></p></div><button onClick={() => setReplyingTo(null)} className="text-gray-400 hover:text-white"><XCircle size={24} /></button></div>
            <form onSubmit={handleSendReply} className="space-y-4">
              <div className="space-y-2"><label className="text-xs font-bold text-gray-500 uppercase">Subject</label><input type="text" required value={replyForm.subject} onChange={(e) => setReplyForm({...replyForm, subject: e.target.value})} className="w-full bg-card border border-border rounded-xl px-4 py-3 text-white" /></div>
              <div className="space-y-2"><label className="text-xs font-bold text-gray-500 uppercase">Message</label><textarea required rows={8} value={replyForm.body} onChange={(e) => setReplyForm({...replyForm, body: e.target.value})} className="w-full bg-card border border-border rounded-xl px-4 py-3 text-white resize-none" /></div>
              <div className="flex justify-end gap-3 pt-4 border-t border-border"><button type="button" onClick={() => setReplyingTo(null)} className="btn btn-secondary">Cancel</button><button type="submit" disabled={sendingReply} className="btn btn-primary px-8 py-3">{sendingReply ? 'Sending...' : 'Send Reply'}</button></div>
            </form>
          </div>
        </div>
      )}

      {editingLead && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="glass w-full max-w-2xl rounded-3xl p-8 my-8">
            <div className="flex justify-between items-center mb-6"><h3 className="text-2xl font-extrabold text-white">Edit Lead</h3><button onClick={() => setEditingLead(null)} className="text-gray-400 hover:text-white"><XCircle size={24} /></button></div>
            <form onSubmit={handleEditLead} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2"><label className="text-xs font-bold text-gray-500 uppercase">Email</label><input type="email" required value={editingLead.email} onChange={(e) => setEditingLead({...editingLead, email: e.target.value})} className="w-full bg-card border border-border rounded-xl px-4 py-3 text-white" /></div>
                <div className="space-y-2"><label className="text-xs font-bold text-gray-500 uppercase">Company</label><input type="text" required value={editingLead.company} onChange={(e) => setEditingLead({...editingLead, company: e.target.value})} className="w-full bg-card border border-border rounded-xl px-4 py-3 text-white" /></div>
                <div className="space-y-2"><label className="text-xs font-bold text-gray-500 uppercase">Name</label><input type="text" value={editingLead.name || ''} onChange={(e) => setEditingLead({...editingLead, name: e.target.value})} className="w-full bg-card border border-border rounded-xl px-4 py-3 text-white" /></div>
                <div className="space-y-2"><label className="text-xs font-bold text-gray-500 uppercase">Website</label><input type="text" value={editingLead.website || ''} onChange={(e) => setEditingLead({...editingLead, website: e.target.value})} className="w-full bg-card border border-border rounded-xl px-4 py-3 text-white" /></div>
                <div className="space-y-2"><label className="text-xs font-bold text-gray-500 uppercase">Phone</label><input type="text" value={editingLead.phone || ''} onChange={(e) => setEditingLead({...editingLead, phone: e.target.value})} className="w-full bg-card border border-border rounded-xl px-4 py-3 text-white" /></div>
                <div className="space-y-2"><label className="text-xs font-bold text-gray-500 uppercase">Instagram</label><input type="text" value={editingLead.instagram || ''} onChange={(e) => setEditingLead({...editingLead, instagram: e.target.value})} className="w-full bg-card border border-border rounded-xl px-4 py-3 text-white" /></div>
                <div className="space-y-2"><label className="text-xs font-bold text-gray-500 uppercase">Facebook</label><input type="text" value={editingLead.facebook || ''} onChange={(e) => setEditingLead({...editingLead, facebook: e.target.value})} className="w-full bg-card border border-border rounded-xl px-4 py-3 text-white" /></div>
                <div className="space-y-2"><label className="text-xs font-bold text-gray-500 uppercase">Twitter</label><input type="text" value={editingLead.twitter || ''} onChange={(e) => setEditingLead({...editingLead, twitter: e.target.value})} className="w-full bg-card border border-border rounded-xl px-4 py-3 text-white" /></div>
                <div className="space-y-2"><label className="text-xs font-bold text-gray-500 uppercase">LinkedIn</label><input type="text" value={editingLead.linkedin || ''} onChange={(e) => setEditingLead({...editingLead, linkedin: e.target.value})} className="w-full bg-card border border-border rounded-xl px-4 py-3 text-white" /></div>
                <div className="space-y-2"><label className="text-xs font-bold text-gray-500 uppercase">Reviews Count</label><input type="number" value={editingLead.reviews || 0} onChange={(e) => setEditingLead({...editingLead, reviews: parseInt(e.target.value)})} className="w-full bg-card border border-border rounded-xl px-4 py-3 text-white" /></div>
                <div className="space-y-2"><label className="text-xs font-bold text-gray-500 uppercase">Review Score</label><input type="number" step="0.1" value={editingLead.review_score || 0} onChange={(e) => setEditingLead({...editingLead, review_score: parseFloat(e.target.value)})} className="w-full bg-card border border-border rounded-xl px-4 py-3 text-white" /></div>
              </div>
              <div className="flex justify-end gap-3 pt-6 border-t border-border"><button type="button" onClick={() => setEditingLead(null)} className="btn btn-secondary">Cancel</button><button type="submit" disabled={updatingLead} className="btn btn-primary min-w-[140px]">{updatingLead ? 'Updating...' : 'Update Lead'}</button></div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default CampaignDetail;
