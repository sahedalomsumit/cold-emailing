import React, { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import api from '../utils/api';
import { supabase } from '../utils/supabase';
import { 
  Upload, Trash2, ArrowLeft, CheckCircle2, XCircle, Mail, Clock, 
  Camera, MessageCircle, Send, Briefcase, Globe, Phone, Plus, Settings, Activity, History, Edit, Search, PlayCircle, Rocket, BarChart3
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
    completed: 'bg-slate-500/10 text-slate-400',
    unsubscribed: 'bg-purple-500/10 text-purple-400'
  };
  return <span className={`badge ${styles[status] || styles.pending}`}>{status ? status.replace('_', ' ') : 'pending'}</span>;
};

const CampaignDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isAdmin, isSuperAdmin } = useAuth();
  const [campaign, setCampaign] = useState(null);
  const [leads, setLeads] = useState([]);
  const [activityLogs, setActivityLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
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
  const [searchTerm, setSearchTerm] = useState('');
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

  const handleUpdateSettings = async (e) => {
    e.preventDefault();
    setSavingSettings(true);
    try {
      await api.put(`/campaigns/${id}`, settingsData);
      setCampaign({ ...campaign, ...settingsData });
      alert('Settings updated successfully!');
      fetchData(); // Refresh to ensure everything is in sync
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.error || 'Failed to update settings');
    } finally {
      setSavingSettings(false);
    }
  };

  const handleToggleStatus = async () => {
    setRunning(true);
    try {
      const endpoint = campaign.active ? `/campaigns/${id}/pause` : `/campaigns/${id}/activate`;
      const res = await api.post(endpoint);
      if (!campaign.active) {
        alert(`Campaign Activated! Processed ${res.data.summary?.processed || 0} emails. Errors: ${res.data.summary?.errors || 0}`);
      }
      fetchData();
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.error || 'Action failed');
    } finally {
      setRunning(false);
    }
  };

  const handleDeleteCampaign = async () => {
    if (!window.confirm('Are you sure you want to delete this campaign and all its leads? This action cannot be undone.')) return;
    try {
      await api.delete(`/campaigns/${id}`);
      navigate('/campaigns');
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.error || 'Failed to delete campaign');
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
          <Link 
            to={`/campaigns/${id}/reports`}
            className="btn btn-secondary flex items-center justify-center gap-2"
          >
            <BarChart3 size={20} /> View Dynamic Reports
          </Link>
          {isSuperAdmin && (
            <button 
              onClick={handleToggleStatus}
              disabled={running}
              className={`btn ${running ? 'bg-gray-700' : (campaign?.active ? 'bg-amber-500/10 text-amber-500 border border-amber-500/30' : 'btn-primary')} flex items-center justify-center gap-2`}
            >
              {running ? (
                <>
                  <Activity className="animate-spin" size={20} /> Processing...
                </>
              ) : campaign?.active ? (
                <>
                  <Pause size={20} /> Pause Campaign
                </>
              ) : (
                <>
                  <PlayCircle size={20} /> Activate & Run Now
                </>
              )}
            </button>
          )}
        </div>

        {campaign?.last_run && (
          <div className="flex items-center gap-2 text-[10px] text-gray-500 font-mono bg-card/30 w-fit px-3 py-1 rounded-full border border-border/50">
            <Clock size={10} /> Last Processed: {new Date(campaign.last_run).toLocaleString()}
          </div>
        )}
      </header>

      {/* Stats Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
        <div className="glass p-4 rounded-2xl">
          <p className="text-[10px] text-gray-500 uppercase font-bold tracking-widest mb-1">Total</p>
          <p className="text-xl md:text-2xl font-bold text-white">
            {leads.filter(l => l.email && l.email.trim() !== '').length}
          </p>
        </div>
        <div className="glass p-4 rounded-2xl">
          <p className="text-[10px] text-gray-500 uppercase font-bold tracking-widest mb-1">Sent</p>
          <p className="text-xl md:text-2xl font-bold text-blue-400">
            {leads.filter(l => l.status !== 'pending').length}
          </p>
        </div>
        <div className="glass p-4 rounded-2xl">
          <p className="text-[10px] text-gray-500 uppercase font-bold tracking-widest mb-1">Replied</p>
          <p className="text-xl md:text-2xl font-bold text-green-400">
            {leads.filter(l => l.status === 'replied').length}
          </p>
        </div>
        <div className="glass p-4 rounded-2xl border border-primary/20 bg-primary/5">
          <p className="text-[10px] text-primary uppercase font-bold tracking-widest mb-1">Queue</p>
          <p className="text-xl md:text-2xl font-bold text-white">
            {leads.filter(l => {
              if (!l.email || l.email.trim() === '') return false;
              if (l.status === 'pending' || !l.last_contact) return true;
              const followUpIndex = l.follow_ups - 1;
              const delayDays = campaign?.follow_up_delays?.[followUpIndex];
              if (delayDays === undefined) return false;
              const diffDays = Math.floor(Math.abs(new Date() - new Date(l.last_contact)) / (1000 * 60 * 60 * 24));
              return diffDays >= delayDays && l.follow_ups <= campaign.max_follow_ups;
            }).length} Ready
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 p-1 bg-card/50 border border-border rounded-xl w-fit">
        {['activity', 'leads', 'settings'].map(tab => (
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
        <div className="space-y-6">
          <div className="glass p-6 rounded-3xl border border-border/50 bg-blue-500/5">
            <div className="flex gap-4 items-start">
              <div className="p-3 rounded-2xl bg-blue-500/10 text-blue-400">
                <Rocket size={24} />
              </div>
              <div>
                <h4 className="text-lg font-bold text-white mb-1">How Automation Works</h4>
                <p className="text-sm text-gray-400 leading-relaxed">
                  This campaign checks for new leads and follow-ups <span className="text-white font-bold">automatically</span>. 
                  When you activate the campaign, add a new list, or import new leads, the system starts working <span className="text-white font-bold">immediately</span>.
                </p>
              </div>
            </div>
          </div>

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
                        <p className="font-bold text-white">{log.leads?.company || 'Lead'}</p>
                        <p className="text-[10px] text-gray-500">{log.leads?.email}</p>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`text-xs font-bold uppercase ${log.status === 'sent' ? 'text-green-500' : 'text-red-500'}`}>{log.status}</span>
                      </td>
                      <td className="px-6 py-4 text-right text-xs text-gray-500 font-mono">{new Date(log.sent_at || log.created_at).toLocaleString()}</td>
                    </tr>
                  ))}
                  {activityLogs.length === 0 && (
                    <tr>
                      <td colSpan="4" className="px-6 py-20 text-center">
                        <div className="flex flex-col items-center gap-4">
                          <History size={48} className="text-gray-700" />
                          <div className="max-w-md">
                            <p className="text-gray-400 font-bold mb-2">No activity logs yet.</p>
                            <p className="text-gray-500 text-xs">
                              Campaigns are automatically processed when active. 
                              {isSuperAdmin ? " Activating a campaign or adding leads will trigger an immediate run." : " Please wait for the system to process your leads."}
                            </p>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'leads' && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="glass rounded-3xl p-6 border border-border/50">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
              <div>
                <h3 className="text-xl font-extrabold text-white">Campaign Leads</h3>
                <p className="text-sm text-gray-400">Leads from selected lead lists.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <div className="relative flex-1 min-w-[200px]">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={16} />
                  <input 
                    type="text" 
                    placeholder="Search leads..." 
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full bg-card border border-border rounded-xl pl-10 pr-4 py-2 text-xs text-white focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                  />
                </div>
                <button 
                  onClick={() => setActiveTab('settings')}
                  className="btn btn-secondary text-xs flex items-center gap-2"
                >
                  <Plus size={16} /> Manage Lead Lists
                </button>
              </div>
            </div>

            <div className="flex gap-4 mb-6 p-4 bg-primary/5 rounded-2xl border border-primary/10">
              <div className="text-primary"><CheckCircle2 size={20} /></div>
              <div>
                <p className="text-xs font-bold text-white mb-1">Safety Filters Active</p>
                <p className="text-[10px] text-gray-500 leading-relaxed">
                  To protect your sender reputation, the system automatically skips leads marked as 
                  <span className="text-green-400 mx-1">replied</span>, 
                  <span className="text-red-400 mx-1">bounced</span>, 
                  <span className="text-slate-400 mx-1">completed</span>, or 
                  <span className="text-purple-400 mx-1">unsubscribed</span>.
                </p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-card/80 border-b border-border">
                    <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase">Company</th>
                    <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase">Email Address</th>
                    <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase">Status</th>
                    <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase text-right">Follow-ups</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {leads
                    .filter(l => {
                      const matchesSearch = (l.company?.toLowerCase() || '').includes(searchTerm.toLowerCase()) || 
                                          (l.email?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
                                          (l.phone?.toLowerCase() || '').includes(searchTerm.toLowerCase());
                      const hasEmail = l.email && l.email.trim() !== '';
                      return matchesSearch && hasEmail;
                    })
                    .map(lead => (
                    <tr key={lead.id} className="hover:bg-card/30 transition-colors text-sm">
                      <td className="px-6 py-4">
                        <p className="font-bold text-white">{lead.company || 'N/A'}</p>
                        <p className="text-[10px] text-gray-500">{lead.name}</p>
                      </td>
                      <td className="px-6 py-4 text-gray-300">
                        <p className="font-semibold">{lead.email}</p>
                      </td>
                      <td className="px-6 py-4">
                        <StatusBadge status={lead.status} />
                      </td>
                      <td className="px-6 py-4 text-right font-mono text-white">{lead.follow_ups || 0}</td>
                    </tr>
                  ))}
                  {leads.length === 0 && (
                    <tr>
                      <td colSpan="4" className="px-6 py-20 text-center text-gray-500 italic">
                        No leads found. Make sure you have selected lead lists in the Settings tab.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
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
            <div className="pt-6 border-t border-border flex flex-col sm:flex-row justify-between gap-4">
              <button type="submit" disabled={savingSettings} className="btn btn-primary px-8 py-3">{savingSettings ? 'Saving...' : 'Save Changes'}</button>
              {isAdmin && (
                <button 
                  type="button" 
                  onClick={handleDeleteCampaign}
                  className="px-6 py-3 rounded-xl border border-red-500/30 text-red-500 hover:bg-red-500 hover:text-white transition-all duration-200 font-bold text-sm flex items-center justify-center gap-2"
                >
                  <Trash2 size={18} /> Delete Campaign
                </button>
              )}
            </div>
          </form>
        </div>
      )}

    </div>
  );
};

export default CampaignDetail;
