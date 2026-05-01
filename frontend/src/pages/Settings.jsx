import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { authAPI } from '../api';
import { toast } from 'react-hot-toast';
import { Save, Shield, User } from 'lucide-react';

export default function Settings() {
  const { user, updateUser } = useAuth();
  const [profile, setProfile] = useState({ name: user?.name || '', email: user?.email || '' });
  const [pw, setPw] = useState({ currentPassword: '', newPassword: '', confirm: '' });
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPw, setSavingPw] = useState(false);

  const handleProfileSave = async e => {
    e.preventDefault();
    setSavingProfile(true);
    try {
      const res = await authAPI.updateProfile(profile);
      updateUser(res.data);
      toast.success('Profile updated!');
    } catch (err) { toast.error(err.response?.data?.error || 'Failed to update profile'); }
    finally { setSavingProfile(false); }
  };

  const handlePwSave = async e => {
    e.preventDefault();
    if (pw.newPassword !== pw.confirm) { toast.error('Passwords do not match'); return; }
    if (pw.newPassword.length < 6) { toast.error('Password must be at least 6 characters'); return; }
    setSavingPw(true);
    try {
      await authAPI.changePassword({ currentPassword: pw.currentPassword, newPassword: pw.newPassword });
      toast.success('Password changed!');
      setPw({ currentPassword: '', newPassword: '', confirm: '' });
    } catch (err) { toast.error(err.response?.data?.error || 'Failed to change password'); }
    finally { setSavingPw(false); }
  };

  const avatar = user?.avatar || {};

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">Settings</h1>
      </div>

      <div className="settings-grid">
        {/* Profile Card */}
        <div className="card">
          <h2 className="card-title"><User size={16} /> Profile</h2>
          <div className="profile-avatar-section">
            <div className="profile-avatar" style={{ background: avatar.color || '#6366f1' }}>
              {avatar.initials || user?.name?.[0]}
            </div>
            <div>
              <div className="profile-name">{user?.name}</div>
              <span className={`role-chip ${user?.role}`}>{user?.role}</span>
            </div>
          </div>
          <form onSubmit={handleProfileSave}>
            <div className="form-group">
              <label>Full Name</label>
              <input value={profile.name} onChange={e => setProfile(p => ({ ...p, name: e.target.value }))} placeholder="Your name" />
            </div>
            <div className="form-group">
              <label>Email Address</label>
              <input type="email" value={profile.email} onChange={e => setProfile(p => ({ ...p, email: e.target.value }))} placeholder="Your email" />
            </div>
            <button type="submit" className="btn btn-primary" disabled={savingProfile}>
              {savingProfile ? <span className="spinner" /> : <><Save size={15} /> Save Profile</>}
            </button>
          </form>
        </div>

        {/* Change Password */}
        <div className="card">
          <h2 className="card-title"><Shield size={16} /> Change Password</h2>
          <form onSubmit={handlePwSave}>
            <div className="form-group">
              <label>Current Password</label>
              <input type="password" value={pw.currentPassword} onChange={e => setPw(p => ({ ...p, currentPassword: e.target.value }))} placeholder="••••••••" />
            </div>
            <div className="form-group">
              <label>New Password</label>
              <input type="password" value={pw.newPassword} onChange={e => setPw(p => ({ ...p, newPassword: e.target.value }))} placeholder="Min. 6 characters" />
            </div>
            <div className="form-group">
              <label>Confirm New Password</label>
              <input type="password" value={pw.confirm} onChange={e => setPw(p => ({ ...p, confirm: e.target.value }))} placeholder="Repeat new password" />
            </div>
            <button type="submit" className="btn btn-primary" disabled={savingPw}>
              {savingPw ? <span className="spinner" /> : <><Save size={15} /> Change Password</>}
            </button>
          </form>
        </div>

        {/* Account Info */}
        <div className="card">
          <h2 className="card-title">Account Info</h2>
          <div className="detail-rows">
            <div className="detail-row"><span className="detail-label">Role</span><span className={`role-chip ${user?.role}`}>{user?.role}</span></div>
            <div className="detail-row"><span className="detail-label">User ID</span><span className="detail-val">#{user?.id}</span></div>
            <div className="detail-row"><span className="detail-label">Member Since</span><span className="detail-val">{user?.created_at ? new Date(user.created_at).toLocaleDateString() : '—'}</span></div>
          </div>
        </div>
      </div>
    </div>
  );
}
