import React, { useState, useRef } from 'react';
import { Gavel, Mail, Lock, User, Eye, EyeOff, ShieldCheck } from 'lucide-react';
import api from '../services/api';
import { setToken } from '../services/auth';
import { animateSuccess, animateError } from '../utils/authAnimations';

const AuthPage = () => {
  const [isRegister, setIsRegister] = useState(false);
  const [formData, setFormData] = useState({ name: '', email: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const cardRef = useRef(null);

  const handleChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const endpoint = isRegister ? '/auth/register' : '/auth/login';
      const payload = { name: formData.name, email: formData.email, password: formData.password };
      const response = await api.post(endpoint, payload);
      if (!response.data?.token) throw new Error('Invalid response from server');
      setToken(response.data.token);
      // Store user info
      localStorage.setItem('userRole', response.data.role);
      localStorage.setItem('userName', response.data.name);
      localStorage.setItem('userEmail', response.data.email);
      animateSuccess(cardRef.current);
      setTimeout(() => { window.location.href = '/'; }, 700);
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'An error occurred';
      setError(msg);
      animateError(cardRef.current);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card" ref={cardRef}>
        <div className="auth-banner">
          <div className="auth-logo-badge">
            <Gavel size={32} style={{ color: 'var(--accent-primary)' }} />
          </div>
          <h2>{isRegister ? 'Create Account' : 'Welcome Back'}</h2>
          <p>{isRegister ? 'Create your account to start bidding and listing auctions.' : 'Sign in to access live auctions and bidding dashboard.'}</p>
        </div>

        {error && <p className="error-text">{error}</p>}

        <form onSubmit={handleSubmit} className="auth-form">
          {isRegister && (
            <div className="form-group">
              <label className="form-label">Full Name</label>
              <div className="input-with-icon">
                <User size={16} className="field-icon" />
                <input id="name" type="text" name="name" value={formData.name}
                  onChange={handleChange} required className="form-field" placeholder="John Doe" />
              </div>
            </div>
          )}

          <div className="form-group">
            <label className="form-label">Email Address</label>
            <div className="input-with-icon">
              <Mail size={16} className="field-icon" />
              <input id="email" type="email" name="email" value={formData.email}
                onChange={handleChange} required className="form-field" placeholder="you@example.com" />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Password</label>
            <div className="password-wrapper input-with-icon">
              <Lock size={16} className="field-icon" />
              <input id="password" type={showPassword ? 'text' : 'password'} name="password"
                value={formData.password} onChange={handleChange} required
                className="form-field" placeholder="••••••••" />
              <button type="button" className="password-toggle"
                onClick={() => setShowPassword(!showPassword)}
                aria-label="Toggle password visibility">
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <button type="submit" disabled={loading} className="primary-button">
            {loading ? 'Processing...' : (isRegister ? 'Create Account' : 'Sign In')}
          </button>
        </form>

        <button onClick={() => { setIsRegister(!isRegister); setError(''); }} className="link-button">
          {isRegister ? 'Already have an account? Sign In' : "Don't have an account? Register"}
        </button>

        <div className="auth-footer-badge">
          <ShieldCheck size={14} style={{ color: '#10b981' }} />
          <span>Encrypted Ledger Security</span>
        </div>
      </div>
    </div>
  );
};

export default AuthPage;

