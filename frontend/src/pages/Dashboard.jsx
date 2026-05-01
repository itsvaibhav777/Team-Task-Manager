import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { dashboardAPI } from '../api';
import { useAuth } from '../context/AuthContext';
import {
  FolderKanban, CheckSquare, AlertTriangle, TrendingUp,
  Clock, ArrowRight, Circle, Loader2
} from 'lucide-react';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

const STATUS_COLORS = { todo: '#64748b', in_progress: '#6366f1', review: '#f59e0b', done: '#10b981' };
const PRIORITY_COLORS = { low: '#10b981', medium: '#6366f1', high: '#f59e0b', critical: '#ef4444' };

function StatCard({ icon: Icon, label, value, sub, color, to }) {
  const content = (
    <div className="stat-card" style={{ '--accent': color }}>
      <div className="stat-icon" style={{ background: color + '22', color }}><Icon size={22} /></div>
      <div className="stat-body">
        <div className="stat-value">{value ?? '—'}</div>
        <div className="stat-label">{label}</div>
        {sub && <div className="stat-sub">{sub}</div>}
      </div>
    </div>
  );
  return to ? <Link to={to} className="stat-card-link">{content}</Link> : content;
}

function PriorityBadge({ priority }) {
  return <span className={`priority-badge ${priority}`}>{priority}</span>;
}
function StatusBadge({ status }) {
  const labels = { todo: 'To Do', in_progress: 'In Progress', review: 'Review', done: 'Done' };
  return <span className={`status-badge ${status}`}>{labels[status] || status}</span>;
}

export default function Dashboard() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    dashboardAPI.get().then(r => setData(r.data)).catch(console.error).finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="page-loading">
      <Loader2 size={40} className="spin" />
      <p>Loading dashboard…</p>
    </div>
  );

  const { projectStats, taskStats, myTasks, overdueTasks, recentActivity, priorityBreakdown, topProjects } = data || {};

  const pieData = [
    { name: 'To Do', value: taskStats?.todo || 0, color: STATUS_COLORS.todo },
    { name: 'In Progress', value: taskStats?.in_progress || 0, color: STATUS_COLORS.in_progress },
    { name: 'Review', value: taskStats?.review || 0, color: STATUS_COLORS.review },
    { name: 'Done', value: taskStats?.done || 0, color: STATUS_COLORS.done },
  ].filter(d => d.value > 0);

  const barData = (priorityBreakdown || []).map(p => ({
    name: p.priority.charAt(0).toUpperCase() + p.priority.slice(1),
    count: p.count,
    fill: PRIORITY_COLORS[p.priority]
  }));

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="page-sub">Welcome back, <strong>{user?.name}</strong> 👋</p>
        </div>
        <Link to="/projects/new" className="btn btn-primary"><FolderKanban size={16} /> New Project</Link>
      </div>

      {/* Stats Row */}
      <div className="stats-grid">
        <StatCard icon={FolderKanban} label="Total Projects" value={projectStats?.total} sub={`${projectStats?.active} active`} color="#6366f1" to="/projects" />
        <StatCard icon={CheckSquare} label="Total Tasks" value={taskStats?.total} sub={`${taskStats?.done} done`} color="#10b981" to="/tasks" />
        <StatCard icon={Loader2} label="In Progress" value={taskStats?.in_progress} sub="tasks ongoing" color="#f59e0b" to="/tasks?status=in_progress" />
        <StatCard icon={AlertTriangle} label="Overdue" value={taskStats?.overdue} sub="need attention" color="#ef4444" to="/tasks?overdue=true" />
      </div>

      <div className="dashboard-grid">
        {/* Task Status Chart */}
        <div className="card chart-card">
          <h2 className="card-title">Task Status</h2>
          {pieData.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={3} dataKey="value">
                  {pieData.map((d, i) => <Cell key={i} fill={d.color} />)}
                </Pie>
                <Tooltip formatter={(v, n) => [v, n]} />
              </PieChart>
            </ResponsiveContainer>
          ) : <p className="empty-msg">No tasks yet</p>}
          <div className="chart-legend">
            {pieData.map(d => (
              <span key={d.name} className="legend-item">
                <Circle size={8} fill={d.color} color={d.color} /> {d.name} ({d.value})
              </span>
            ))}
          </div>
        </div>

        {/* Priority Breakdown */}
        <div className="card chart-card">
          <h2 className="card-title">Open Tasks by Priority</h2>
          {barData.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={barData} barSize={32}>
                <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 12 }} />
                <YAxis tick={{ fill: '#94a3b8', fontSize: 12 }} allowDecimals={false} />
                <Tooltip cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
                <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                  {barData.map((d, i) => <Cell key={i} fill={d.fill} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : <p className="empty-msg">No open tasks</p>}
        </div>

        {/* My Tasks */}
        <div className="card">
          <div className="card-header-row">
            <h2 className="card-title">My Tasks</h2>
            <Link to="/tasks" className="card-link">View all <ArrowRight size={14} /></Link>
          </div>
          {myTasks?.length > 0 ? (
            <div className="task-list">
              {myTasks.map(t => (
                <Link to={`/tasks/${t.id}`} key={t.id} className="task-row">
                  <div className="task-row-main">
                    <span className="task-title">{t.title}</span>
                    <span className="task-project">{t.project_name}</span>
                  </div>
                  <div className="task-row-meta">
                    <PriorityBadge priority={t.priority} />
                    <StatusBadge status={t.status} />
                    {t.due_date && <span className="due-date"><Clock size={12} /> {new Date(t.due_date).toLocaleDateString()}</span>}
                  </div>
                </Link>
              ))}
            </div>
          ) : <p className="empty-msg">No tasks assigned to you 🎉</p>}
        </div>

        {/* Overdue Tasks */}
        <div className="card">
          <div className="card-header-row">
            <h2 className="card-title overdue-title"><AlertTriangle size={16} /> Overdue Tasks</h2>
            <Link to="/tasks?overdue=true" className="card-link">View all <ArrowRight size={14} /></Link>
          </div>
          {overdueTasks?.length > 0 ? (
            <div className="task-list">
              {overdueTasks.map(t => (
                <Link to={`/tasks/${t.id}`} key={t.id} className="task-row overdue">
                  <div className="task-row-main">
                    <span className="task-title">{t.title}</span>
                    <span className="task-project">{t.project_name}</span>
                  </div>
                  <div className="task-row-meta">
                    <PriorityBadge priority={t.priority} />
                    <span className="due-date overdue-date"><Clock size={12} /> {new Date(t.due_date).toLocaleDateString()}</span>
                  </div>
                </Link>
              ))}
            </div>
          ) : <p className="empty-msg">No overdue tasks 🎉</p>}
        </div>

        {/* Top Projects */}
        <div className="card span-2">
          <div className="card-header-row">
            <h2 className="card-title">Projects Overview</h2>
            <Link to="/projects" className="card-link">All projects <ArrowRight size={14} /></Link>
          </div>
          {topProjects?.length > 0 ? (
            <div className="project-progress-list">
              {topProjects.map(p => {
                const pct = p.total_tasks > 0 ? Math.round((p.done_tasks / p.total_tasks) * 100) : 0;
                return (
                  <Link to={`/projects/${p.id}`} key={p.id} className="project-progress-row">
                    <div className="pp-info">
                      <span className="pp-name">{p.name}</span>
                      <span className={`status-badge ${p.status}`}>{p.status.replace('_', ' ')}</span>
                    </div>
                    <div className="pp-bar-wrap">
                      <div className="pp-bar"><div className="pp-fill" style={{ width: `${pct}%` }} /></div>
                      <span className="pp-pct">{pct}%</span>
                    </div>
                    <span className="pp-tasks">{p.done_tasks}/{p.total_tasks} tasks</span>
                  </Link>
                );
              })}
            </div>
          ) : <p className="empty-msg">No projects yet</p>}
        </div>

        {/* Recent Activity */}
        <div className="card">
          <h2 className="card-title"><TrendingUp size={16} /> Recent Activity</h2>
          {recentActivity?.length > 0 ? (
            <div className="task-list">
              {recentActivity.map(t => (
                <Link to={`/tasks/${t.id}`} key={t.id} className="task-row">
                  <div className="task-row-main">
                    <span className="task-title">{t.title}</span>
                    <span className="task-project">{t.project_name}</span>
                  </div>
                  <div className="task-row-meta">
                    <StatusBadge status={t.status} />
                  </div>
                </Link>
              ))}
            </div>
          ) : <p className="empty-msg">No recent activity</p>}
        </div>
      </div>
    </div>
  );
}
