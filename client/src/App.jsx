import React from 'react';
import { HashRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, Megaphone, FileText, Activity, Settings } from 'lucide-react';
import Dashboard from './pages/Dashboard';
import Campaigns from './pages/Campaigns';
import CampaignDetail from './pages/CampaignDetail';
import Templates from './pages/Templates';
import Logs from './pages/Logs';

const SidebarLink = ({ to, icon: Icon, children }) => {
  const location = useLocation();
  const isActive = location.pathname === to;
  
  return (
    <Link
      to={to}
      className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group ${
        isActive 
          ? 'bg-primary text-white shadow-[0_0_20px_rgba(59,130,246,0.3)]' 
          : 'text-gray-400 hover:bg-card hover:text-white'
      }`}
    >
      <Icon size={20} className={isActive ? 'text-white' : 'text-gray-500 group-hover:text-primary'} />
      <span className="font-sans font-semibold tracking-wide text-sm">{children}</span>
    </Link>
  );
};

const Layout = ({ children }) => {
  return (
    <div className="flex min-h-screen bg-background">
      {/* Sidebar */}
      <aside className="w-64 border-r border-border p-6 flex flex-col gap-8 sticky top-0 h-screen">
        <div className="flex items-center gap-3 px-2">
          <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center shadow-[0_0_15px_rgba(59,130,246,0.5)]">
            <Megaphone size={18} className="text-white" />
          </div>
          <h1 className="text-xl font-sans font-extrabold tracking-tighter text-white">Outreach<span className="text-primary">OS</span></h1>
        </div>

        <nav className="flex flex-col gap-2">
          <SidebarLink to="/" icon={LayoutDashboard}>Dashboard</SidebarLink>
          <SidebarLink to="/campaigns" icon={Megaphone}>Campaigns</SidebarLink>
          <SidebarLink to="/templates" icon={FileText}>Templates</SidebarLink>
          <SidebarLink to="/logs" icon={Activity}>Activity Logs</SidebarLink>
        </nav>

        <div className="mt-auto p-4 glass rounded-2xl">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            <span className="text-[10px] uppercase tracking-widest font-bold text-gray-500">System Status</span>
          </div>
          <p className="text-xs text-gray-400 leading-relaxed">Daily Limit: <span className="text-white font-bold">250</span> emails</p>
          <div className="mt-2 h-1 w-full bg-border rounded-full overflow-hidden">
            <div className="h-full bg-primary w-1/3 rounded-full" />
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-8 overflow-y-auto">
        {children}
      </main>
    </div>
  );
};

function App() {
  return (
    <Router>
      <Layout>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/campaigns" element={<Campaigns />} />
          <Route path="/campaigns/:id" element={<CampaignDetail />} />
          <Route path="/templates" element={<Templates />} />
          <Route path="/logs" element={<Logs />} />
        </Routes>
      </Layout>
    </Router>
  );
}

export default App;
