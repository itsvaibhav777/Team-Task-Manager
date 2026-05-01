import { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { projectsAPI, tasksAPI, usersAPI } from '../api';
import { useAuth } from '../context/AuthContext';
import { toast } from 'react-hot-toast';
import {
  ArrowLeft, Plus, Users, Edit, Trash2, UserPlus, UserMinus,
  CheckSquare, Clock, Loader2, FolderKanban
} from 'lucide-react';

const STATUS_COLS = ['todo', 'in_progress', 'review', 'done'];
const STATUS_LABELS = { todo: 'To Do', in_progress: 'In Progress', review: 'Review', done: 'Done' };

function TaskCard({ task, onDelete }) {
  return (
    <Link to={`/tasks/${task.id}`} className="kanban-card">
      <div className="kanban-card-title">{task.title}</div>
      {task.assignee_name && <div className="kanban-assignee"><Users size={11} /> {task.assignee_name}</div>}
      <div className="kanban-meta">
        <span className={`priority-badge ${task.priority}`}>{task.priority}</span>
        {task.due_date && <span className="due-date"><Clock size={11} /> {new Date(task.due_date).toLocaleDateString()}</span>}
      </div>
    </Link>
  );
}

export default function ProjectDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, isAdmin } = useAuth();
  const [project, setProject] = useState(null);
  const [allUsers, setAllUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddMember, setShowAddMember] = useState(false);
  const [newMemberId, setNewMemberId] = useState('');
  const [newMemberRole, setNewMemberRole] = useState('member');
  const [addingMember, setAddingMember] = useState(false);

  const load = () =>
    projectsAPI.get(id).then(r => setProject(r.data)).catch(() => toast.error('Project not found'));

  useEffect(() => {
    Promise.all([projectsAPI.get(id), usersAPI.list()])
      .then(([pRes, uRes]) => { setProject(pRes.data); setAllUsers(uRes.data); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [id]);

  const handleDeleteProject = async () => {
    if (!window.confirm(`Delete "${project.name}"?`)) return;
    try { await projectsAPI.delete(id); toast.success('Project deleted'); navigate('/projects'); }
    catch (err) { toast.error(err.response?.data?.error || 'Failed to delete'); }
  };

  const handleAddMember = async () => {
    if (!newMemberId) return;
    setAddingMember(true);
    try {
      await projectsAPI.addMember(id, { userId: parseInt(newMemberId), role: newMemberRole });
      toast.success('Member added'); setShowAddMember(false); setNewMemberId(''); load();
    } catch (err) { toast.error(err.response?.data?.error || 'Failed to add member'); }
    finally { setAddingMember(false); }
  };

  const handleRemoveMember = async (userId, name) => {
    if (!window.confirm(`Remove ${name} from project?`)) return;
    try { await projectsAPI.removeMember(id, userId); toast.success('Member removed'); load(); }
    catch (err) { toast.error(err.response?.data?.error || 'Failed to remove'); }
  };

  const myMembership = project?.members?.find(m => m.id === user?.id);
  const canManage = isAdmin || myMembership?.project_role === 'admin';
  const nonMembers = allUsers.filter(u => !project?.members?.find(m => m.id === u.id));

  const tasksByStatus = STATUS_COLS.reduce((acc, s) => {
    acc[s] = (project?.tasks || []).filter(t => t.status === s);
    return acc;
  }, {});

  if (loading) return <div className="page-loading"><Loader2 size={36} className="spin" /></div>;
  if (!project) return <div className="page"><p>Project not found.</p></div>;

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <Link to="/projects" className="back-link"><ArrowLeft size={16} /> Projects</Link>
          <h1 className="page-title">{project.name}</h1>
          <div className="page-meta">
            <span className={`status-badge ${project.status}`}>{project.status.replace('_', ' ')}</span>
            <span className={`priority-badge ${project.priority}`}>{project.priority}</span>
            {project.end_date && <span className="due-date"><Clock size={13} /> Due {new Date(project.end_date).toLocaleDateString()}</span>}
          </div>
        </div>
        <div className="page-actions">
          {canManage && <Link to={`/projects/${id}/edit`} className="btn btn-ghost"><Edit size={16} /> Edit</Link>}
          {canManage && <Link to={`/tasks/new?project_id=${id}`} className="btn btn-primary"><Plus size={16} /> Add Task</Link>}
          {isAdmin && <button className="btn btn-danger" onClick={handleDeleteProject}><Trash2 size={16} /> Delete</button>}
        </div>
      </div>

      {project.description && <p className="project-description">{project.description}</p>}

      {/* Kanban Board */}
      <div className="section-title"><CheckSquare size={16} /> Kanban Board</div>
      <div className="kanban-board">
        {STATUS_COLS.map(status => (
          <div key={status} className={`kanban-col kanban-${status}`}>
            <div className="kanban-col-header">
              <span>{STATUS_LABELS[status]}</span>
              <span className="col-count">{tasksByStatus[status].length}</span>
            </div>
            <div className="kanban-cards">
              {tasksByStatus[status].map(t => <TaskCard key={t.id} task={t} />)}
              {tasksByStatus[status].length === 0 && <div className="kanban-empty">No tasks</div>}
            </div>
          </div>
        ))}
      </div>

      {/* Members */}
      <div className="section-title"><Users size={16} /> Team Members ({project.members?.length})</div>
      <div className="members-grid">
        {project.members?.map(m => (
          <div key={m.id} className="member-card">
            <div className="member-avatar" style={{ background: m.avatar?.color || '#6366f1' }}>
              {m.avatar?.initials || m.name?.[0]}
            </div>
            <div className="member-info">
              <span className="member-name">{m.name}</span>
              <span className="member-email">{m.email}</span>
              <div className="member-badges">
                <span className={`role-chip ${m.project_role}`}>{m.project_role}</span>
                <span className={`role-chip ${m.system_role}`}>{m.system_role}</span>
              </div>
            </div>
            {canManage && m.id !== project.owner_id && m.id !== user?.id && (
              <button className="icon-btn danger" onClick={() => handleRemoveMember(m.id, m.name)}><UserMinus size={15} /></button>
            )}
          </div>
        ))}

        {canManage && (
          <div className="member-add-card">
            {!showAddMember ? (
              <button className="btn btn-ghost" onClick={() => setShowAddMember(true)}><UserPlus size={16} /> Add Member</button>
            ) : (
              <div className="add-member-form">
                <select value={newMemberId} onChange={e => setNewMemberId(e.target.value)}>
                  <option value="">Select user…</option>
                  {nonMembers.map(u => <option key={u.id} value={u.id}>{u.name} ({u.email})</option>)}
                </select>
                <select value={newMemberRole} onChange={e => setNewMemberRole(e.target.value)}>
                  <option value="member">Member</option>
                  <option value="admin">Admin</option>
                </select>
                <div className="add-member-actions">
                  <button className="btn btn-primary btn-sm" onClick={handleAddMember} disabled={addingMember}>
                    {addingMember ? <span className="spinner" /> : 'Add'}
                  </button>
                  <button className="btn btn-ghost btn-sm" onClick={() => setShowAddMember(false)}>Cancel</button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
