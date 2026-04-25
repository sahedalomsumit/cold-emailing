import React, { useEffect, useState } from 'react';
import api from '../utils/api';
import { Save, Eye, Send, Code, AlertCircle, Bold, Italic, List, Link as LinkIcon } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const Templates = () => {
  const { isAdmin } = useAuth();
  const [campaigns, setCampaigns] = useState([]);
  const [selectedCampaignId, setSelectedCampaignId] = useState('');
  const [selectedType, setSelectedType] = useState('initial');
  const [templates, setTemplates] = useState({
    initial: { subject: '', body: '' },
    follow_up_1: { subject: '', body: '' },
    follow_up_2: { subject: '', body: '' }
  });
  const [saving, setSaving] = useState(false);
  const [testEmail, setTestEmail] = useState('sahedalomsumit@gmail.com');
  const [testLead, setTestLead] = useState(null);
  const [leads, setLeads] = useState([]);
  const [selectedLeadId, setSelectedLeadId] = useState('');
  const [leadLists, setLeadLists] = useState([]);
  const [previewListId, setPreviewListId] = useState('');
  const textareaRef = React.useRef(null);

  const fetchCampaigns = async () => {
    try {
      const res = await api.get('/campaigns');
      setCampaigns(res.data);
      if (res.data.length > 0 && !selectedCampaignId) {
        setSelectedCampaignId(res.data[0].id);
        setTemplates(res.data[0].templates);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchCampaigns();
    // Fetch test lead data for preview
    api.get('/leads/by-email/sahedalomsumit@gmail.com')
      .then(res => setTestLead(res.data))
      .catch(err => console.log('Test lead not found in database, using fallback.'));
    
    api.get('/lead-lists').then(res => {
      setLeadLists(res.data);
      // Look for a test list automatically
      const testList = res.data.find(l => l.name.toLowerCase().includes('test'));
      if (testList) setPreviewListId(testList.id);
    }).catch(console.error);
  }, []);

  useEffect(() => {
    const c = campaigns.find(c => c.id === selectedCampaignId);
    if (c) setTemplates(c.templates);
  }, [selectedCampaignId, campaigns]);

  useEffect(() => {
    const fetchLeadsForPreview = async () => {
      try {
        const listsRes = await api.get('/lead-lists');
        const testList = listsRes.data.find(l => l.name.toLowerCase().includes('test'));
        
        let targetLeads = [];
        if (testList) {
          const leadsRes = await api.get(`/lead-lists/${testList.id}/leads`);
          targetLeads = leadsRes.data;
        } else if (selectedCampaignId) {
          const leadsRes = await api.get(`/campaigns/${selectedCampaignId}/leads`);
          targetLeads = leadsRes.data;
        }

        setLeads(targetLeads);
        if (targetLeads.length > 0) {
          // Try to find the admin lead first
          const sahed = targetLeads.find(l => l.email === 'sahedalomsumit@gmail.com');
          if (sahed) {
            setSelectedLeadId(sahed.id);
            setTestLead(sahed);
          } else {
            setSelectedLeadId(targetLeads[0].id);
            setTestLead(targetLeads[0]);
          }
        }
      } catch (err) {
        console.error('Error fetching preview leads:', err);
      }
    };

    fetchLeadsForPreview();
  }, [selectedCampaignId]);

  const handleLeadChange = (e) => {
    const leadId = e.target.value;
    setSelectedLeadId(leadId);
    const lead = leads.find(l => l.id === leadId);
    setTestLead(lead);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const c = campaigns.find(c => c.id === selectedCampaignId);
      await api.put(`/campaigns/${selectedCampaignId}`, {
        ...c,
        templates: templates
      });
      fetchCampaigns();
    } catch (err) {
      alert('Save failed');
    } finally {
      setSaving(false);
    }
  };

  const handleSendTest = async () => {
    if (!testEmail) return alert('Enter a test email');
    if (!selectedCampaignId) return alert('Please select a campaign first');
    
    try {
      const campaign = campaigns.find(c => c.id === selectedCampaignId);
      if (!campaign) return alert('Campaign not found');
      
      await api.post('/send-test', {
        email: testEmail,
        leadData: testLead, // Send the full lead data for placeholders
        subject: templates[selectedType].subject,
        body: templates[selectedType].body,
        fromEmail: campaign?.from_email,
        fromName: campaign?.sender_name
      });
      alert('Test email sent!');
    } catch (err) {
      console.error(err);
      const errorMsg = err.response?.data?.error;
      const displayMsg = typeof errorMsg === 'object' ? JSON.stringify(errorMsg) : (errorMsg || err.message);
      alert('Test send failed: ' + displayMsg);
    }
  };

  const replaceTags = (text) => {
    if (!text) return '';
    const lead = testLead || {
      name: 'Sahed Alom Sumit',
      company: 'OutreachOS',
      email: 'sahedalomsumit@gmail.com',
      website: 'outreachos.com',
      phone: '+880123456789',
      reviews: 150,
      review_score: 4.9,
      instagram: '@sahedalom',
      linkedin: 'linkedin.com/in/sahedalom'
    };

    return text
      .replace(/{{company}}/g, `<span class="text-primary font-bold">${lead.company || 'Company'}</span>`)
      .replace(/{{email}}/g, `<span class="text-primary font-bold">${lead.email || 'email@example.com'}</span>`)
      .replace(/{{phone}}/g, `<span class="text-primary font-bold">${lead.phone || 'Phone'}</span>`)
      .replace(/{{website}}/g, `<span class="text-primary font-bold">${lead.website || 'website.com'}</span>`)
      .replace(/{{reviews}}/g, `<span class="text-primary font-bold">${lead.reviews || '0'}</span>`)
      .replace(/{{review_score}}/g, `<span class="text-primary font-bold">${lead.review_score || '0.0'}</span>`)
      .replace(/{{instagram}}/g, `<span class="text-primary font-bold">${lead.instagram || 'Instagram'}</span>`)
      .replace(/{{facebook}}/g, `<span class="text-primary font-bold">${lead.facebook || 'Facebook'}</span>`)
      .replace(/{{linkedin}}/g, `<span class="text-primary font-bold">${lead.linkedin || 'LinkedIn'}</span>`);
  };

  const renderPreview = (text) => {
    return replaceTags(text).replace(/\n/g, '<br/>');
  };

  const insertFormat = (before, after = '') => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = templates[selectedType].body;
    const selectedText = text.substring(start, end);
    
    const newBody = text.substring(0, start) + before + selectedText + after + text.substring(end);
    
    setTemplates({
      ...templates, 
      [selectedType]: {
        ...templates[selectedType], 
        body: newBody
      }
    });

    // Re-focus after state update
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + before.length, end + before.length);
    }, 0);
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-700">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h2 className="text-2xl md:text-3xl font-extrabold text-white mb-2">Email Templates</h2>
          <p className="text-gray-400 text-sm">Design and preview your outreach sequences.</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
          <select 
            value={selectedCampaignId} 
            onChange={(e) => setSelectedCampaignId(e.target.value)}
            className="input bg-card/80 border-border/50 text-white font-sans w-full"
          >
            {campaigns.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          {isAdmin && (
            <button 
              disabled={saving || !selectedCampaignId}
              onClick={handleSave}
              className="btn btn-primary flex items-center gap-2 justify-center"
            >
              <Save size={18} /> {saving ? 'Saving...' : 'Save Templates'}
            </button>
          )}
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Editor */}
        <div className="space-y-6">
          <div className="flex gap-2 p-1 bg-card rounded-xl border border-border w-fit">
            {['initial', 'follow_up_1', 'follow_up_2'].map(type => (
              <button
                key={type}
                onClick={() => setSelectedType(type)}
                className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${
                  selectedType === type ? 'bg-primary text-white shadow-lg' : 'text-gray-500 hover:text-white'
                }`}
              >
                {type.replace('_', ' ')}
              </button>
            ))}
          </div>

          <div className="glass rounded-2xl p-6 space-y-6">
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Subject Line</label>
              <input 
                className="input w-full text-base font-sans" 
                placeholder="Email Subject"
                value={templates[selectedType].subject}
                onChange={e => setTemplates({...templates, [selectedType]: {...templates[selectedType], subject: e.target.value}})}
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Email Body</label>
                <div className="flex gap-1 bg-card/50 p-1 rounded-lg border border-border/50">
                  <button 
                    type="button"
                    onClick={() => insertFormat('<b>', '</b>')}
                    className="p-1.5 rounded-md hover:bg-primary/20 text-gray-400 hover:text-primary transition-all"
                    title="Bold"
                  >
                    <Bold size={14} />
                  </button>
                  <button 
                    type="button"
                    onClick={() => insertFormat('<i>', '</i>')}
                    className="p-1.5 rounded-md hover:bg-primary/20 text-gray-400 hover:text-primary transition-all"
                    title="Italic"
                  >
                    <Italic size={14} />
                  </button>
                  <button 
                    type="button"
                    onClick={() => insertFormat('\n<ul>\n  <li>', '</li>\n</ul>')}
                    className="p-1.5 rounded-md hover:bg-primary/20 text-gray-400 hover:text-primary transition-all"
                    title="Bullet Points"
                  >
                    <List size={14} />
                  </button>
                  <button 
                    type="button"
                    onClick={() => {
                      const url = prompt('Enter URL:', 'https://');
                      if (url) insertFormat(`<a href="${url}" style="color: #3b82f6; text-decoration: underline;">`, '</a>');
                    }}
                    className="p-1.5 rounded-md hover:bg-primary/20 text-gray-400 hover:text-primary transition-all"
                    title="Hyperlink"
                  >
                    <LinkIcon size={14} />
                  </button>
                </div>
              </div>
              <textarea 
                ref={textareaRef}
                rows="12"
                className="input w-full text-sm leading-relaxed" 
                placeholder="Write your email here..."
                value={templates[selectedType].body}
                onChange={e => setTemplates({...templates, [selectedType]: {...templates[selectedType], body: e.target.value}})}
              />
            </div>
            <div className="flex flex-col gap-2 p-3 bg-primary/5 rounded-xl border border-primary/10 text-[10px] text-primary">
              <div className="flex items-center gap-2">
                <Code size={12} />
                <span className="font-bold uppercase">Available tags:</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-1 opacity-80">
                <span>{"{{company}}"}</span>
                <span>{"{{email}}"}</span>
                <span>{"{{phone}}"}</span>
                <span>{"{{website}}"}</span>
                <span>{"{{reviews}}"}</span>
                <span>{"{{review_score}}"}</span>
                <span>{"{{instagram}}"}</span>
                <span>{"{{facebook}}"}</span>
                <span>{"{{linkedin}}"}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Preview */}
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-lg flex items-center gap-2">
              <Eye size={20} className="text-primary" /> Live Preview
            </h3>
            <div className="flex gap-2">
              <select 
                value={selectedLeadId} 
                onChange={handleLeadChange}
                className="text-xs bg-card border border-border rounded-lg px-2 py-1 text-gray-400 outline-none focus:border-primary transition-all max-w-[200px]"
              >
                <option value="">Select Preview Lead</option>
                {leads.map(l => (
                  <option key={l.id} value={l.id}>{l.email} ({l.company || 'No Company'})</option>
                ))}
              </select>
            </div>
          </div>
          
          <div className="glass rounded-2xl p-8 min-h-[400px] border-primary/10 relative">
            <div className="absolute top-4 right-4">
              <span className="badge bg-primary/10 text-primary">Desktop View</span>
            </div>
            <div className="mb-6 pb-6 border-b border-border">
              <p className="text-xs text-gray-500 mb-1">To: <span className="text-gray-300">Test Lead (test@example.com)</span></p>
              <div 
                className="text-sm font-bold text-white mt-4"
                dangerouslySetInnerHTML={{ __html: replaceTags(templates[selectedType].subject) || 'No Subject' }}
              />
            </div>
            <div 
              className="text-sm text-gray-300 leading-relaxed font-sans"
              dangerouslySetInnerHTML={{ __html: renderPreview(templates[selectedType].body || 'No content yet...') }}
            />
          </div>

          <div className="glass rounded-2xl p-6 space-y-4 border-amber-500/20">
            <h4 className="text-sm font-bold flex items-center gap-2 text-amber-500">
              <Send size={16} /> Send Test
            </h4>
            <div className="flex flex-col sm:flex-row gap-2">
              <input 
                className="input flex-1" 
                placeholder="Enter test email..." 
                type="email"
                value={testEmail}
                onChange={e => setTestEmail(e.target.value)}
              />
              {isAdmin && (
                <button 
                  disabled={!selectedCampaignId}
                  onClick={handleSendTest} 
                  className="btn btn-secondary px-6 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Send
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Templates;
