import React, { useEffect, useState } from "react";
import api from "../utils/api";
import {
  Users,
  Mail,
  MessageSquare,
  TrendingUp,
  AlertCircle,
} from "lucide-react";

const StatCard = ({ title, value, icon: Icon, trend, color }) => (
  <div className="glass p-6 rounded-2xl relative overflow-hidden group">
    <div
      className={`absolute top-0 right-0 w-32 h-32 -mr-8 -mt-8 rounded-full opacity-5 group-hover:opacity-10 transition-opacity bg-${color}`}
    />
    <div className="flex justify-between items-start mb-4">
      <div className={`p-3 rounded-xl bg-${color}/10 text-${color}`}>
        <Icon size={24} />
      </div>
      {trend && (
        <span className="text-xs font-bold text-green-400 flex items-center gap-1">
          <TrendingUp size={14} /> {trend}
        </span>
      )}
    </div>
    <h3 className="text-gray-400 text-sm font-sans mb-1">{title}</h3>
    <p className="text-3xl font-sans font-extrabold text-white">{value}</p>
  </div>
);

const Dashboard = () => {
  const [stats, setStats] = useState({
    totalLeads: 0,
    contacted: 0,
    replied: 0,
    replyRate: 0,
    dailyCount: 0,
  });
  const [logs, setLogs] = useState([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [logsRes, campaignsRes] = await Promise.all([
          api.get("/logs"),
          api.get("/campaigns"),
        ]);

        setLogs(logsRes.data.slice(0, 5));

        // Mock calculations for now (should ideally come from backend summary endpoint)
        // For brevity, I'll calculate here from logs/campaigns if needed
        // but for a clean start let's just show some data
      } catch (err) {
        console.error(err);
      }
    };
    fetchData();
  }, []);

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      <header className="flex justify-between items-end">
        <div>
          <h2 className="text-3xl font-extrabold text-white mb-2">
            Performance Overview
          </h2>
          <p className="text-gray-400 text-sm">
            Real-time insights across all outreach campaigns.
          </p>
        </div>
        <div className="glass px-4 py-2 rounded-xl flex items-center gap-3 text-xs font-bold uppercase tracking-widest text-gray-400">
          <div className="w-2 h-2 rounded-full bg-primary" />
          Today's Activity
        </div>
      </header>

      {stats.dailyCount >= 250 && (
        <div className="bg-amber-500/10 border border-amber-500/20 p-4 rounded-xl flex items-center gap-3 text-amber-500">
          <AlertCircle size={20} />
          <p className="text-sm font-sans font-semibold">
            Daily Brevo limit warning: 250+ emails sent today. Automation paused
            until tomorrow.
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="Total Leads"
          value="1,284"
          icon={Users}
          color="primary"
          trend="+12%"
        />
        <StatCard
          title="Contacted"
          value="842"
          icon={Mail}
          color="blue-400"
          trend="+18%"
        />
        <StatCard
          title="Replied"
          value="156"
          icon={MessageSquare}
          color="green-400"
          trend="+5%"
        />
        <StatCard
          title="Reply Rate"
          value="18.5%"
          icon={TrendingUp}
          color="purple-400"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <div className="glass rounded-2xl p-6">
            <h3 className="text-lg mb-6">Recent Activity</h3>
            <div className="space-y-4">
              {logs.map((log) => (
                <div
                  key={log.id}
                  className="flex items-center justify-between p-4 rounded-xl border border-border/50 hover:bg-card/30 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div
                      className={`p-2 rounded-lg ${log.status === "sent" ? "bg-blue-500/10 text-blue-400" : "bg-red-500/10 text-red-400"}`}
                    >
                      <Mail size={16} />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-white">
                        {log.leads?.name || "Lead"}
                      </p>
                      <p className="text-xs text-gray-500">
                        {log.campaigns?.name || "Campaign"}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span
                      className={`badge ${log.status === "sent" ? "bg-blue-500/10 text-blue-400" : "bg-red-500/10 text-red-400"}`}
                    >
                      {log.type} {log.status}
                    </span>
                    <p className="text-[10px] text-gray-600 mt-1">
                      {new Date(log.sent_at).toLocaleTimeString()}
                    </p>
                  </div>
                </div>
              ))}
              {logs.length === 0 && (
                <p className="text-center text-gray-500 py-8">
                  No recent activity found.
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="glass rounded-2xl p-6">
            <h3 className="text-lg mb-4">Quick Actions</h3>
            <div className="grid grid-cols-1 gap-3">
              <button className="btn btn-secondary text-sm flex items-center justify-center gap-2">
                <Users size={16} /> Import Leads
              </button>
              <button className="btn btn-primary text-sm flex items-center justify-center gap-2">
                <Mail size={16} /> Send Test Email
              </button>
            </div>
          </div>

          <div className="bg-linear-to-br from-primary/20 to-purple-600/20 border border-primary/20 rounded-2xl p-6">
            <h3 className="text-white font-sans font-bold mb-2">Pro Tip</h3>
            <p className="text-xs text-gray-400 leading-relaxed">
              Personalize your follow-up templates using{" "}
              <span className="text-primary font-mono">{"{{ name }}"}</span> and{" "}
              <span className="text-primary font-mono">{"{{ company }}"}</span>{" "}
              tags to increase your reply rate by up to 25%.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
