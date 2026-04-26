import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../utils/api';
import { 
  ArrowLeft, BarChart3, PieChart, TrendingUp, Mail, Users, 
  MessageSquare, AlertCircle, Calendar, RefreshCcw, CheckCircle2,
  XCircle, UserMinus
} from 'lucide-react';

const CampaignReports = () => {
  const { id } = useParams();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [campaign, setCampaign] = useState(null);

  const fetchReports = async () => {
    setLoading(true);
    try {
      const [reportRes, campaignRes] = await Promise.all([
        api.get(`/campaigns/${id}/reports`),
        api.get(`/campaigns/${id}`)
      ]);
      setData(reportRes.data);
      setCampaign(campaignRes.data);
    } catch (err) {
      console.error('Failed to fetch reports:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, [id]);

  if (loading) return <div className="p-8 text-center text-gray-500">Generating dynamic report...</div>;
  if (!data) return <div className="p-8 text-center text-red-500">Failed to load reporting data.</div>;

  const { leadCounts, emailStats, timeline } = data;
  const replyRate = leadCounts.sent > 0 ? ((leadCounts.replied / leadCounts.sent) * 100).toFixed(1) : 0;
  const bounceRate = leadCounts.sent > 0 ? ((leadCounts.bounced / leadCounts.sent) * 100).toFixed(1) : 0;

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link to={`/campaigns/${id}`} className="p-2 rounded-lg bg-card border border-border text-gray-400 hover:text-white transition-colors">
            <ArrowLeft size={20} />
          </Link>
          <div>
            <h2 className="text-2xl font-extrabold text-white">Campaign Analytics</h2>
            <p className="text-gray-400 text-sm">{campaign?.name} • Performance Overview</p>
          </div>
        </div>
        <button onClick={fetchReports} className="btn btn-secondary text-xs flex items-center gap-2">
          <RefreshCcw size={14} /> Refresh Data
        </button>
      </header>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="glass p-6 rounded-3xl border-b-4 border-b-blue-500">
          <div className="flex justify-between items-start mb-4">
            <div className="p-3 rounded-2xl bg-blue-500/10 text-blue-400"><Mail size={24} /></div>
            <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Total Sent</span>
          </div>
          <p className="text-3xl font-black text-white">{leadCounts.sent}</p>
          <p className="text-xs text-gray-500 mt-1">Total unique emails sent</p>
        </div>
        
        <div className="glass p-6 rounded-3xl border-b-4 border-b-green-500">
          <div className="flex justify-between items-start mb-4">
            <div className="p-3 rounded-2xl bg-green-500/10 text-green-400"><MessageSquare size={24} /></div>
            <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Replies</span>
          </div>
          <p className="text-3xl font-black text-white">{leadCounts.replied}</p>
          <p className="text-xs text-green-400 font-bold mt-1">{replyRate}% Reply Rate</p>
        </div>

        <div className="glass p-6 rounded-3xl border-b-4 border-b-red-500">
          <div className="flex justify-between items-start mb-4">
            <div className="p-3 rounded-2xl bg-red-500/10 text-red-400"><AlertCircle size={24} /></div>
            <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Bounces</span>
          </div>
          <p className="text-3xl font-black text-white">{leadCounts.bounced}</p>
          <p className="text-xs text-red-400 font-bold mt-1">{bounceRate}% Bounce Rate</p>
        </div>

        <div className="glass p-6 rounded-3xl border-b-4 border-b-purple-500">
          <div className="flex justify-between items-start mb-4">
            <div className="p-3 rounded-2xl bg-purple-500/10 text-purple-400"><UserMinus size={24} /></div>
            <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Unsubscribes</span>
          </div>
          <p className="text-3xl font-black text-white">{leadCounts.unsubscribed}</p>
          <p className="text-xs text-gray-500 mt-1">Manual removals</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Engagement Funnel */}
        <div className="lg:col-span-1 glass p-8 rounded-3xl flex flex-col gap-6">
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <TrendingUp size={20} className="text-primary" /> Outreach Funnel
          </h3>
          
          <div className="space-y-8 py-4">
            <div className="relative">
              <div className="flex justify-between text-xs font-bold uppercase text-gray-500 mb-2">
                <span>Leads Discovered</span>
                <span className="text-white">{leadCounts.total}</span>
              </div>
              <div className="h-4 w-full bg-card rounded-full overflow-hidden border border-border">
                <div className="h-full bg-gray-400" style={{ width: '100%' }}></div>
              </div>
            </div>

            <div className="relative">
              <div className="flex justify-between text-xs font-bold uppercase text-blue-400 mb-2">
                <span>Outreach Started</span>
                <span className="text-white">{leadCounts.sent}</span>
              </div>
              <div className="h-4 w-full bg-card rounded-full overflow-hidden border border-border">
                <div className="h-full bg-blue-500" style={{ width: `${(leadCounts.sent / (leadCounts.total || 1)) * 100}%` }}></div>
              </div>
              <div className="absolute -left-3 top-1/2 -translate-y-1/2 w-1 h-12 bg-border"></div>
            </div>

            <div className="relative">
              <div className="flex justify-between text-xs font-bold uppercase text-green-400 mb-2">
                <span>Total Replies</span>
                <span className="text-white">{leadCounts.replied}</span>
              </div>
              <div className="h-4 w-full bg-card rounded-full overflow-hidden border border-border">
                <div className="h-full bg-green-500" style={{ width: `${(leadCounts.replied / (leadCounts.sent || 1)) * 100}%` }}></div>
              </div>
              <div className="absolute -left-3 top-1/2 -translate-y-1/2 w-1 h-12 bg-border"></div>
            </div>
          </div>

          <div className="mt-auto p-4 bg-primary/5 rounded-2xl border border-primary/10">
            <p className="text-[10px] text-gray-500 uppercase font-black tracking-widest mb-1">Efficiency Score</p>
            <p className="text-2xl font-black text-primary">{replyRate}%</p>
            <p className="text-[10px] text-gray-400">Response conversion per email sent.</p>
          </div>
        </div>

        {/* Activity Timeline */}
        <div className="lg:col-span-2 glass p-8 rounded-3xl">
          <div className="flex justify-between items-center mb-8">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <Calendar size={20} className="text-primary" /> Last 30 Days Activity
            </h3>
            <div className="flex gap-4 text-[10px] font-bold uppercase text-gray-500">
              <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-blue-500"></div> Sent</div>
              <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-red-500/50"></div> Failed</div>
            </div>
          </div>

          <div className="h-64 flex items-end gap-1 md:gap-2">
            {timeline.map((day, idx) => {
              const max = Math.max(...timeline.map(d => d.sent + d.failed)) || 1;
              const height = ((day.sent + day.failed) / max) * 100;
              const sentHeight = (day.sent / (day.sent + day.failed || 1)) * 100;
              
              return (
                <div key={idx} className="flex-1 group relative h-full flex flex-col justify-end">
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 bg-white text-black text-[10px] font-bold py-1 px-2 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10 pointer-events-none">
                    {day.date}: {day.sent} Sent
                  </div>
                  <div 
                    className="w-full bg-card rounded-t-sm overflow-hidden flex flex-col justify-end transition-all hover:bg-card/80" 
                    style={{ height: `${height}%`, minHeight: height > 0 ? '2px' : '0' }}
                  >
                    <div className="w-full bg-red-500/30" style={{ height: `${100 - sentHeight}%` }}></div>
                    <div className="w-full bg-blue-500" style={{ height: `${sentHeight}%` }}></div>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="flex justify-between mt-4 text-[10px] text-gray-500 font-bold uppercase tracking-tighter">
            <span>30 Days Ago</span>
            <span>Today</span>
          </div>
        </div>
      </div>

      {/* Sequence Breakdown */}
      <div className="glass p-8 rounded-3xl">
        <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
          <RefreshCcw size={20} className="text-primary" /> Sequence Performance
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {Object.entries(emailStats.types).map(([type, count]) => (
            <div key={type} className="p-4 bg-card/30 rounded-2xl border border-border/50">
              <p className="text-[10px] text-gray-500 uppercase font-black tracking-widest mb-2">{type.replace('_', ' ')}</p>
              <div className="flex items-end gap-2">
                <p className="text-2xl font-black text-white">{count}</p>
                <p className="text-xs text-gray-500 mb-1">Emails</p>
              </div>
              <div className="mt-4 h-1 w-full bg-card rounded-full overflow-hidden">
                <div className="h-full bg-primary" style={{ width: `${(count / (emailStats.sent || 1)) * 100}%` }}></div>
              </div>
            </div>
          ))}
          {Object.keys(emailStats.types).length === 0 && (
            <div className="col-span-full py-10 text-center text-gray-500 italic">
              No sequence data available yet.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CampaignReports;
