import React, { useState, useEffect } from 'react';
import { HashRouter as Router, Routes, Route, Link, useLocation, Navigate } from 'react-router-dom';
import { LayoutDashboard, Megaphone, FileText, Activity, LogOut, Loader2, Menu, X, Users } from 'lucide-react';
import { AuthProvider, useAuth } from './context/AuthContext';
import Auth from './pages/Auth';
import Dashboard from './pages/Dashboard';
import Campaigns from './pages/Campaigns';
import CampaignDetail from './pages/CampaignDetail';
import Leads from './pages/Leads';
import Templates from './pages/Templates';
import Logs from './pages/Logs';
import Settings from './pages/Settings';
import { Settings as SettingsIcon } from 'lucide-react';

const SidebarLink = ({ to, icon: Icon, children, onClick }) => {
  const location = useLocation();
  const isActive = location.pathname === to;
  
  return (
    <Link
      to={to}
      onClick={onClick}
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
  const { logout, user } = useAuth();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const location = useLocation();

  // Close sidebar when route changes on mobile
  useEffect(() => {
    setIsSidebarOpen(false);
  }, [location]);

  return (
    <div className="flex min-h-screen bg-background">
      {/* Mobile Header */}
      <div className="lg:hidden fixed top-0 left-0 right-0 h-16 bg-background/80 backdrop-blur-md border-b border-border z-40 px-4 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2">
          <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center shadow-[0_0_15px_rgba(59,130,246,0.5)]">
            <Megaphone size={16} className="text-white" />
          </div>
          <h1 className="text-lg font-sans font-extrabold tracking-tighter text-white">Outreach<span className="text-primary">OS</span></h1>
        </Link>
        <button 
          onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          className="p-2 text-gray-400 hover:text-white transition-colors"
        >
          {isSidebarOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {/* Sidebar Backdrop */}
      {isSidebarOpen && (
        <div 
          className="lg:hidden fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed lg:sticky top-0 left-0 z-50 h-screen w-64 border-r border-border p-6 flex flex-col gap-8 bg-background transition-transform duration-300
        ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        <Link to="/" className="hidden lg:flex items-center gap-3 px-2 hover:opacity-80 transition-opacity">
          <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center shadow-[0_0_15px_rgba(59,130,246,0.5)]">
            <Megaphone size={18} className="text-white" />
          </div>
          <h1 className="text-xl font-sans font-extrabold tracking-tighter text-white">Outreach<span className="text-primary">OS</span></h1>
        </Link>

        <nav className="flex flex-col gap-2 mt-4 lg:mt-0">
          <SidebarLink to="/" icon={LayoutDashboard}>Dashboard</SidebarLink>
          <SidebarLink to="/campaigns" icon={Megaphone}>Campaigns</SidebarLink>
          <SidebarLink to="/leads" icon={Users}>Leads</SidebarLink>
          <SidebarLink to="/templates" icon={FileText}>Templates</SidebarLink>
          <SidebarLink to="/logs" icon={Activity}>Activity Logs</SidebarLink>
          <SidebarLink to="/settings" icon={SettingsIcon}>Settings</SidebarLink>
        </nav>

        <div className="mt-auto space-y-4">
          <div className="p-4 glass rounded-2xl">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              <span className="text-[10px] uppercase tracking-widest font-bold text-gray-500">System Status</span>
            </div>
            <p className="text-xs text-gray-400 leading-relaxed">Logged in as: <br/><span className="text-white font-bold truncate block">{user?.email}</span></p>
          </div>

          <button 
            onClick={() => logout()}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-gray-400 hover:bg-red-500/10 hover:text-red-500 transition-all duration-200 font-sans font-semibold text-sm"
          >
            <LogOut size={20} />
            Logout
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-4 md:p-8 pt-20 lg:pt-8 overflow-y-auto">
        <div className="max-w-7xl mx-auto">
          {children}
        </div>
      </main>
    </div>
  );
};

const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth();
  
  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="animate-spin text-primary" size={40} />
      </div>
    );
  }
  
  if (!user) return <Navigate to="/auth" />;
  
  return <Layout>{children}</Layout>;
};

function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/auth" element={<Auth />} />
          <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          <Route path="/campaigns" element={<ProtectedRoute><Campaigns /></ProtectedRoute>} />
          <Route path="/campaigns/:id" element={<ProtectedRoute><CampaignDetail /></ProtectedRoute>} />
          <Route path="/leads" element={<ProtectedRoute><Leads /></ProtectedRoute>} />
          <Route path="/templates" element={<ProtectedRoute><Templates /></ProtectedRoute>} />
          <Route path="/logs" element={<ProtectedRoute><Logs /></ProtectedRoute>} />
          <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;

