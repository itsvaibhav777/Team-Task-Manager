import { useEffect, useState } from 'react';
import { usersAPI } from '../api';
import { useAuth } from '../context/AuthContext';
import { toast } from 'react-hot-toast';
import { Bell, Check, CheckCheck, Loader2 } from 'lucide-react';

const TYPE_COLORS = { info: '#6366f1', task: '#10b981', warning: '#f59e0b', error: '#ef4444' };

export default function Notifications() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = () =>
    usersAPI.getNotifications()
      .then(r => setNotifications(r.data))
      .catch(console.error)
      .finally(() => setLoading(false));

  useEffect(() => { load(); }, []);

  const markRead = async (id) => {
    try {
      await usersAPI.markRead(id);
      setNotifications(n => n.map(x => x.id === id ? { ...x, read: 1 } : x));
    } catch { toast.error('Failed to mark as read'); }
  };

  const markAllRead = async () => {
    try {
      await usersAPI.markAllRead();
      setNotifications(n => n.map(x => ({ ...x, read: 1 })));
      toast.success('All marked as read');
    } catch { toast.error('Failed'); }
  };

  const unread = notifications.filter(n => !n.read).length;

  if (loading) return <div className="page-loading"><Loader2 size={36} className="spin" /></div>;

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title"><Bell size={22} /> Notifications</h1>
          <p className="page-sub">{unread} unread</p>
        </div>
        {unread > 0 && (
          <button className="btn btn-ghost" onClick={markAllRead}><CheckCheck size={16} /> Mark all read</button>
        )}
      </div>

      {notifications.length === 0 ? (
        <div className="empty-state">
          <Bell size={48} />
          <h3>No notifications</h3>
          <p>You're all caught up!</p>
        </div>
      ) : (
        <div className="notifications-list">
          {notifications.map(n => (
            <div key={n.id} className={`notification-item ${n.read ? 'read' : 'unread'}`}>
              <div className="notif-dot" style={{ background: TYPE_COLORS[n.type] || '#6366f1' }} />
              <div className="notif-content">
                <div className="notif-title">{n.title}</div>
                <div className="notif-message">{n.message}</div>
                <div className="notif-time">{new Date(n.created_at).toLocaleString()}</div>
              </div>
              {!n.read && (
                <button className="icon-btn" onClick={() => markRead(n.id)} title="Mark as read">
                  <Check size={15} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
