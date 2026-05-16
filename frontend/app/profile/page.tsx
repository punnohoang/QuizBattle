"use client";

import { useState, useRef } from "react";
import { useAuthStore } from "@/lib/store";
import { userApi } from "@/lib/api";
import Navbar from "@/app/components/Navbar";
import AuthGuard from "@/app/components/AuthGuard";

export default function ProfilePage() {
  const { user, setUser } = useAuthStore();
  const [username, setUsername] = useState(user?.username || "");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState({ type: "", text: "" });
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setMessage({ type: "", text: "" });

    try {
      const payload: any = {};
      if (username !== user?.username) payload.username = username;
      if (newPassword) {
        payload.current_password = currentPassword;
        payload.new_password = newPassword;
      }

      if (Object.keys(payload).length === 0) {
        setMessage({ type: "info", text: "No changes to update." });
        setIsLoading(false);
        return;
      }

      const { data } = await userApi.updateMe(payload);
      setUser(data);
      setMessage({ type: "success", text: "Profile updated successfully! ✨" });
      setCurrentPassword("");
      setNewPassword("");
    } catch (err: any) {
      setMessage({ 
        type: "error", 
        text: err.response?.data?.detail || "Failed to update profile." 
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleAvatarClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsLoading(true);
    setMessage({ type: "", text: "" });

    try {
      const { data } = await userApi.uploadAvatar(file);
      setUser(data);
      setMessage({ type: "success", text: "Avatar updated! 📸" });
    } catch (err: any) {
      setMessage({ 
        type: "error", 
        text: err.response?.data?.detail || "Failed to upload avatar." 
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthGuard>
      <div className="page" style={{ display: "flex", flexDirection: "column" }}>
        <Navbar />
        
        <main className="container" style={{ flex: 1, padding: "40px 1.5rem", maxWidth: 800 }}>
          <div className="animate-slideInUp">
            <h1 style={{ marginBottom: 8 }}>My Profile</h1>
            <p style={{ color: "var(--text-secondary)", marginBottom: 32 }}>
              Manage your account settings and appearance.
            </p>

            <div className="grid" style={{ gridTemplateColumns: "1fr", gap: 32 }}>
              {/* Profile Card */}
              <div className="card" style={{ padding: "32px" }}>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginBottom: 32 }}>
                  <div 
                    onClick={handleAvatarClick}
                    style={{ 
                      position: "relative", 
                      cursor: "pointer",
                      width: 120,
                      height: 120,
                      borderRadius: "50%",
                      overflow: "hidden",
                      border: "4px solid var(--surface-alt)",
                      boxShadow: "var(--shadow-md)",
                      transition: "all 0.2s"
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.transform = "scale(1.05)")}
                    onMouseLeave={(e) => (e.currentTarget.style.transform = "scale(1)")}
                  >
                    {user?.avatar_url ? (
                      <img 
                        src={user.avatar_url} 
                        alt={user.username} 
                        style={{ width: "100%", height: "100%", objectFit: "cover" }} 
                      />
                    ) : (
                      <div style={{ 
                        width: "100%", 
                        height: "100%", 
                        background: "var(--gradient-primary)", 
                        display: "flex", 
                        alignItems: "center", 
                        justifyContent: "center",
                        fontSize: "3rem",
                        color: "white",
                        fontWeight: 700
                      }}>
                        {user?.username.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div style={{ 
                      position: "absolute", 
                      bottom: 0, 
                      left: 0, 
                      right: 0, 
                      background: "rgba(0,0,0,0.5)", 
                      color: "white", 
                      fontSize: "0.7rem", 
                      textAlign: "center",
                      padding: "4px 0",
                      fontWeight: 600
                    }}>
                      CHANGE
                    </div>
                  </div>
                  <input 
                    type="file" 
                    ref={fileInputRef} 
                    onChange={handleFileChange} 
                    accept="image/*" 
                    style={{ display: "none" }} 
                  />
                  <p style={{ marginTop: 12, fontSize: "0.85rem", color: "var(--text-muted)" }}>
                    Click to upload a new photo
                  </p>
                </div>

                <form onSubmit={handleUpdateProfile}>
                  <div className="form-group">
                    <label>Username</label>
                    <input 
                      type="text" 
                      value={username} 
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="Enter new username"
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label>Email Address</label>
                    <input 
                      type="email" 
                      value={user?.email || ""} 
                      disabled 
                      style={{ background: "var(--surface-alt)", cursor: "not-allowed" }}
                    />
                    <p className="form-hint">Email cannot be changed.</p>
                  </div>

                  <div style={{ margin: "32px 0", height: 1, background: "var(--border)" }} />
                  
                  <h3 style={{ marginBottom: 16 }}>Change Password</h3>
                  <div className="form-group">
                    <label>Current Password</label>
                    <input 
                      type="password" 
                      value={currentPassword} 
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      placeholder="Required to set a new password"
                    />
                  </div>

                  <div className="form-group">
                    <label>New Password</label>
                    <input 
                      type="password" 
                      value={newPassword} 
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Minimum 6 characters"
                    />
                  </div>

                  <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 32, gap: 12, alignItems: "center" }}>
                    {message.text && (
                      <span style={{ 
                        color: message.type === 'error' ? 'var(--error)' : 'var(--success)',
                        fontSize: '0.9rem',
                        fontWeight: 500
                      }}>
                        {message.text}
                      </span>
                    )}
                    <button 
                      type="submit" 
                      className="btn btn-primary btn-lg" 
                      disabled={isLoading}
                      style={{ minWidth: 140 }}
                    >
                      {isLoading ? (
                        <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span className="spinner" style={{ 
                            width: 16, 
                            height: 16, 
                            border: "2px solid rgba(255,255,255,0.3)", 
                            borderTopColor: "white", 
                            borderRadius: "50%", 
                            animation: "spin 0.8s linear infinite" 
                          }} />
                          Saving...
                        </span>
                      ) : "Save Changes"}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </main>
      </div>
    </AuthGuard>
  );
}
