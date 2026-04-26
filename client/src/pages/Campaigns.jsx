import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../utils/api";
import { supabase } from "../utils/supabase";
import { useAuth } from "../context/AuthContext";
import {
  Plus,
  Play,
  Pause,
  Edit2,
  Trash2,
  ChevronRight,
  Mail,
  Users,
  Megaphone,
  PlayCircle,
} from "lucide-react";

const CampaignCard = ({ campaign, onToggle, onDelete, onRun }) => {
  const navigate = useNavigate();
  const { isSuperAdmin } = useAuth();

  return (
    <div className="glass p-6 rounded-2xl group hover:border-primary/30 transition-all duration-300">
      <div className="flex justify-between items-start mb-6">
        <div>
          <h3 className="text-xl font-sans font-extrabold text-white mb-1 group-hover:text-primary transition-colors">
            {campaign.name}
          </h3>
          <p className="text-xs text-gray-500 font-mono">
            From: {campaign.sender_name} ({campaign.from_email})
          </p>
        </div>
        <span
          className={`badge ${campaign.active ? "bg-green-500/10 text-green-400" : "bg-gray-500/10 text-gray-400"}`}
        >
          {campaign.active ? "Active" : "Paused"}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="bg-card/50 p-3 rounded-xl border border-border/50">
          <p className="text-[10px] text-gray-500 uppercase font-bold tracking-wider mb-1">
            Delays
          </p>
          <p className="text-sm font-bold text-white">
            Day {Array.isArray(campaign.follow_up_delays) ? campaign.follow_up_delays.join(", ") : "N/A"}
          </p>
        </div>
        <div className="bg-card/50 p-3 rounded-xl border border-border/50">
          <p className="text-[10px] text-gray-500 uppercase font-bold tracking-wider mb-1">
            Max Follow-ups
          </p>
          <p className="text-sm font-bold text-white">
            {campaign.max_follow_ups}
          </p>
        </div>
      </div>

      <div className="flex items-center justify-between pt-4 border-t border-border">
        {isSuperAdmin && (
          <div className="flex gap-2">
            <button
              onClick={() => onToggle(campaign)}
              title={campaign.active ? "Pause Campaign" : "Activate Campaign"}
              className={`p-2 rounded-lg border border-border hover:border-primary transition-colors ${campaign.active ? "text-amber-500" : "text-green-500"}`}
            >
              {campaign.active ? <Pause size={18} /> : <Play size={18} />}
            </button>
            <button
              onClick={() => onRun(campaign)}
              title="Run Campaign Now"
              className="p-2 rounded-lg border border-border hover:border-primary text-primary transition-colors"
            >
              <PlayCircle size={18} />
            </button>
          </div>
        )}
        <button
          onClick={() => navigate(`/campaigns/${campaign.id}`)}
          className="btn btn-primary py-2 px-4 text-xs flex items-center gap-2"
        >
          View Campaign <ChevronRight size={14} />
        </button>
      </div>
    </div>
  );
};

const Campaigns = () => {
  const { isAdmin, isSuperAdmin, user } = useAuth();
  const [campaigns, setCampaigns] = useState([]);
  const [leadLists, setLeadLists] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [newCampaign, setNewCampaign] = useState({
    name: "",
    sender_name: "",
    from_email: "hello@outreach.sahedalomsumit.com",
    follow_up_delays: [3, 7],
    max_follow_ups: 2,
    lead_list_ids: [],
    templates: {
      initial: {
        subject: "Quick question for {{name}}",
        body: "Hi {{name}},\n\nI saw what you are doing at {{company}}...",
      },
      follow_up_1: {
        subject: "Re: Quick question",
        body: "Just following up on my previous email...",
      },
      follow_up_2: {
        subject: "Checking in",
        body: "Wanted to bubble this to the top...",
      },
    },
  });

  const fetchCampaigns = async () => {
    try {
      const res = await api.get("/campaigns");
      setCampaigns(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchCampaigns();
    api.get('/lead-lists').then(res => setLeadLists(res.data)).catch(console.error);

    // Set up real-time subscription for "sync everywhere"
    const channel = supabase
      .channel('campaigns-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'campaigns'
        },
        () => {
          fetchCampaigns();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    if (showModal && user) {
      setNewCampaign({
        name: "",
        sender_name: user.user_metadata?.full_name || "",
        from_email: user.email || "hello@outreach.sahedalomsumit.com",
        follow_up_delays: [3, 7],
        max_follow_ups: 2,
        lead_list_ids: [],
        templates: {
          initial: {
            subject: "Quick question for {{name}}",
            body: "Hi {{name}},\n\nI saw what you are doing at {{company}}...",
          },
          follow_up_1: {
            subject: "Re: Quick question",
            body: "Just following up on my previous email...",
          },
          follow_up_2: {
            subject: "Checking in",
            body: "Wanted to bubble this to the top...",
          },
        },
      });
    }
  }, [showModal, user]);

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      await api.post("/campaigns", newCampaign);
      setShowModal(false);
      fetchCampaigns();
    } catch (err) {
      console.error(err);
    }
  };

  const handleToggle = async (campaign) => {
    try {
      const endpoint = campaign.active
        ? `/campaigns/${campaign.id}/pause`
        : `/campaigns/${campaign.id}/activate`;
      await api.post(endpoint);
      fetchCampaigns();
    } catch (err) {
      console.error(err);
    }
  };

  const handleRun = async (campaign) => {
    if (!window.confirm(`Immediately process leads for "${campaign.name}"?`)) return;
    try {
      const res = await api.post(`/campaigns/${campaign.id}/run`);
      alert(`Processed ${res.data.processed} emails. Errors: ${res.data.errors}`);
      fetchCampaigns();
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.error || 'Failed to run campaign');
    }
  };

  const handleDelete = async (id) => {
    if (
      !window.confirm(
        "Are you sure you want to delete this campaign and all its leads?",
      )
    )
      return;
    try {
      await api.delete(`/campaigns/${id}`);
      fetchCampaigns();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="space-y-8 animate-in slide-in-from-bottom-4 duration-700">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl md:text-3xl font-extrabold text-white mb-2">Campaigns</h2>
          <p className="text-gray-400 text-sm">
            Manage and automate your outreach sequences.
          </p>
        </div>
        {isAdmin && (
          <button
            onClick={() => setShowModal(true)}
            className="btn btn-primary flex items-center gap-2 w-full md:w-auto justify-center"
          >
            <Plus size={20} /> Create Campaign
          </button>
        )}
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {campaigns.map((c) => (
          <CampaignCard
            key={c.id}
            campaign={c}
            onToggle={handleToggle}
            onDelete={handleDelete}
            onRun={handleRun}
          />
        ))}
        {campaigns.length === 0 && (
          <div className="col-span-full py-20 flex flex-col items-center justify-center glass rounded-3xl border-dashed">
            <Megaphone size={48} className="text-gray-600 mb-4" />
            <p className="text-gray-500 font-sans">
              No campaigns found. Start by creating one!
            </p>
          </div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="glass w-full max-w-2xl rounded-3xl p-6 md:p-8 max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl md:text-2xl mb-6">Create New Campaign</h3>
            <form onSubmit={handleCreate} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">
                    Campaign Name
                  </label>
                  <input
                    required
                    className="input w-full"
                    placeholder="e.g. Q2 SaaS Outreach"
                    value={newCampaign.name}
                    onChange={(e) =>
                      setNewCampaign({ ...newCampaign, name: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">
                    Sender Name
                  </label>
                  <input
                    required
                    className="input w-full"
                    placeholder="e.g. John Doe"
                    value={newCampaign.sender_name}
                    onChange={(e) =>
                      setNewCampaign({
                        ...newCampaign,
                        sender_name: e.target.value,
                      })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">
                    From Email
                  </label>
                  <input
                    required
                    type="email"
                    className="input w-full"
                    placeholder="john@example.com"
                    value={newCampaign.from_email}
                    onChange={(e) =>
                      setNewCampaign({
                        ...newCampaign,
                        from_email: e.target.value,
                      })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">
                    Max Follow-ups
                  </label>
                  <input
                    type="number"
                    className="input w-full"
                    value={newCampaign.max_follow_ups}
                    onChange={(e) =>
                      setNewCampaign({
                        ...newCampaign,
                        max_follow_ups: parseInt(e.target.value),
                      })
                    }
                  />
                </div>
              </div>

              <div className="space-y-3">
                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">
                  Select Lead Lists
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-40 overflow-y-auto p-4 bg-card/30 rounded-2xl border border-border">
                  {leadLists.map(list => (
                    <label key={list.id} className="flex items-center gap-3 p-2 hover:bg-card/50 rounded-lg cursor-pointer transition-colors">
                      <input 
                        type="checkbox"
                        className="w-4 h-4 rounded border-gray-600 bg-background text-primary focus:ring-primary/20"
                        checked={newCampaign.lead_list_ids.includes(list.id)}
                        onChange={(e) => {
                          const ids = e.target.checked 
                            ? [...newCampaign.lead_list_ids, list.id]
                            : newCampaign.lead_list_ids.filter(id => id !== list.id);
                          setNewCampaign({ ...newCampaign, lead_list_ids: ids });
                        }}
                      />
                      <span className="text-sm text-gray-300 truncate">{list.name}</span>
                    </label>
                  ))}
                  {leadLists.length === 0 && (
                    <p className="col-span-full text-xs text-gray-500 italic">No lead lists found. Create one in the Leads page first.</p>
                  )}
                </div>
              </div>

              <div className="flex flex-col sm:flex-row justify-end gap-3 pt-6 border-t border-border">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="btn btn-secondary w-full sm:w-auto"
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary w-full sm:w-auto">
                  Create Campaign
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Campaigns;
