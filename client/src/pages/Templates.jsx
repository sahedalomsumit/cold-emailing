import React, { useEffect, useState } from 'react';
import api from '../utils/api';
import { Save, Eye, Send, Code, AlertCircle } from 'lucide-react';
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
  const [testEmail, setTestEmail] = useState('');

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
  }, []);

  useEffect(() => {
    const c = campaigns.find(c => c.id === selectedCampaignId);
    if (c) setTemplates(c.templates);
  }, [selectedCampaignId]);

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
    try {
      await api.post('/send-test', {
        email: testEmail,
        name: 'Test Lead',
        company: 'Test Company',
        subject: templates[selectedType].subject,
        body: templates[selectedType].body
      });
      alert('Test email sent!');
    } catch (err) {
      alert('Test send failed');
    }
  };

  const renderPreview = (text) => {
    return text
      .replace(/{{name}}/g, '<span class="text-primary font-bold">Test Lead</span>')
      .replace(/{{company}}/g, '<span class="text-primary font-bold">Test Company</span>')
      .replace(/{{email}}/g, '<span class="text-primary font-bold">test@example.com</span>')
      .replace(/{{phone}}/g, '<span class="text-primary font-bold">+1 234 567 890</span>')
      .replace(/{{website}}/g, '<span class="text-primary font-bold">example.com</span>')
      .replace(/{{reviews}}/g, '<span class="text-primary font-bold">120</span>')
      .replace(/{{review_score}}/g, '<span class="text-primary font-bold">4.8</span>')
      .replace(/{{instagram}}/g, '<span class="text-primary font-bold">@test_insta</span>')
      .replace(/{{linkedin}}/g, '<span class="text-primary font-bold">linkedin.com/in/test</span>')
      .replace(/\n/g, '<br/>');
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
              <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Email Body</label>
              <textarea 
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
                <span>{"{{name}}"}</span>
                <span>{"{{company}}"}</span>
                <span>{"{{email}}"}</span>
                <span>{"{{phone}}"}</span>
                <span>{"{{website}}"}</span>
                <span>{"{{reviews}}"}</span>
                <span>{"{{review_score}}"}</span>
                <span>{"{{instagram}}"}</span>
                <span>{"{{facebook}}"}</span>
                <span>{"{{twitter}}"}</span>
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
          </div>
          
          <div className="glass rounded-2xl p-8 min-h-[400px] border-primary/10 relative">
            <div className="absolute top-4 right-4">
              <span className="badge bg-primary/10 text-primary">Desktop View</span>
            </div>
            <div className="mb-6 pb-6 border-b border-border">
              <p className="text-xs text-gray-500 mb-1">To: <span className="text-gray-300">Test Lead (test@example.com)</span></p>
              <p className="text-sm font-bold text-white mt-4">{templates[selectedType].subject || 'No Subject'}</p>
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
                <button onClick={handleSendTest} className="btn btn-secondary px-6">Send</button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Templates;
