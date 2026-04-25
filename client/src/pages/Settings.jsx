import React, { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { User, Mail, Lock, Shield, Check, AlertCircle, Loader2 } from "lucide-react";

const Settings = () => {
  const { user, updateProfile, updateEmail, updatePassword } = useAuth();
  
  const [profileData, setProfileData] = useState({
    fullName: user?.user_metadata?.full_name || "",
  });
  
  const [emailData, setEmailData] = useState({
    email: user?.email || "",
  });
  
  const [passwordData, setPasswordData] = useState({
    newPassword: "",
    confirmPassword: "",
  });

  const [loading, setLoading] = useState({
    profile: false,
    email: false,
    password: false,
  });
  
  const [message, setMessage] = useState({
    type: "", // 'success' or 'error'
    text: "",
  });

  const showMessage = (type, text) => {
    setMessage({ type, text });
    setTimeout(() => setMessage({ type: "", text: "" }), 5000);
  };

  const handleProfileUpdate = async (e) => {
    e.preventDefault();
    setLoading(prev => ({ ...prev, profile: true }));
    const { error } = await updateProfile({ full_name: profileData.fullName });
    setLoading(prev => ({ ...prev, profile: false }));
    
    if (error) {
      showMessage("error", error.message);
    } else {
      showMessage("success", "Profile updated successfully!");
    }
  };

  const handleEmailUpdate = async (e) => {
    e.preventDefault();
    setLoading(prev => ({ ...prev, email: true }));
    const { error } = await updateEmail(emailData.email);
    setLoading(prev => ({ ...prev, email: false }));
    
    if (error) {
      showMessage("error", error.message);
    } else {
      showMessage("success", "Confirmation link sent to your new email!");
    }
  };

  const handlePasswordUpdate = async (e) => {
    e.preventDefault();
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      return showMessage("error", "Passwords do not match!");
    }
    
    setLoading(prev => ({ ...prev, password: true }));
    const { error } = await updatePassword(passwordData.newPassword);
    setLoading(prev => ({ ...prev, password: false }));
    
    if (error) {
      showMessage("error", error.message);
    } else {
      showMessage("success", "Password updated successfully!");
      setPasswordData({ newPassword: "", confirmPassword: "" });
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      <header>
        <h2 className="text-2xl md:text-3xl font-extrabold text-white mb-2">
          Account Settings
        </h2>
        <p className="text-gray-400 text-sm">
          Manage your personal information, security, and preferences.
        </p>
      </header>

      {message.text && (
        <div className={`p-4 rounded-xl flex items-center gap-3 animate-in slide-in-from-top duration-300 ${
          message.type === 'success' 
            ? 'bg-green-500/10 border border-green-500/20 text-green-400' 
            : 'bg-red-500/10 border border-red-500/20 text-red-400'
        }`}>
          {message.type === 'success' ? <Check size={20} /> : <AlertCircle size={20} />}
          <p className="text-sm font-sans font-semibold">{message.text}</p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Profile Section */}
        <div className="glass p-8 rounded-3xl relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-32 h-32 -mr-8 -mt-8 rounded-full opacity-5 bg-primary group-hover:opacity-10 transition-opacity" />
          <div className="flex items-center gap-4 mb-8">
            <div className="p-3 rounded-2xl bg-primary/10 text-primary">
              <User size={24} />
            </div>
            <div>
              <h3 className="text-xl font-bold text-white">Public Profile</h3>
              <p className="text-xs text-gray-500">Update your display name.</p>
            </div>
          </div>

          <form onSubmit={handleProfileUpdate} className="space-y-6">
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-widest text-gray-500 ml-1">
                Full Name
              </label>
              <input
                type="text"
                value={profileData.fullName}
                onChange={(e) => setProfileData({ ...profileData, fullName: e.target.value })}
                className="input-field"
                placeholder="Enter your full name"
                required
              />
            </div>
            <button
              type="submit"
              disabled={loading.profile}
              className="btn btn-primary w-full py-4 rounded-2xl flex items-center justify-center gap-2"
            >
              {loading.profile ? (
                <Loader2 size={20} className="animate-spin" />
              ) : (
                "Save Changes"
              )}
            </button>
          </form>
        </div>

        {/* Email Section */}
        <div className="glass p-8 rounded-3xl relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-32 h-32 -mr-8 -mt-8 rounded-full opacity-5 bg-purple-500 group-hover:opacity-10 transition-opacity" />
          <div className="flex items-center gap-4 mb-8">
            <div className="p-3 rounded-2xl bg-purple-500/10 text-purple-400">
              <Mail size={24} />
            </div>
            <div>
              <h3 className="text-xl font-bold text-white">Email Address</h3>
              <p className="text-xs text-gray-500">Change your login email.</p>
            </div>
          </div>

          <form onSubmit={handleEmailUpdate} className="space-y-6">
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-widest text-gray-500 ml-1">
                New Email
              </label>
              <input
                type="email"
                value={emailData.email}
                onChange={(e) => setEmailData({ ...emailData, email: e.target.value })}
                className="input-field border-purple-500/20 focus:border-purple-500/50"
                placeholder="new@example.com"
                required
              />
            </div>
            <button
              type="submit"
              disabled={loading.email}
              className="btn btn-secondary w-full py-4 rounded-2xl flex items-center justify-center gap-2"
            >
              {loading.email ? (
                <Loader2 size={20} className="animate-spin" />
              ) : (
                "Update Email"
              )}
            </button>
          </form>
        </div>

        {/* Password Section */}
        <div className="glass p-8 rounded-3xl relative overflow-hidden group lg:col-span-2">
          <div className="absolute top-0 right-0 w-64 h-64 -mr-16 -mt-16 rounded-full opacity-5 bg-amber-500 group-hover:opacity-10 transition-opacity" />
          <div className="flex items-center gap-4 mb-8">
            <div className="p-3 rounded-2xl bg-amber-500/10 text-amber-500">
              <Shield size={24} />
            </div>
            <div>
              <h3 className="text-xl font-bold text-white">Security</h3>
              <p className="text-xs text-gray-500">Update your account password.</p>
            </div>
          </div>

          <form onSubmit={handlePasswordUpdate} className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-widest text-gray-500 ml-1">
                New Password
              </label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
                <input
                  type="password"
                  value={passwordData.newPassword}
                  onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                  className="input-field pl-12 border-amber-500/20 focus:border-amber-500/50"
                  placeholder="Min. 6 characters"
                  required
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-widest text-gray-500 ml-1">
                Confirm Password
              </label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
                <input
                  type="password"
                  value={passwordData.confirmPassword}
                  onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                  className="input-field pl-12 border-amber-500/20 focus:border-amber-500/50"
                  placeholder="Confirm new password"
                  required
                />
              </div>
            </div>
            <div className="md:col-span-2">
              <button
                type="submit"
                disabled={loading.password}
                className="btn btn-primary bg-amber-500 hover:bg-amber-600 shadow-amber-500/20 w-full md:w-auto md:px-12 py-4 rounded-2xl flex items-center justify-center gap-2"
              >
                {loading.password ? (
                  <Loader2 size={20} className="animate-spin" />
                ) : (
                  "Update Password"
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Settings;
