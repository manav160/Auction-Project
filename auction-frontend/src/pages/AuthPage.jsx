import React, { useState } from 'react';
import api from '../services/api';
import { setToken } from '../services/auth';
import { animateSuccess, animateError } from '../utils/authAnimations';
import { useRef } from 'react';

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
          <div style={{ fontSize: '2.5rem', marginBottom: '8px' }}>🏛️</div>
          <h2>{isRegister ? 'Create Account' : 'Welcome Back'}</h2>
          <p>{isRegister ? 'Create your account to start bidding and creating auctions.' : 'Login to continue bidding.'}</p>
        </div>
        {error && <p className="error-text">{error}</p>}
        <form onSubmit={handleSubmit} className="auth-form">
          {isRegister && (
            <>
              <div className="form-group">
                <label className="form-label">Full Name</label>
                <input id="name" type="text" name="name" value={formData.name}
                  onChange={handleChange} required className="form-field" placeholder="John Doe" />
              </div>
            </>
          )}
          <div className="form-group">
            <label className="form-label">Email</label>
            <input id="email" type="email" name="email" value={formData.email}
              onChange={handleChange} required className="form-field" placeholder="you@example.com" />
          </div>
          <div className="form-group">
            <label className="form-label">Password</label>
            <div className="password-wrapper">
              <input id="password" type={showPassword ? 'text' : 'password'} name="password"
                value={formData.password} onChange={handleChange} required
                className="form-field" placeholder="••••••••" />
              <button type="button" className="password-toggle"
                onClick={() => setShowPassword(!showPassword)}>
                {showPassword ? '🙈' : '👁️'}
              </button>
            </div>
          </div>
          <button type="submit" disabled={loading} className="primary-button">
            {loading ? 'Loading...' : (isRegister ? 'Register' : 'Login')}
          </button>
        </form>
        <button onClick={() => { setIsRegister(!isRegister); setError(''); }} className="link-button">
          {isRegister ? 'Already have an account? Login' : "Don't have an account? Register"}
        </button>
      </div>
    </div>
  );
};

export default AuthPage;
