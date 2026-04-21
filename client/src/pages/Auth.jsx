import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Navigate } from 'react-router-dom';
import { Mail, Lock, User, ArrowRight, Loader2, Megaphone } from 'lucide-react';
import { Link } from 'react-router-dom';

const Auth = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const { login, signup, user, loading: authLoading } = useAuth();

  if (!authLoading && user) {
    return <Navigate to="/" />;
  }

  const [formData, setFormData] = useState({
    email: '',
    password: '',
    fullName: '',
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (isLogin) {
        const { error } = await login(formData.email, formData.password);
        if (error) throw error;
      } else {
        const { error } = await signup(formData.email, formData.password, formData.fullName);
        if (error) throw error;
        alert('Check your email for the confirmation link!');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <div className="w-full max-w-md animate-in fade-in zoom-in duration-500">
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex items-center gap-3 mb-8 hover:opacity-80 transition-opacity">
            <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center shadow-[0_0_20px_rgba(59,130,246,0.4)]">
              <Megaphone size={22} className="text-white" />
            </div>
            <h1 className="text-2xl font-sans font-extrabold tracking-tighter text-white">Outreach<span className="text-primary">OS</span></h1>
          </Link>
          <h2 className="text-3xl font-extrabold text-white tracking-tight">
            {isLogin ? 'Welcome Back' : 'Create Account'}
          </h2>
          <p className="text-gray-400 mt-2">
            {isLogin ? 'Sign in to manage your outreach' : 'Start your outreach journey today'}
          </p>
        </div>

        <div className="glass p-8 rounded-3xl border border-white/5">
          <form onSubmit={handleSubmit} className="space-y-4">
            {!isLogin && (
              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-400 uppercase tracking-widest ml-1">Full Name</label>
                <div className="relative group">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-primary transition-colors" size={18} />
                  <input
                    type="text"
                    required
                    placeholder="John Doe"
                    className="w-full bg-card/50 border border-border rounded-xl py-3 pl-10 pr-4 text-white focus:outline-hidden focus:ring-2 focus:ring-primary/50 transition-all"
                    value={formData.fullName}
                    onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                  />
                </div>
              </div>
            )}

            <div className="space-y-1">
              <label className="text-xs font-bold text-gray-400 uppercase tracking-widest ml-1">Email Address</label>
              <div className="relative group">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-primary transition-colors" size={18} />
                <input
                  type="email"
                  required
                  placeholder="name@company.com"
                  className="w-full bg-card/50 border border-border rounded-xl py-3 pl-10 pr-4 text-white focus:outline-hidden focus:ring-2 focus:ring-primary/50 transition-all"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-gray-400 uppercase tracking-widest ml-1">Password</label>
              <div className="relative group">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-primary transition-colors" size={18} />
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  className="w-full bg-card/50 border border-border rounded-xl py-3 pl-10 pr-4 text-white focus:outline-hidden focus:ring-2 focus:ring-primary/50 transition-all"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                />
              </div>
            </div>

            {error && (
              <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-500 text-xs font-semibold">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full btn btn-primary py-3 rounded-xl flex items-center justify-center gap-2 group mt-6"
            >
              {loading ? (
                <Loader2 className="animate-spin" size={20} />
              ) : (
                <>
                  {isLogin ? 'Sign In' : 'Create Account'}
                  <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
                </>
              )}
            </button>
          </form>

          <div className="mt-8 pt-6 border-t border-white/5 text-center">
            <button
              onClick={() => setIsLogin(!isLogin)}
              className="text-sm text-gray-400 hover:text-white transition-colors"
            >
              {isLogin ? (
                <>Don't have an account? <span className="text-primary font-bold">Sign Up</span></>
              ) : (
                <>Already have an account? <span className="text-primary font-bold">Sign In</span></>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Auth;
