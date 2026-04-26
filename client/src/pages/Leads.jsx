import React, { useEffect, useState } from 'react';
import api from '../utils/api';
import { supabase } from '../utils/supabase';
import { 
  Plus, Upload, Trash2, List, Users, Search, 
  ChevronRight, Globe, Phone, Mail, CheckCircle2, XCircle, Edit
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const Leads = () => {
  const { isAdmin } = useAuth();
  const [lists, setLists] = useState([]);
  const [selectedList, setSelectedList] = useState(null);
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newListName, setNewListName] = useState('');
  const [showImportModal, setShowImportModal] = useState(false);
  const [importing, setImporting] = useState(false);
  const [csvPreview, setCsvPreview] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [manualAdd, setManualAdd] = useState(false);
  const [adding, setAdding] = useState(false);
  const [creatingList, setCreatingList] = useState(false);
  const [showEditLeadModal, setShowEditLeadModal] = useState(false);
  const [editingLead, setEditingLead] = useState(null);
  const [newLead, setNewLead] = useState({
    email: '', company: '', website: '', phone: '',
    instagram: '', facebook: '', linkedin: '',
    reviews: '', review_score: ''
  });

  const [searchTerm, setSearchTerm] = useState('');

  const [isEditingName, setIsEditingName] = useState(false);
  const [editingName, setEditingName] = useState('');

  const fetchLists = async () => {
    try {
      const res = await api.get('/lead-lists');
      setLists(res.data);
      if (res.data.length > 0 && !selectedList) {
        // Automatically select the first list if none selected
        // setSelectedList(res.data[0]);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchLeads = async (listId) => {
    try {
      const res = await api.get(`/lead-lists/${listId}/leads`);
      setLeads(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchLists();
  }, []);

  useEffect(() => {
    if (selectedList) {
      fetchLeads(selectedList.id);
      
      const channel = supabase.channel(`list-leads-${selectedList.id}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'leads', filter: `list_id=eq.${selectedList.id}` }, () => fetchLeads(selectedList.id))
        .subscribe();
      return () => supabase.removeChannel(channel);
    }
  }, [selectedList]);

  const handleUpdateListName = async () => {
    if (!editingName.trim() || editingName === selectedList.name) {
      setIsEditingName(false);
      return;
    }
    try {
      const res = await api.put(`/lead-lists/${selectedList.id}`, { name: editingName.trim() });
      setLists(lists.map(l => l.id === selectedList.id ? res.data : l));
      setSelectedList(res.data);
      setIsEditingName(false);
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to update list name.');
    }
  };

  const handleCreateList = async (e) => {
    e.preventDefault();
    if (!newListName.trim()) return;
    setCreatingList(true);
    try {
      const res = await api.post('/lead-lists', { name: newListName.trim() });
      setLists([res.data, ...lists]);
      setNewListName('');
      setShowCreateModal(false);
      setSelectedList(res.data);
    } catch (err) {
      console.error('Full error object:', err);
      const status = err.response?.status;
      const errorMsg = err.response?.data?.error || err.message;
      alert(`Error (${status}): ${errorMsg}\n\nCheck your server console for more details.`);
    } finally {
      setCreatingList(false);
    }
  };

  const handleDeleteList = async (id) => {
    if (!window.confirm('Are you sure you want to delete this list and all its leads?')) return;
    try {
      await api.delete(`/lead-lists/${id}`);
      setLists(lists.filter(l => l.id !== id));
      if (selectedList?.id === id) {
        setSelectedList(null);
        setLeads([]);
      }
    } catch (err) {
      console.error(err);
    }
  };

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
    if (!selectedFile || !selectedList) return;
    setImporting(true);
    const formData = new FormData();
    formData.append('file', selectedFile);
    try {
      await api.post(`/lead-lists/${selectedList.id}/leads/import`, formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      setSelectedFile(null); setCsvPreview(null); setImporting(false); setShowImportModal(false);
      fetchLeads(selectedList.id);
    } catch (err) {
      alert(err.response?.data?.error || 'Import failed.');
      setImporting(false);
    }
  };

  const handleManualAdd = async (e) => {
    e.preventDefault();
    if (!newLead.email && !newLead.phone) { alert('At least Email or Phone is required.'); return; }
    setAdding(true);
    try {
      await api.post(`/lead-lists/${selectedList.id}/leads`, newLead);
      setManualAdd(false);
      setNewLead({ email: '', company: '', website: '', phone: '', instagram: '', facebook: '', linkedin: '', reviews: '', review_score: '' });
      fetchLeads(selectedList.id);
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to add lead.');
    } finally {
      setAdding(false);
    }
  };

  const handleUpdateLead = async (e) => {
    e.preventDefault();
    if (!editingLead.email && !editingLead.phone) { alert('At least Email or Phone is required.'); return; }
    setAdding(true);
    try {
      await api.put(`/leads/${editingLead.id}`, editingLead);
      setShowEditLeadModal(false);
      setEditingLead(null);
      fetchLeads(selectedList.id);
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to update lead.');
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
    }
  };

  const handleDeleteAllLeads = async () => {
    if (!selectedList) return;
    if (!window.confirm(`Are you sure you want to delete ALL ${leads.length} leads in "${selectedList.name}"? This will also delete them from any active campaigns. This action cannot be undone.`)) return;
    
    try {
      await api.delete(`/lead-lists/${selectedList.id}/leads`);
      setLeads([]);
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to delete leads.');
    }
  };

  if (loading) return <div className="p-8 text-center text-gray-500 font-sans">Loading leads...</div>;

  return (
    <div className="space-y-8 animate-in slide-in-from-bottom-4 duration-700">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl md:text-3xl font-extrabold text-white mb-2">Leads</h2>
          <p className="text-gray-400 text-sm">Organize your leads into lists for targeted outreach.</p>
        </div>
        {isAdmin && (
          <button 
            onClick={() => setShowCreateModal(true)}
            className="btn btn-primary flex items-center gap-2 w-full md:w-auto justify-center"
          >
            <Plus size={20} /> Create Lead List
          </button>
        )}
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Sidebar: Lists */}
        <div className="lg:col-span-1 space-y-4">
          <div className="glass p-4 rounded-2xl">
            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-4 px-2">Lead Lists</h3>
            <div className="space-y-1">
              {lists.map(list => (
                <button
                  key={list.id}
                  onClick={() => setSelectedList(list)}
                  className={`w-full flex items-center justify-between group px-4 py-3 rounded-xl transition-all duration-200 ${
                    selectedList?.id === list.id 
                      ? 'bg-primary text-white shadow-lg' 
                      : 'text-gray-400 hover:bg-card hover:text-white'
                  }`}
                >
                  <div className="flex items-center gap-3 truncate">
                    <List size={18} className={selectedList?.id === list.id ? 'text-white' : 'text-gray-500 group-hover:text-primary'} />
                    <span className="font-semibold text-sm truncate">{list.name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {isAdmin && selectedList?.id === list.id && (
                      <Edit 
                        size={14} 
                        className="text-white/50 hover:text-white cursor-pointer transition-colors" 
                        onClick={(e) => { 
                          e.stopPropagation(); 
                          setEditingName(list.name); 
                          setIsEditingName(true); 
                        }}
                      />
                    )}
                    {isAdmin && selectedList?.id === list.id && (
                      <Trash2 
                        size={14} 
                        className="text-white/50 hover:text-white cursor-pointer transition-colors" 
                        onClick={(e) => { e.stopPropagation(); handleDeleteList(list.id); }}
                      />
                    )}
                  </div>
                </button>
              ))}
              {lists.length === 0 && (
                <p className="text-xs text-gray-600 italic px-2 py-4">No lists created yet.</p>
              )}
            </div>
          </div>
        </div>

        {/* Main Content: Leads in List */}
        <div className="lg:col-span-3">
          {selectedList ? (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-card/30 p-6 rounded-3xl border border-border/50">
                <div>
                  {isEditingName ? (
                    <div className="flex items-center gap-2">
                      <input 
                        type="text" 
                        value={editingName} 
                        onChange={(e) => setEditingName(e.target.value)} 
                        className="bg-background border border-border rounded-lg px-3 py-1 text-white text-lg font-bold focus:outline-none focus:ring-2 focus:ring-primary/50"
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleUpdateListName();
                          if (e.key === 'Escape') setIsEditingName(false);
                        }}
                      />
                      <button onClick={handleUpdateListName} className="text-green-500 hover:text-green-400 p-1 transition-colors"><CheckCircle2 size={20}/></button>
                      <button onClick={() => setIsEditingName(false)} className="text-red-500 hover:text-red-400 p-1 transition-colors"><XCircle size={20}/></button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-3 group">
                      <h3 className="text-xl font-bold text-white">{selectedList.name}</h3>
                      {isAdmin && (
                        <button 
                          onClick={() => { setIsEditingName(true); setEditingName(selectedList.name); }}
                          className="text-gray-500 hover:text-white transition-all p-1"
                          title="Edit List Name"
                        >
                          <Edit size={16} />
                        </button>
                      )}
                    </div>
                  )}
                  <p className="text-sm text-gray-500">{leads.length} leads in this list</p>
                </div>
                {isAdmin && (
                  <div className="flex flex-wrap gap-2 w-full sm:w-auto">
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
                    <button onClick={() => setManualAdd(true)} className="btn btn-secondary text-xs py-2 flex-1 sm:flex-none flex items-center justify-center gap-2">
                      <Plus size={16} /> Add Lead
                    </button>
                    <button onClick={() => setShowImportModal(true)} className="btn btn-primary text-xs py-2 flex-1 sm:flex-none flex items-center justify-center gap-2">
                      <Upload size={16} /> Import CSV
                    </button>
                    <button 
                      onClick={handleDeleteAllLeads} 
                      disabled={leads.length === 0}
                      className="btn bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/20 text-xs py-2 flex-1 sm:flex-none flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Trash2 size={16} /> Delete All Leads
                    </button>
                  </div>
                )}
              </div>

              <div className="glass rounded-3xl overflow-hidden border border-border/50">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse min-w-[800px]">
                    <thead>
                      <tr className="bg-card/80 border-b border-border">
                        <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase">Lead</th>
                        <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase">Company</th>
                        <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase">Contact</th>
                        <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/50">
                      {leads
                        .filter(l => 
                          (l.company?.toLowerCase() || '').includes(searchTerm.toLowerCase()) || 
                          (l.email?.toLowerCase() || '').includes(searchTerm.toLowerCase())
                        )
                        .map(lead => (
                        <tr key={lead.id} className="hover:bg-card/30 transition-colors group text-sm">
                          <td className="px-6 py-4">
                            <p className="font-bold text-white">{lead.company || 'No Company'}</p>
                            <p className="text-xs text-gray-500">{lead.email || lead.phone || 'No Contact'}</p>
                          </td>
                          <td className="px-6 py-4 text-gray-300">
                            {lead.website && <div className="text-xs">Web: {lead.website}</div>}
                            {lead.phone && <div className="text-xs">Tel: {lead.phone}</div>}
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-2">
                              {lead.website && <a href={lead.website.startsWith('http') ? lead.website : `https://${lead.website}`} target="_blank" rel="noreferrer" className="p-1 rounded bg-card border border-border text-gray-400 hover:text-primary"><Globe size={12} /></a>}
                              {lead.phone && <a href={`tel:${lead.phone}`} className="p-1 rounded bg-card border border-border text-gray-400 hover:text-primary"><Phone size={12} /></a>}
                            </div>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <div className="flex justify-end gap-2">
                              {isAdmin && (
                                <button 
                                  onClick={() => { setEditingLead(lead); setShowEditLeadModal(true); }} 
                                  className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-card opacity-0 group-hover:opacity-100 transition-all"
                                  title="Edit Lead"
                                >
                                  <Edit size={16} />
                                </button>
                              )}
                              {isAdmin && (
                                <button 
                                  onClick={() => handleDeleteLead(lead.id)} 
                                  className="p-1.5 rounded-lg text-red-500 hover:bg-red-500/10 opacity-0 group-hover:opacity-100 transition-all"
                                  title="Delete Lead"
                                >
                                  <Trash2 size={16} />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                      {leads.length === 0 && (
                        <tr>
                          <td colSpan="4" className="px-6 py-20 text-center text-gray-500 italic">No leads in this list yet. Import some!</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-32 glass rounded-3xl border-dashed">
              <Users size={48} className="text-gray-600 mb-4" />
              <p className="text-gray-500 font-sans">Select a lead list from the left to view leads.</p>
            </div>
          )}
        </div>
      </div>

      {/* Modals */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="glass w-full max-w-md rounded-3xl p-8">
            <h3 className="text-2xl mb-6 font-extrabold text-white">New Lead List</h3>
            <form onSubmit={handleCreateList} className="space-y-6">
              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-500 uppercase tracking-widest">List Name</label>
                <input
                  required
                  autoFocus
                  className="input w-full"
                  placeholder="e.g. Real Estate Agents NYC"
                  value={newListName}
                  onChange={(e) => setNewListName(e.target.value)}
                />
              </div>
              <div className="flex justify-end gap-3 pt-6 border-t border-border">
                <button type="button" onClick={() => setShowCreateModal(false)} className="btn btn-secondary">Cancel</button>
                <button type="submit" disabled={creatingList} className="btn btn-primary min-w-[120px]">
                  {creatingList ? 'Creating...' : 'Create List'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showImportModal && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="glass w-full max-w-xl rounded-3xl p-8">
            <h3 className="text-2xl mb-4 font-extrabold text-white">Import to {selectedList?.name}</h3>
            <p className="text-sm text-gray-400 mb-6">
              Upload a CSV file. <span className="text-white">EMAIL or PHONE</span> is required. 
              All other fields are optional.
            </p>
            {!csvPreview ? (
              <div className="border-2 border-dashed border-border rounded-2xl p-12 text-center relative">
                <input type="file" accept=".csv" onChange={handleFileChange} className="absolute inset-0 opacity-0 cursor-pointer" />
                <Upload size={40} className="mx-auto text-gray-600 mb-4" />
                <p className="text-gray-500">Click to browse or drag and drop CSV</p>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <p className="text-xs text-green-500 font-bold">✓ File: {selectedFile?.name}</p>
                  <button onClick={() => { setCsvPreview(null); setSelectedFile(null); }} className="text-xs text-red-400 hover:text-red-300">Change File</button>
                </div>
                <div className="bg-card/50 rounded-xl border border-border p-4 max-h-48 overflow-y-auto">
                  <table className="w-full text-xs text-left">
                    <tbody className="divide-y divide-border/30">
                      {csvPreview.map((row, i) => (
                        <tr key={i} className="hover:bg-white/5 transition-colors">
                          {row.map((cell, j) => <td key={j} className="py-2 px-1 text-gray-400 truncate max-w-[100px]">{cell}</td>)}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="flex justify-end gap-3">
                  <button onClick={() => { setShowImportModal(false); setCsvPreview(null); setSelectedFile(null); }} className="btn btn-secondary" disabled={importing}>Cancel</button>
                  <button onClick={handleImport} disabled={importing} className="btn btn-primary min-w-[140px]">
                    {importing ? 'Importing...' : 'Confirm & Import'}
                  </button>
                </div>
              </div>
            )}
            {!importing && (
              <button onClick={() => { setShowImportModal(false); setCsvPreview(null); }} className="mt-4 text-xs text-gray-500 hover:text-white mx-auto block">Close</button>
            )}
          </div>
        </div>
      )}

      {manualAdd && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="glass w-full max-w-2xl rounded-3xl p-8 my-8">
            <div className="flex justify-between items-center mb-6"><h3 className="text-2xl font-extrabold text-white">Add Lead to {selectedList?.name}</h3><button onClick={() => setManualAdd(false)} className="text-gray-400 hover:text-white"><XCircle size={24} /></button></div>
            <form onSubmit={handleManualAdd} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2"><label className="text-xs font-bold text-gray-500 uppercase">Email</label><input type="email" placeholder="john@company.com" value={newLead.email} onChange={(e) => setNewLead({...newLead, email: e.target.value})} className="w-full bg-card border border-border rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-primary/20 outline-none" /></div>
                <div className="space-y-2"><label className="text-xs font-bold text-gray-500 uppercase">Company</label><input type="text" placeholder="Company Name" value={newLead.company} onChange={(e) => setNewLead({...newLead, company: e.target.value})} className="w-full bg-card border border-border rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-primary/20 outline-none" /></div>
                <div className="space-y-2"><label className="text-xs font-bold text-gray-500 uppercase">Website</label><input type="text" placeholder="https://example.com" value={newLead.website} onChange={(e) => setNewLead({...newLead, website: e.target.value})} className="w-full bg-card border border-border rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-primary/20 outline-none" /></div>
                <div className="space-y-2"><label className="text-xs font-bold text-gray-500 uppercase">Phone</label><input type="text" placeholder="+123456789" value={newLead.phone} onChange={(e) => setNewLead({...newLead, phone: e.target.value})} className="w-full bg-card border border-border rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-primary/20 outline-none" /></div>
                <div className="space-y-2"><label className="text-xs font-bold text-gray-500 uppercase">Reviews</label><input type="number" placeholder="50" value={newLead.reviews} onChange={(e) => setNewLead({...newLead, reviews: e.target.value})} className="w-full bg-card border border-border rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-primary/20 outline-none" /></div>
                <div className="space-y-2"><label className="text-xs font-bold text-gray-500 uppercase">Review Score</label><input type="number" step="0.1" placeholder="4.5" value={newLead.review_score} onChange={(e) => setNewLead({...newLead, review_score: e.target.value})} className="w-full bg-card border border-border rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-primary/20 outline-none" /></div>
                <div className="space-y-2"><label className="text-xs font-bold text-gray-500 uppercase">Instagram</label><input type="text" placeholder="@handle" value={newLead.instagram} onChange={(e) => setNewLead({...newLead, instagram: e.target.value})} className="w-full bg-card border border-border rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-primary/20 outline-none" /></div>
                <div className="space-y-2"><label className="text-xs font-bold text-gray-500 uppercase">Facebook</label><input type="text" placeholder="facebook.com/page" value={newLead.facebook} onChange={(e) => setNewLead({...newLead, facebook: e.target.value})} className="w-full bg-card border border-border rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-primary/20 outline-none" /></div>
                <div className="space-y-2"><label className="text-xs font-bold text-gray-500 uppercase">LinkedIn</label><input type="text" placeholder="linkedin.com/in/user" value={newLead.linkedin} onChange={(e) => setNewLead({...newLead, linkedin: e.target.value})} className="w-full bg-card border border-border rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-primary/20 outline-none" /></div>
              </div>
              <div className="flex justify-end gap-3 pt-6 border-t border-border"><button type="button" onClick={() => setManualAdd(false)} className="btn btn-secondary">Cancel</button><button type="submit" disabled={adding} className="btn btn-primary min-w-[140px]">{adding ? 'Adding...' : 'Save Lead'}</button></div>
            </form>
          </div>
        </div>
      )}

      {showEditLeadModal && editingLead && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="glass w-full max-w-2xl rounded-3xl p-8 my-8">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-2xl font-extrabold text-white">Edit Lead</h3>
              <button onClick={() => setShowEditLeadModal(false)} className="text-gray-400 hover:text-white"><XCircle size={24} /></button>
            </div>
            <form onSubmit={handleUpdateLead} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2"><label className="text-xs font-bold text-gray-500 uppercase">Email</label><input type="email" placeholder="john@company.com" value={editingLead.email} onChange={(e) => setEditingLead({...editingLead, email: e.target.value})} className="w-full bg-card border border-border rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-primary/20 outline-none" /></div>
                <div className="space-y-2"><label className="text-xs font-bold text-gray-500 uppercase">Company</label><input type="text" placeholder="Company Name" value={editingLead.company} onChange={(e) => setEditingLead({...editingLead, company: e.target.value})} className="w-full bg-card border border-border rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-primary/20 outline-none" /></div>
                <div className="space-y-2"><label className="text-xs font-bold text-gray-500 uppercase">Website</label><input type="text" placeholder="https://example.com" value={editingLead.website || ''} onChange={(e) => setEditingLead({...editingLead, website: e.target.value})} className="w-full bg-card border border-border rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-primary/20 outline-none" /></div>
                <div className="space-y-2"><label className="text-xs font-bold text-gray-500 uppercase">Phone</label><input type="text" placeholder="+123456789" value={editingLead.phone || ''} onChange={(e) => setEditingLead({...editingLead, phone: e.target.value})} className="w-full bg-card border border-border rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-primary/20 outline-none" /></div>
                <div className="space-y-2"><label className="text-xs font-bold text-gray-500 uppercase">Reviews</label><input type="number" placeholder="50" value={editingLead.reviews || 0} onChange={(e) => setEditingLead({...editingLead, reviews: e.target.value})} className="w-full bg-card border border-border rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-primary/20 outline-none" /></div>
                <div className="space-y-2"><label className="text-xs font-bold text-gray-500 uppercase">Review Score</label><input type="number" step="0.1" placeholder="4.5" value={editingLead.review_score || 0} onChange={(e) => setEditingLead({...editingLead, review_score: e.target.value})} className="w-full bg-card border border-border rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-primary/20 outline-none" /></div>
                <div className="space-y-2"><label className="text-xs font-bold text-gray-500 uppercase">Instagram</label><input type="text" placeholder="@handle" value={editingLead.instagram || ''} onChange={(e) => setEditingLead({...editingLead, instagram: e.target.value})} className="w-full bg-card border border-border rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-primary/20 outline-none" /></div>
                <div className="space-y-2"><label className="text-xs font-bold text-gray-500 uppercase">Facebook</label><input type="text" placeholder="facebook.com/page" value={editingLead.facebook || ''} onChange={(e) => setEditingLead({...editingLead, facebook: e.target.value})} className="w-full bg-card border border-border rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-primary/20 outline-none" /></div>
                <div className="space-y-2"><label className="text-xs font-bold text-gray-500 uppercase">LinkedIn</label><input type="text" placeholder="linkedin.com/in/user" value={editingLead.linkedin || ''} onChange={(e) => setEditingLead({...editingLead, linkedin: e.target.value})} className="w-full bg-card border border-border rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-primary/20 outline-none" /></div>
              </div>
              <div className="flex justify-end gap-3 pt-6 border-t border-border">
                <button type="button" onClick={() => setShowEditLeadModal(false)} className="btn btn-secondary">Cancel</button>
                <button type="submit" disabled={adding} className="btn btn-primary min-w-[140px]">{adding ? 'Updating...' : 'Update Lead'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>

  );
};

export default Leads;
