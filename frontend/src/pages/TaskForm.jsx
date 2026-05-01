import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link, useSearchParams } from 'react-router-dom';
import { tasksAPI, projectsAPI, usersAPI } from '../api';
import { useAuth } from '../context/AuthContext';
import { toast } from 'react-hot-toast';
import { ArrowLeft, Save, Loader2 } from 'lucide-react';

const EMPTY = { title: '', description: '', status: 'todo', priority: 'medium', project_id: '', assignee_id: '', due_date: '', estimated_hours: '' };

export default function TaskForm() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const isEdit = !!id;
  const navigate = useNavigate();
  const [form, setForm] = useState({ ...EMPTY, project_id: searchParams.get('project_id') || '' });
  const [projects, setProjects] = useState([]);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(isEdit);

  useEffect(() => {
    projectsAPI.list().then(r => setProjects(r.data)).catch(console.error);
    if (isEdit) {
      tasksAPI.get(id).then(r => {
        const t = r.data;
        setForm({
          title: t.title || '', description: t.description || '',
          status: t.status || 'todo', priority: t.priority || 'medium',
          project_id: t.project_id || '', assignee_id: t.assignee_id || '',
          due_date: t.due_date ? t.due_date.slice(0, 10) : '',
          estimated_hours: t.estimated_hours || '',
        });
      }).catch(() => toast.error('Task not found')).finally(() => setFetching(false));
    }
  }, [id, isEdit]);

  useEffect(() => {
    if (form.project_id) {
      projectsAPI.get(form.project_id)
        .then(r => setMembers(r.data.members || []))
        .catch(() => setMembers([]));
    } else { setMembers([]); }
  }, [form.project_id]);

  const handleChange = e => setForm(f => ({ ...f, [e.target.name]: e.target.value }));

  const handleSubmit = async e => {
    e.preventDefault();
    if (!form.project_id) { toast.error('Select a project'); return; }
    setLoading(true);
    try {
      const payload = {
        ...form,
        project_id: parseInt(form.project_id),
        assignee_id: form.assignee_id ? parseInt(form.assignee_id) : undefined,
        estimated_hours: form.estimated_hours ? parseFloat(form.estimated_hours) : undefined,
      };
      if (!payload.due_date) delete payload.due_date;
      if (!payload.description) delete payload.description;

      if (isEdit) {
        await tasksAPI.update(id, payload);
        toast.success('Task updated!');
        navigate(`/tasks/${id}`);
      } else {
        const res = await tasksAPI.create(payload);
        toast.success('Task created!');
        navigate(`/tasks/${res.data.id}`);
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to save task');
    } finally { setLoading(false); }
  };

  if (fetching) return <div className="page-loading"><Loader2 size={36} className="spin" /></div>;

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <Link to="/tasks" className="back-link"><ArrowLeft size={16} /> Tasks</Link>
          <h1 className="page-title">{isEdit ? 'Edit Task' : 'New Task'}</h1>
        </div>
      </div>
      <div className="form-card">
        <form onSubmit={handleSubmit}>
          <div className="form-grid">
            <div className="form-group span-2">
              <label>Task Title *</label>
              <input name="title" required value={form.title} onChange={handleChange} placeholder="What needs to be done?" />
            </div>
            <div className="form-group span-2">
              <label>Description</label>
              <textarea name="description" rows={4} value={form.description} onChange={handleChange} placeholder="Detailed description…" />
            </div>
            <div className="form-group">
              <label>Project *</label>
              <select name="project_id" required value={form.project_id} onChange={handleChange}>
                <option value="">Select a project…</option>
                {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Assignee</label>
              <select name="assignee_id" value={form.assignee_id} onChange={handleChange} disabled={!form.project_id}>
                <option value="">Unassigned</option>
                {members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Status</label>
              <select name="status" value={form.status} onChange={handleChange}>
                <option value="todo">To Do</option>
                <option value="in_progress">In Progress</option>
                <option value="review">Review</option>
                <option value="done">Done</option>
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
              <label>Due Date</label>
              <input type="date" name="due_date" value={form.due_date} onChange={handleChange} />
            </div>
            <div className="form-group">
              <label>Estimated Hours</label>
              <input type="number" name="estimated_hours" min="0" step="0.5" value={form.estimated_hours} onChange={handleChange} placeholder="e.g. 4" />
            </div>
          </div>
          <div className="form-actions">
            <Link to="/tasks" className="btn btn-ghost">Cancel</Link>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? <span className="spinner" /> : <><Save size={16} /> {isEdit ? 'Save Changes' : 'Create Task'}</>}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
