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
  const [activeTab, setActiveTab] = useState('activity');
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsData, setSettingsData] = useState({
    name: '', sender_name: '', from_email: '',
    follow_up_delays: [], templates: {}, lead_list_ids: []
  });
  const [leadLists, setLeadLists] = useState([]);
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
        templates: cRes.data.templates,
        lead_list_ids: cRes.data.lead_list_ids || []
      });
      
      api.get('/lead-lists').then(res => setLeadLists(res.data)).catch(console.error);
      
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
            <p className="text-gray-400 text-sm">Activity and Settings.</p>
          </div>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
          {/* Direct lead management removed as per request to use Lead Lists */}
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
        {['activity', 'settings'].map(tab => (
          <button 
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-6 py-2 rounded-lg text-sm font-bold capitalize transition-all ${activeTab === tab ? 'bg-primary text-white shadow-lg' : 'text-gray-500 hover:text-white'}`}
          >
            {tab}
          </button>
        ))}
      </div>


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
                />
              </div>
            </div>
            <div className="space-y-3">
              <label className="text-xs font-bold text-gray-500 uppercase">Selected Lead Lists</label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto p-4 bg-card/30 rounded-2xl border border-border">
                {leadLists.map(list => (
                  <label key={list.id} className="flex items-center gap-3 p-2 hover:bg-card/50 rounded-lg cursor-pointer transition-colors">
                    <input 
                      type="checkbox"
                      className="w-4 h-4 rounded border-gray-600 bg-background text-primary focus:ring-primary/20"
                      checked={settingsData.lead_list_ids?.includes(list.id)}
                      onChange={(e) => {
                        const ids = e.target.checked 
                          ? [...(settingsData.lead_list_ids || []), list.id]
                          : (settingsData.lead_list_ids || []).filter(id => id !== list.id);
                        setSettingsData({ ...settingsData, lead_list_ids: ids });
                      }}
                    />
                    <span className="text-sm text-gray-300 truncate">{list.name}</span>
                  </label>
                ))}
                {leadLists.length === 0 && (
                  <p className="col-span-full text-xs text-gray-500 italic">No lead lists found. Create one in the Leads page.</p>
                )}
              </div>
            </div>
            <div className="pt-6 border-t border-border">
              <button type="submit" disabled={savingSettings} className="btn btn-primary px-8 py-3">{savingSettings ? 'Saving...' : 'Save Changes'}</button>
            </div>
          </form>
        </div>
      )}

    </div>
  );
};

export default CampaignDetail;
