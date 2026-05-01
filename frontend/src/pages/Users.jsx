import { useEffect, useState } from 'react';
import { usersAPI } from '../api';
import { useAuth } from '../context/AuthContext';
import { toast } from 'react-hot-toast';
import { Users, Shield, Trash2, Loader2, Search } from 'lucide-react';

export default function UsersPage() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const load = () =>
    usersAPI.list().then(r => setUsers(r.data)).catch(console.error).finally(() => setLoading(false));

  useEffect(() => { load(); }, []);

  const handleRoleChange = async (userId, newRole) => {
    if (userId === currentUser.id) { toast.error("You can't change your own role"); return; }
    try {
      await usersAPI.updateRole(userId, newRole);
      setUsers(u => u.map(x => x.id === userId ? { ...x, role: newRole } : x));
      toast.success('Role updated');
    } catch (err) { toast.error(err.response?.data?.error || 'Failed to update role'); }
  };

  const handleDelete = async (userId, name) => {
    if (userId === currentUser.id) { toast.error("You can't delete yourself"); return; }
    if (!window.confirm(`Delete user "${name}"? This cannot be undone.`)) return;
    try {
      await usersAPI.delete(userId);
      setUsers(u => u.filter(x => x.id !== userId));
      toast.success('User deleted');
    } catch (err) { toast.error(err.response?.data?.error || 'Failed to delete'); }
  };

  const filtered = users.filter(u =>
    u.name.toLowerCase().includes(search.toLowerCase()) ||
    u.email.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) return <div className="page-loading"><Loader2 size={36} className="spin" /></div>;

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title"><Shield size={22} /> Team Members</h1>
          <p className="page-sub">{users.length} registered user{users.length !== 1 ? 's' : ''}</p>
        </div>
      </div>

      <div className="filter-bar">
        <div className="search-wrap">
          <Search size={16} />
          <input placeholder="Search users…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
      </div>

      <div className="users-grid">
        {filtered.map(u => (
          <div key={u.id} className="user-card">
            <div className="user-card-avatar" style={{ background: u.avatar?.color || '#6366f1' }}>
              {u.avatar?.initials || u.name?.[0]}
            </div>
            <div className="user-card-info">
              <span className="user-card-name">
                {u.name}
                {u.id === currentUser.id && <span className="you-badge">You</span>}
              </span>
              <span className="user-card-email">{u.email}</span>
              <span className="user-card-date">Joined {new Date(u.created_at).toLocaleDateString()}</span>
            </div>
            <div className="user-card-actions">
              <select
                className={`role-select ${u.role}`}
                value={u.role}
                onChange={e => handleRoleChange(u.id, e.target.value)}
                disabled={u.id === currentUser.id}
              >
                <option value="admin">Admin</option>
                <option value="member">Member</option>
              </select>
              <button
                className="icon-btn danger"
                onClick={() => handleDelete(u.id, u.name)}
                disabled={u.id === currentUser.id}
                title="Delete user"
              >
                <Trash2 size={15} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
