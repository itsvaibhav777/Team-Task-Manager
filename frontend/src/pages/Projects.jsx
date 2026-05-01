import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { projectsAPI } from '../api';
import { useAuth } from '../context/AuthContext';
import { toast } from 'react-hot-toast';
import {
  Plus, Search, FolderKanban, Trash2, Edit, Users, CheckSquare, Loader2, AlertCircle
} from 'lucide-react';

const PRIORITY_ORDER = { critical: 0, high: 1, medium: 2, low: 3 };

function ProjectCard({ project, onDelete, isAdmin }) {
  const pct = project.task_count > 0 ? Math.round((project.completed_tasks / project.task_count) * 100) : 0;
  return (
    <div className="project-card">
      <div className="project-card-header">
        <div className="project-icon"><FolderKanban size={20} /></div>
        <div className="project-card-actions">
          <Link to={`/projects/${project.id}/edit`} className="icon-btn" title="Edit"><Edit size={15} /></Link>
          {isAdmin && (
            <button className="icon-btn danger" onClick={() => onDelete(project)} title="Delete"><Trash2 size={15} /></button>
          )}
        </div>
      </div>
      <Link to={`/projects/${project.id}`} className="project-card-body">
        <h3 className="project-name">{project.name}</h3>
        {project.description && <p className="project-desc">{project.description}</p>}
        <div className="project-meta">
          <span className={`status-badge ${project.status}`}>{project.status.replace('_', ' ')}</span>
          <span className={`priority-badge ${project.priority}`}>{project.priority}</span>
        </div>
        <div className="project-progress">
          <div className="pp-bar"><div className="pp-fill" style={{ width: `${pct}%` }} /></div>
          <span className="pp-pct">{pct}%</span>
        </div>
        <div className="project-footer">
          <span><CheckSquare size={13} /> {project.completed_tasks}/{project.task_count} tasks</span>
          <span><Users size={13} /> {project.member_count} members</span>
          {project.end_date && <span className="due-date">Due {new Date(project.end_date).toLocaleDateString()}</span>}
        </div>
      </Link>
    </div>
  );
}

export default function Projects() {
  const { isAdmin } = useAuth();
  const navigate = useNavigate();
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [deleting, setDeleting] = useState(null);

  useEffect(() => {
    projectsAPI.list().then(r => setProjects(r.data)).catch(console.error).finally(() => setLoading(false));
  }, []);

  const handleDelete = async (project) => {
    if (!window.confirm(`Delete "${project.name}"? This cannot be undone.`)) return;
    try {
      await projectsAPI.delete(project.id);
      setProjects(p => p.filter(x => x.id !== project.id));
      toast.success('Project deleted');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to delete');
    }
  };

  const filtered = projects
    .filter(p => p.name.toLowerCase().includes(search.toLowerCase()))
    .filter(p => statusFilter ? p.status === statusFilter : true)
    .sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]);

  if (loading) return <div className="page-loading"><Loader2 size={36} className="spin" /><p>Loading projects…</p></div>;

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Projects</h1>
          <p className="page-sub">{projects.length} project{projects.length !== 1 ? 's' : ''} total</p>
        </div>
        <Link to="/projects/new" className="btn btn-primary"><Plus size={16} /> New Project</Link>
      </div>

      <div className="filter-bar">
        <div className="search-wrap">
          <Search size={16} />
          <input placeholder="Search projects…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
          <option value="">All Statuses</option>
          <option value="active">Active</option>
          <option value="on_hold">On Hold</option>
          <option value="completed">Completed</option>
          <option value="archived">Archived</option>
        </select>
      </div>

      {filtered.length === 0 ? (
        <div className="empty-state">
          <FolderKanban size={48} />
          <h3>No projects found</h3>
          <p>Create your first project to get started</p>
          <Link to="/projects/new" className="btn btn-primary"><Plus size={16} /> New Project</Link>
        </div>
      ) : (
        <div className="projects-grid">
          {filtered.map(p => (
            <ProjectCard key={p.id} project={p} onDelete={handleDelete} isAdmin={isAdmin} />
          ))}
        </div>
      )}
    </div>
  );
}
