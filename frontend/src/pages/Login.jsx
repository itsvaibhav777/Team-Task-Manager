import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { authAPI } from '../api';
import { useAuth } from '../context/AuthContext';
import { Eye, EyeOff, LogIn, CheckSquare } from 'lucide-react';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '' });
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleChange = e => setForm(f => ({ ...f, [e.target.name]: e.target.value }));

  const handleSubmit = async e => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await authAPI.login(form);
      login(res.data.token, res.data.user);
      toast.success(`Welcome back, ${res.data.user.name}!`);
      navigate('/dashboard');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-bg-orbs">
        <div className="orb orb-1" />
        <div className="orb orb-2" />
        <div className="orb orb-3" />
      </div>
      <div className="auth-card">
        <div className="auth-logo">
          <CheckSquare size={36} />
          <span>TaskFlow</span>
        </div>
        <h1 className="auth-title">Welcome Back</h1>
        <p className="auth-subtitle">Sign in to your workspace</p>

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="form-group">
            <label>Email Address</label>
            <input
              type="email" name="email" required autoComplete="email"
              value={form.email} onChange={handleChange}
              placeholder="you@company.com"
            />
          </div>
          <div className="form-group">
            <label>Password</label>
            <div className="input-icon-wrap">
              <input
                type={showPw ? 'text' : 'password'} name="password" required
                value={form.password} onChange={handleChange}
                placeholder="••••••••"
              />
              <button type="button" className="icon-btn" onClick={() => setShowPw(v => !v)}>
                {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>
          <button type="submit" className="btn btn-primary btn-full" disabled={loading}>
            {loading ? <span className="spinner" /> : <><LogIn size={16} /> Sign In</>}
          </button>
        </form>

        <div className="auth-demo">
          <p>Demo credentials:</p>
          <span onClick={() => setForm({ email: 'admin@demo.com', password: 'admin123' })} className="demo-chip">Admin</span>
          <span onClick={() => setForm({ email: 'member@demo.com', password: 'member123' })} className="demo-chip">Member</span>
        </div>

        <p className="auth-footer">
          Don't have an account? <Link to="/register">Create one</Link>
        </p>
      </div>
    </div>
  );
}
