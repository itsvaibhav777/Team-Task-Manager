const express = require('express');
const router = express.Router();
const { getDb } = require('../db/database');
const { authenticate, requireAdmin } = require('../middleware/auth');

// GET /api/users - list all users (for member assignment)
router.get('/', authenticate, (req, res) => {
  try {
    const db = getDb();
    const users = db.prepare('SELECT id, name, email, role, avatar, created_at FROM users ORDER BY name ASC').all();
    res.json(users.map(u => ({ ...u, avatar: JSON.parse(u.avatar || '{}') })));
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// GET /api/users/:id
router.get('/:id', authenticate, (req, res) => {
  try {
    const db = getDb();
    const user = db.prepare('SELECT id, name, email, role, avatar, created_at FROM users WHERE id = ?').get(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ ...user, avatar: JSON.parse(user.avatar || '{}') });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

// PATCH /api/users/:id/role - admin only
router.patch('/:id/role', authenticate, requireAdmin, (req, res) => {
  try {
    const { role } = req.body;
    if (!['admin', 'member'].includes(role)) {
      return res.status(400).json({ error: 'Role must be admin or member' });
    }
    const db = getDb();
    db.prepare('UPDATE users SET role = ? WHERE id = ?').run(role, req.params.id);
    res.json({ message: 'Role updated' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update role' });
  }
});

// DELETE /api/users/:id - admin only
router.delete('/:id', authenticate, requireAdmin, (req, res) => {
  try {
    if (parseInt(req.params.id) === req.user.id) {
      return res.status(400).json({ error: 'Cannot delete your own account' });
    }
    const db = getDb();
    db.prepare('DELETE FROM users WHERE id = ?').run(req.params.id);
    res.json({ message: 'User deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

// GET /api/users/notifications/me
router.get('/notifications/me', authenticate, (req, res) => {
  try {
    const db = getDb();
    const notifications = db.prepare(
      'SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 50'
    ).all(req.user.id);
    res.json(notifications);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
});

// PATCH /api/users/notifications/:id/read
router.patch('/notifications/:id/read', authenticate, (req, res) => {
  try {
    const db = getDb();
    db.prepare('UPDATE notifications SET read = 1 WHERE id = ? AND user_id = ?').run(req.params.id, req.user.id);
    res.json({ message: 'Notification marked as read' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update notification' });
  }
});

// PATCH /api/users/notifications/read-all
router.patch('/notifications/read-all/mark', authenticate, (req, res) => {
  try {
    const db = getDb();
    db.prepare('UPDATE notifications SET read = 1 WHERE user_id = ?').run(req.user.id);
    res.json({ message: 'All notifications marked as read' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update notifications' });
  }
});

module.exports = router;
