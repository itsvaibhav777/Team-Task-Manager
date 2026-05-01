import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { tasksAPI } from '../api';
import { useAuth } from '../context/AuthContext';
import { toast } from 'react-hot-toast';
import { Plus, Search, Trash2, Clock, Users, Loader2, CheckSquare, Filter } from 'lucide-react';

const STATUS_LABELS = { todo: 'To Do', in_progress: 'In Progress', review: 'Review', done: 'Done' };

export default function Tasks() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState(searchParams.get('status') || '');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [overdueOnly, setOverdueOnly] = useState(searchParams.get('overdue') === 'true');

  const load = () => {
    const params = {};
    if (statusFilter) params.status = statusFilter;
    if (priorityFilter) params.priority = priorityFilter;
    if (overdueOnly) params.overdue = 'true';
    tasksAPI.list(params).then(r => setTasks(r.data)).catch(console.error).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [statusFilter, priorityFilter, overdueOnly]);

  const handleDelete = async (task) => {
    if (!window.confirm(`Delete "${task.title}"?`)) return;
    try {
      await tasksAPI.delete(task.id);
      setTasks(t => t.filter(x => x.id !== task.id));
      toast.success('Task deleted');
    } catch (err) { toast.error(err.response?.data?.error || 'Failed to delete'); }
  };

  const handleStatusChange = async (taskId, newStatus) => {
    try {
      await tasksAPI.updateStatus(taskId, newStatus);
      setTasks(t => t.map(x => x.id === taskId ? { ...x, status: newStatus } : x));
      toast.success('Status updated');
    } catch { toast.error('Failed to update status'); }
  };

  const filtered = tasks.filter(t =>
    t.title.toLowerCase().includes(search.toLowerCase()) ||
    (t.project_name || '').toLowerCase().includes(search.toLowerCase())
  );

  const isOverdue = t => t.due_date && new Date(t.due_date) < new Date() && t.status !== 'done';

  if (loading) return <div className="page-loading"><Loader2 size={36} className="spin" /><p>Loading tasks…</p></div>;

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Tasks</h1>
          <p className="page-sub">{filtered.length} task{filtered.length !== 1 ? 's' : ''}</p>
        </div>
        <Link to="/tasks/new" className="btn btn-primary"><Plus size={16} /> New Task</Link>
      </div>

      <div className="filter-bar">
        <div className="search-wrap">
          <Search size={16} />
          <input placeholder="Search tasks…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
          <option value="">All Statuses</option>
          <option value="todo">To Do</option>
          <option value="in_progress">In Progress</option>
          <option value="review">Review</option>
          <option value="done">Done</option>
        </select>
        <select value={priorityFilter} onChange={e => setPriorityFilter(e.target.value)}>
          <option value="">All Priorities</option>
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
          <option value="critical">Critical</option>
        </select>
        <label className="toggle-label">
          <input type="checkbox" checked={overdueOnly} onChange={e => setOverdueOnly(e.target.checked)} />
          Overdue only
        </label>
      </div>

      {filtered.length === 0 ? (
        <div className="empty-state">
          <CheckSquare size={48} />
          <h3>No tasks found</h3>
          <p>Create your first task to get started</p>
          <Link to="/tasks/new" className="btn btn-primary"><Plus size={16} /> New Task</Link>
        </div>
      ) : (
        <div className="tasks-table-wrap">
          <table className="tasks-table">
            <thead>
              <tr>
                <th>Task</th>
                <th>Project</th>
                <th>Assignee</th>
                <th>Priority</th>
                <th>Status</th>
                <th>Due Date</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(t => (
                <tr key={t.id} className={isOverdue(t) ? 'overdue-row' : ''}>
                  <td>
                    <Link to={`/tasks/${t.id}`} className="task-link">{t.title}</Link>
                  </td>
                  <td><span className="text-muted">{t.project_name}</span></td>
                  <td>
                    {t.assignee_name
                      ? <span className="assignee-chip"><Users size={12} />{t.assignee_name}</span>
                      : <span className="text-muted">—</span>}
                  </td>
                  <td><span className={`priority-badge ${t.priority}`}>{t.priority}</span></td>
                  <td>
                    <select
                      className={`status-select ${t.status}`}
                      value={t.status}
                      onChange={e => handleStatusChange(t.id, e.target.value)}
                    >
                      {Object.entries(STATUS_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                    </select>
                  </td>
                  <td>
                    {t.due_date
                      ? <span className={`due-date ${isOverdue(t) ? 'overdue-date' : ''}`}>
                          <Clock size={12} /> {new Date(t.due_date).toLocaleDateString()}
                        </span>
                      : <span className="text-muted">—</span>}
                  </td>
                  <td>
                    <div className="row-actions">
                      <Link to={`/tasks/${t.id}`} className="btn btn-ghost btn-sm">View</Link>
                      <button className="icon-btn danger" onClick={() => handleDelete(t)}><Trash2 size={14} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
