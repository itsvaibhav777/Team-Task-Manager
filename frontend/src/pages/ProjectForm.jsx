import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { projectsAPI, usersAPI } from '../api';
import { useAuth } from '../context/AuthContext';
import { toast } from 'react-hot-toast';
import { ArrowLeft, Save, Loader2 } from 'lucide-react';

const EMPTY = { name: '', description: '', status: 'active', priority: 'medium', start_date: '', end_date: '' };

export default function ProjectForm() {
  const { id } = useParams();
  const isEdit = !!id;
  const navigate = useNavigate();
  const { isAdmin } = useAuth();
  const [form, setForm] = useState(EMPTY);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(isEdit);

  useEffect(() => {
    if (isEdit) {
      projectsAPI.get(id)
        .then(r => {
          const p = r.data;
          setForm({
            name: p.name || '', description: p.description || '',
            status: p.status || 'active', priority: p.priority || 'medium',
            start_date: p.start_date ? p.start_date.slice(0, 10) : '',
            end_date: p.end_date ? p.end_date.slice(0, 10) : '',
          });
        })
        .catch(() => toast.error('Project not found'))
        .finally(() => setFetching(false));
    }
  }, [id, isEdit]);

  const handleChange = e => setForm(f => ({ ...f, [e.target.name]: e.target.value }));

  const handleSubmit = async e => {
    e.preventDefault();
    setLoading(true);
    try {
      const payload = { ...form };
      if (!payload.start_date) delete payload.start_date;
      if (!payload.end_date) delete payload.end_date;
      if (isEdit) {
        await projectsAPI.update(id, payload);
        toast.success('Project updated!');
        navigate(`/projects/${id}`);
      } else {
        const res = await projectsAPI.create(payload);
        toast.success('Project created!');
        navigate(`/projects/${res.data.id}`);
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to save project');
    } finally {
      setLoading(false);
    }
  };

  if (fetching) return <div className="page-loading"><Loader2 size={36} className="spin" /></div>;

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <Link to="/projects" className="back-link"><ArrowLeft size={16} /> Projects</Link>
          <h1 className="page-title">{isEdit ? 'Edit Project' : 'New Project'}</h1>
        </div>
      </div>
      <div className="form-card">
        <form onSubmit={handleSubmit}>
          <div className="form-grid">
            <div className="form-group span-2">
              <label>Project Name *</label>
              <input name="name" required value={form.name} onChange={handleChange} placeholder="e.g. Website Redesign" />
            </div>
            <div className="form-group span-2">
              <label>Description</label>
              <textarea name="description" rows={3} value={form.description} onChange={handleChange} placeholder="What is this project about?" />
            </div>
            <div className="form-group">
              <label>Status</label>
              <select name="status" value={form.status} onChange={handleChange}>
                <option value="active">Active</option>
                <option value="on_hold">On Hold</option>
                <option value="completed">Completed</option>
                <option value="archived">Archived</option>
              </select>
            </div>
            <div className="form-group">
              <label>Priority</label>
              <select name="priority" value={form.priority} onChange={handleChange}>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="critical">Critical</option>
              </select>
            </div>
            <div className="form-group">
              <label>Start Date</label>
              <input type="date" name="start_date" value={form.start_date} onChange={handleChange} />
            </div>
            <div className="form-group">
              <label>End Date</label>
              <input type="date" name="end_date" value={form.end_date} onChange={handleChange} />
            </div>
          </div>
          <div className="form-actions">
            <Link to="/projects" className="btn btn-ghost">Cancel</Link>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? <span className="spinner" /> : <><Save size={16} /> {isEdit ? 'Save Changes' : 'Create Project'}</>}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
