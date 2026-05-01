import { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { tasksAPI } from '../api';
import { useAuth } from '../context/AuthContext';
import { toast } from 'react-hot-toast';
import { ArrowLeft, Edit, Trash2, Clock, Users, Tag, Send, Loader2, CheckCircle2 } from 'lucide-react';

const STATUS_LABELS = { todo: 'To Do', in_progress: 'In Progress', review: 'Review', done: 'Done' };

export default function TaskDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [task, setTask] = useState(null);
  const [loading, setLoading] = useState(true);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);

  const load = () =>
    tasksAPI.get(id).then(r => setTask(r.data)).catch(() => toast.error('Task not found'));

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, [id]);

  const handleStatusChange = async (newStatus) => {
    setUpdatingStatus(true);
    try {
      await tasksAPI.updateStatus(id, newStatus);
      setTask(t => ({ ...t, status: newStatus }));
      toast.success('Status updated');
    } catch { toast.error('Failed to update status'); }
    finally { setUpdatingStatus(false); }
  };

  const handleDelete = async () => {
    if (!window.confirm(`Delete "${task.title}"?`)) return;
    try { await tasksAPI.delete(id); toast.success('Task deleted'); navigate('/tasks'); }
    catch (err) { toast.error(err.response?.data?.error || 'Failed to delete'); }
  };

  const handleComment = async e => {
    e.preventDefault();
    if (!comment.trim()) return;
    setSubmitting(true);
    try {
      await tasksAPI.addComment(id, comment.trim());
      setComment('');
      load();
      toast.success('Comment added');
    } catch { toast.error('Failed to add comment'); }
    finally { setSubmitting(false); }
  };

  if (loading) return <div className="page-loading"><Loader2 size={36} className="spin" /></div>;
  if (!task) return <div className="page"><p>Task not found.</p></div>;

  const isOverdue = task.due_date && new Date(task.due_date) < new Date() && task.status !== 'done';

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <Link to="/tasks" className="back-link"><ArrowLeft size={16} /> Tasks</Link>
          <h1 className="page-title">{task.title}</h1>
          <div className="page-meta">
            <span className={`status-badge ${task.status}`}>{STATUS_LABELS[task.status]}</span>
            <span className={`priority-badge ${task.priority}`}>{task.priority}</span>
            {task.project_name && <Link to={`/projects/${task.project_id}`} className="project-chip">{task.project_name}</Link>}
          </div>
        </div>
        <div className="page-actions">
          <Link to={`/tasks/${id}/edit`} className="btn btn-ghost"><Edit size={16} /> Edit</Link>
          <button className="btn btn-danger" onClick={handleDelete}><Trash2 size={16} /> Delete</button>
        </div>
      </div>

      <div className="task-detail-grid">
        {/* Main content */}
        <div className="task-detail-main">
          {task.description && (
            <div className="card">
              <h2 className="card-title">Description</h2>
              <p className="task-description">{task.description}</p>
            </div>
          )}

          {/* Status changer */}
          <div className="card">
            <h2 className="card-title">Update Status</h2>
            <div className="status-switcher">
              {Object.entries(STATUS_LABELS).map(([val, label]) => (
                <button
                  key={val}
                  className={`status-btn ${val} ${task.status === val ? 'active' : ''}`}
                  onClick={() => handleStatusChange(val)}
                  disabled={updatingStatus || task.status === val}
                >
                  {task.status === val && <CheckCircle2 size={14} />}
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Comments */}
          <div className="card">
            <h2 className="card-title">Comments ({task.comments?.length || 0})</h2>
            <div className="comments-list">
              {task.comments?.map(c => (
                <div key={c.id} className="comment">
                  <div className="comment-avatar" style={{ background: c.author_avatar?.color || '#6366f1' }}>
                    {c.author_avatar?.initials || c.author_name?.[0]}
                  </div>
                  <div className="comment-body">
                    <div className="comment-header">
                      <span className="comment-author">{c.author_name}</span>
                      <span className="comment-time">{new Date(c.created_at).toLocaleString()}</span>
                    </div>
                    <p className="comment-content">{c.content}</p>
                  </div>
                </div>
              ))}
              {(!task.comments || task.comments.length === 0) && <p className="empty-msg">No comments yet. Be the first!</p>}
            </div>
            <form onSubmit={handleComment} className="comment-form">
              <textarea
                value={comment} onChange={e => setComment(e.target.value)}
                placeholder="Add a comment…" rows={3}
              />
              <button type="submit" className="btn btn-primary" disabled={submitting || !comment.trim()}>
                {submitting ? <span className="spinner" /> : <><Send size={14} /> Post</>}
              </button>
            </form>
          </div>
        </div>

        {/* Sidebar meta */}
        <div className="task-detail-sidebar">
          <div className="card">
            <h2 className="card-title">Details</h2>
            <div className="detail-rows">
              <div className="detail-row">
                <span className="detail-label"><Users size={14} /> Assignee</span>
                <span className="detail-val">{task.assignee_name || 'Unassigned'}</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">Created by</span>
                <span className="detail-val">{task.creator_name}</span>
              </div>
              {task.due_date && (
                <div className="detail-row">
                  <span className="detail-label"><Clock size={14} /> Due Date</span>
                  <span className={`detail-val ${isOverdue ? 'overdue-date' : ''}`}>
                    {new Date(task.due_date).toLocaleDateString()}
                    {isOverdue && ' ⚠️ Overdue'}
                  </span>
                </div>
              )}
              {task.estimated_hours && (
                <div className="detail-row">
                  <span className="detail-label">Estimated</span>
                  <span className="detail-val">{task.estimated_hours}h</span>
                </div>
              )}
              {task.actual_hours && (
                <div className="detail-row">
                  <span className="detail-label">Actual</span>
                  <span className="detail-val">{task.actual_hours}h</span>
                </div>
              )}
              <div className="detail-row">
                <span className="detail-label">Created</span>
                <span className="detail-val">{new Date(task.created_at).toLocaleDateString()}</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">Updated</span>
                <span className="detail-val">{new Date(task.updated_at).toLocaleDateString()}</span>
              </div>
            </div>
          </div>
          {task.tags?.length > 0 && (
            <div className="card">
              <h2 className="card-title"><Tag size={14} /> Tags</h2>
              <div className="tags-wrap">
                {task.tags.map((tag, i) => <span key={i} className="tag-chip">{tag}</span>)}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
