import React, { useState, useEffect, useRef } from 'react';
import { Camera } from 'lucide-react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { formatCurrency } from '../utils/formatters';
import { getImageUrl } from '../utils/config';
import LoadingSpinner from '../components/LoadingSpinner';

const ProfilePage = () => {
  const { userName, userRole, updateUser, setAvatar } = useAuth();

  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({ name: '', email: '' });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({ text: '', type: '' });
  const fileInputRef = useRef(null);

  const fetchProfile = async () => {
    try {
      const res = await api.get('/auth/me');
      setProfile(res.data);
      setEditForm({ name: res.data.name || '', email: res.data.email || '' });
    } catch (err) {
      console.error('Failed to load profile');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, []);

  const showMessage = (text, type = 'success') => {
    setMessage({ text, type });
    setTimeout(() => setMessage({ text: '', type: '' }), 4000);
  };

  // Avatar upload handler
  const handleAvatarUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Validate file type
    const allowed = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!allowed.includes(file.type)) {
      showMessage('Only JPG, PNG, and WEBP images are allowed.', 'error');
      return;
    }

    // Validate size (5MB)
    if (file.size > 5 * 1024 * 1024) {
      showMessage('Image must be under 5MB.', 'error');
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('avatar', file);

      const res = await api.post('/auth/avatar', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      // Update local state and AuthContext
      setProfile((prev) => ({ ...prev, avatar: res.data.avatar }));
      setAvatar(res.data.avatar);
      showMessage('Profile photo updated!');
    } catch (err) {
      showMessage(err.response?.data?.message || 'Failed to upload photo.', 'error');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Avatar remove handler
  const handleAvatarRemove = async () => {
    if (!window.confirm('Remove your profile photo?')) return;
    setUploading(true);
    try {
      await api.delete('/auth/avatar');
      setProfile((prev) => ({ ...prev, avatar: null }));
      setAvatar(null);
      showMessage('Profile photo removed.');
    } catch (err) {
      showMessage(err.response?.data?.message || 'Failed to remove photo.', 'error');
    } finally {
      setUploading(false);
    }
  };

  // Profile update handler
  const handleProfileSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await api.put('/auth/profile', editForm);
      setProfile((prev) => ({ ...prev, ...res.data }));
      updateUser(res.data);
      setEditing(false);
      showMessage('Profile updated!');
    } catch (err) {
      showMessage(err.response?.data?.message || 'Failed to update profile.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const userInitial = (profile?.name || userName || 'U').charAt(0).toUpperCase();
  const avatarSrc = getImageUrl(profile?.avatar);

  return (
    <div className="page-shell">
      <div className="page-header">
        <h1>My Profile</h1>
      </div>

      {/* Status Message */}
      {message.text && (
        <div
          style={{
            padding: '12px 20px',
            marginBottom: '20px',
            borderRadius: '10px',
            fontWeight: 600,
            fontSize: '0.9rem',
            maxWidth: '500px',
            background: message.type === 'error'
              ? 'rgba(239, 68, 68, 0.15)'
              : 'rgba(16, 185, 129, 0.15)',
            color: message.type === 'error' ? '#ef4444' : '#10b981',
            border: `1px solid ${message.type === 'error' ? 'rgba(239,68,68,0.3)' : 'rgba(16,185,129,0.3)'}`,
          }}
        >
          {message.text}
        </div>
      )}

      <div className="detail-card" style={{ maxWidth: '500px' }}>
        {/* Avatar Section */}
        <div style={{ textAlign: 'center', padding: '20px 0' }}>
          <div
            style={{
              position: 'relative',
              display: 'inline-block',
              marginBottom: '16px',
            }}
          >
            {/* Avatar Circle */}
            <div
              style={{
                width: '100px',
                height: '100px',
                borderRadius: '50%',
                background: avatarSrc
                  ? 'transparent'
                  : 'linear-gradient(135deg, #6366f1, #a855f7)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '2.5rem',
                fontWeight: 700,
                color: '#fff',
                overflow: 'hidden',
                border: '3px solid rgba(255,255,255,0.1)',
                boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
              }}
            >
              {avatarSrc ? (
                <img
                  src={avatarSrc}
                  alt="Profile"
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                  }}
                />
              ) : (
                userInitial
              )}
            </div>

            {/* Upload overlay button */}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              title="Upload photo"
              style={{
                position: 'absolute',
                bottom: '0',
                right: '0',
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                background: '#6366f1',
                border: '2px solid var(--bg-primary, #1a1a2e)',
                color: '#fff',
                fontSize: '1rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: uploading ? 'not-allowed' : 'pointer',
                opacity: uploading ? 0.5 : 1,
                transition: 'all 0.2s',
              }}
            >
              {uploading ? <div className="loading-spinner" style={{ width: '14px', height: '14px', borderWidth: '2px' }} /> : <Camera size={16} />}
            </button>

            {/* Hidden file input */}
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleAvatarUpload}
              accept="image/jpeg,image/jpg,image/png,image/webp"
              style={{ display: 'none' }}
            />
          </div>

          {/* Remove avatar button */}
          {profile?.avatar && (
            <div style={{ marginBottom: '12px' }}>
              <button
                type="button"
                onClick={handleAvatarRemove}
                disabled={uploading}
                style={{
                  background: 'transparent',
                  border: '1px solid rgba(239, 68, 68, 0.4)',
                  color: '#ef4444',
                  padding: '6px 16px',
                  borderRadius: '8px',
                  fontSize: '0.8rem',
                  cursor: uploading ? 'not-allowed' : 'pointer',
                  transition: 'all 0.2s',
                }}
              >
                Remove Photo
              </button>
            </div>
          )}

          <h2 style={{ margin: '0 0 4px' }}>{profile?.name || userName}</h2>
          <span
            className="status-pill status-active"
            style={{ textTransform: 'capitalize' }}
          >
            {userRole}
          </span>
        </div>

        {/* Profile Edit Section */}
        {editing ? (
          <form onSubmit={handleProfileSave} style={{ padding: '0 16px 16px' }}>
            <div style={{ marginBottom: '12px' }}>
              <label style={{ display: 'block', marginBottom: '4px', fontWeight: 600, fontSize: '0.85rem' }}>
                Name
              </label>
              <input
                type="text"
                value={editForm.name}
                onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                required
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  borderRadius: '8px',
                  border: '1px solid rgba(255,255,255,0.1)',
                  background: 'var(--bg-secondary, #16213e)',
                  color: 'var(--text-primary, #fff)',
                  fontSize: '0.95rem',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
            </div>
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', marginBottom: '4px', fontWeight: 600, fontSize: '0.85rem' }}>
                Email
              </label>
              <input
                type="email"
                value={editForm.email}
                onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                required
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  borderRadius: '8px',
                  border: '1px solid rgba(255,255,255,0.1)',
                  background: 'var(--bg-secondary, #16213e)',
                  color: 'var(--text-primary, #fff)',
                  fontSize: '0.95rem',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                type="submit"
                disabled={saving}
                className="btn btn-primary"
                style={{ flex: 1 }}
              >
                {saving ? 'Saving…' : 'Save Changes'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setEditing(false);
                  setEditForm({ name: profile?.name || '', email: profile?.email || '' });
                }}
                className="btn"
                style={{
                  flex: 1,
                  background: 'transparent',
                  border: '1px solid rgba(255,255,255,0.15)',
                  color: 'var(--text-primary, #fff)',
                }}
              >
                Cancel
              </button>
            </div>
          </form>
        ) : (
          <>
            {loading ? (
              <LoadingSpinner message="Loading profile..." />
            ) : profile ? (
              <div className="detail-metrics">
                <div>
                  <strong>Email</strong>
                  <p>{profile.email}</p>
                </div>
                <div>
                  <strong>Wallet Balance</strong>
                  <p style={{ color: '#10b981', fontWeight: 700, fontSize: '1.2rem' }}>
                    {formatCurrency(profile.walletBalance || 0)}
                  </p>
                </div>
                <div>
                  <strong>Locked Balance</strong>
                  <p style={{ color: '#f59e0b', fontWeight: 700 }}>
                    {formatCurrency(profile.lockedBalance || 0)}
                  </p>
                </div>
                <div>
                  <strong>Available</strong>
                  <p style={{ color: '#3b82f6', fontWeight: 700 }}>
                    {formatCurrency((profile.walletBalance || 0) - (profile.lockedBalance || 0))}
                  </p>
                </div>
              </div>
            ) : null}
            <div style={{ textAlign: 'center', padding: '16px' }}>
              <button
                type="button"
                onClick={() => setEditing(true)}
                className="btn btn-primary"
                style={{ minWidth: '160px' }}
              >
                Edit Profile
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default ProfilePage;
