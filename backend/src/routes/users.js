const express = require('express');
const router = express.Router();
const { formatRecord, getDb, parseAvatar, toInt } = require('../db/database');
const { authenticate, requireAdmin } = require('../middleware/auth');

function formatUser(user) {
  const record = formatRecord(user);
  return { ...record, avatar: parseAvatar(record.avatar) };
}

// GET /api/users - list all users (for member assignment)
router.get('/', authenticate, async (_req, res) => {
  try {
    const db = await getDb();
    const users = await db.collection('users')
      .find({}, { projection: { _id: 0, id: 1, name: 1, email: 1, role: 1, avatar: 1, created_at: 1 } })
      .sort({ name: 1 })
      .toArray();

    res.json(users.map(formatUser));
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// GET /api/users/notifications/me
router.get('/notifications/me', authenticate, async (req, res) => {
  try {
    const db = await getDb();
    const notifications = await db.collection('notifications')
      .find({ user_id: req.user.id }, { projection: { _id: 0 } })
      .sort({ created_at: -1 })
      .limit(50)
      .toArray();

    res.json(notifications.map(formatRecord));
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
});

// PATCH /api/users/notifications/:id/read
router.patch('/notifications/:id/read', authenticate, async (req, res) => {
  try {
    const db = await getDb();
    await db.collection('notifications').updateOne(
      { id: toInt(req.params.id), user_id: req.user.id },
      { $set: { read: 1 } }
    );
    res.json({ message: 'Notification marked as read' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update notification' });
  }
});

// PATCH /api/users/notifications/read-all
router.patch('/notifications/read-all/mark', authenticate, async (req, res) => {
  try {
    const db = await getDb();
    await db.collection('notifications').updateMany({ user_id: req.user.id }, { $set: { read: 1 } });
    res.json({ message: 'All notifications marked as read' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update notifications' });
  }
});

// GET /api/users/:id
router.get('/:id', authenticate, async (req, res) => {
  try {
    const db = await getDb();
    const user = await db.collection('users').findOne(
      { id: toInt(req.params.id) },
      { projection: { _id: 0, id: 1, name: 1, email: 1, role: 1, avatar: 1, created_at: 1 } }
    );

    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(formatUser(user));
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

// PATCH /api/users/:id/role - admin only
router.patch('/:id/role', authenticate, requireAdmin, async (req, res) => {
  try {
    const { role } = req.body;
    if (!['admin', 'member'].includes(role)) {
      return res.status(400).json({ error: 'Role must be admin or member' });
    }

    const db = await getDb();
    await db.collection('users').updateOne({ id: toInt(req.params.id) }, { $set: { role } });
    res.json({ message: 'Role updated' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update role' });
  }
});

// DELETE /api/users/:id - admin only
router.delete('/:id', authenticate, requireAdmin, async (req, res) => {
  try {
    const userId = toInt(req.params.id);
    if (userId === req.user.id) {
      return res.status(400).json({ error: 'Cannot delete your own account' });
    }

    const db = await getDb();
    await Promise.all([
      db.collection('users').deleteOne({ id: userId }),
      db.collection('project_members').deleteMany({ user_id: userId }),
      db.collection('notifications').deleteMany({ user_id: userId }),
      db.collection('tasks').updateMany({ assignee_id: userId }, { $set: { assignee_id: null } }),
    ]);

    res.json({ message: 'User deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

module.exports = router;
