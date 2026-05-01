const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const { getDb } = require('../db/database');
const { authenticate, requireProjectAccess } = require('../middleware/auth');
const { validate } = require('../middleware/validate');

// GET /api/tasks - all tasks visible to user
router.get('/', authenticate, (req, res) => {
  try {
    const db = getDb();
    const { status, priority, project_id, assignee_id, overdue } = req.query;

    let query = `
      SELECT t.*, p.name as project_name,
        u.name as assignee_name, u.avatar as assignee_avatar,
        c.name as creator_name
      FROM tasks t
      JOIN projects p ON t.project_id = p.id
      LEFT JOIN users u ON t.assignee_id = u.id
      JOIN users c ON t.creator_id = c.id
    `;

    const conditions = [];
    const params = [];

    if (req.user.role !== 'admin') {
      conditions.push('t.project_id IN (SELECT project_id FROM project_members WHERE user_id = ?)');
      params.push(req.user.id);
    }
    if (status) { conditions.push('t.status = ?'); params.push(status); }
    if (priority) { conditions.push('t.priority = ?'); params.push(priority); }
    if (project_id) { conditions.push('t.project_id = ?'); params.push(project_id); }
    if (assignee_id) { conditions.push('t.assignee_id = ?'); params.push(assignee_id); }
    if (overdue === 'true') {
      conditions.push("t.due_date < date('now') AND t.status != 'done'");
    }

    if (conditions.length) query += ' WHERE ' + conditions.join(' AND ');
    query += ' ORDER BY t.created_at DESC';

    const tasks = db.prepare(query).all(...params);
    const parsed = tasks.map(t => ({
      ...t,
      assignee_avatar: t.assignee_avatar ? JSON.parse(t.assignee_avatar) : null,
      tags: JSON.parse(t.tags || '[]')
    }));

    res.json(parsed);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch tasks' });
  }
});

// POST /api/tasks - create task
router.post('/', authenticate, [
  body('title').trim().notEmpty().withMessage('Title is required').isLength({ max: 300 }),
  body('description').optional().isLength({ max: 2000 }),
  body('status').optional().isIn(['todo', 'in_progress', 'review', 'done']),
  body('priority').optional().isIn(['low', 'medium', 'high', 'critical']),
  body('project_id').isInt().withMessage('Valid project ID required'),
  body('assignee_id').optional().isInt(),
  body('due_date').optional().isISO8601(),
  body('estimated_hours').optional().isFloat({ min: 0 }),
  body('tags').optional().isArray(),
], validate, requireProjectAccess, (req, res) => {
  try {
    const { title, description, status = 'todo', priority = 'medium', project_id, assignee_id, due_date, estimated_hours, tags = [] } = req.body;
    const db = getDb();

    if (assignee_id) {
      const isMember = db.prepare('SELECT id FROM project_members WHERE project_id = ? AND user_id = ?').get(project_id, assignee_id);
      if (!isMember && req.user.role !== 'admin') {
        return res.status(400).json({ error: 'Assignee must be a project member' });
      }
    }

    const result = db.prepare(`
      INSERT INTO tasks (title, description, status, priority, project_id, assignee_id, creator_id, due_date, estimated_hours, tags)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(title, description, status, priority, project_id, assignee_id || null, req.user.id, due_date, estimated_hours, JSON.stringify(tags));

    if (assignee_id && assignee_id !== req.user.id) {
      db.prepare('INSERT INTO notifications (user_id, title, message, type) VALUES (?, ?, ?, ?)').run(
        assignee_id, 'New Task Assigned', `You have been assigned: "${title}"`, 'task'
      );
    }

    const task = db.prepare(`
      SELECT t.*, u.name as assignee_name, c.name as creator_name
      FROM tasks t LEFT JOIN users u ON t.assignee_id = u.id JOIN users c ON t.creator_id = c.id
      WHERE t.id = ?
    `).get(result.lastInsertRowid);

    res.status(201).json({ ...task, tags: JSON.parse(task.tags || '[]') });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create task' });
  }
});

// GET /api/tasks/:taskId
router.get('/:taskId', authenticate, (req, res) => {
  try {
    const db = getDb();
    const task = db.prepare(`
      SELECT t.*, p.name as project_name,
        u.name as assignee_name, u.avatar as assignee_avatar,
        c.name as creator_name
      FROM tasks t
      JOIN projects p ON t.project_id = p.id
      LEFT JOIN users u ON t.assignee_id = u.id
      JOIN users c ON t.creator_id = c.id
      WHERE t.id = ?
    `).get(req.params.taskId);

    if (!task) return res.status(404).json({ error: 'Task not found' });

    if (req.user.role !== 'admin') {
      const member = db.prepare('SELECT id FROM project_members WHERE project_id = ? AND user_id = ?').get(task.project_id, req.user.id);
      if (!member) return res.status(403).json({ error: 'Access denied' });
    }

    const comments = db.prepare(`
      SELECT tc.*, u.name as author_name, u.avatar as author_avatar
      FROM task_comments tc JOIN users u ON tc.user_id = u.id
      WHERE tc.task_id = ? ORDER BY tc.created_at ASC
    `).all(req.params.taskId);

    res.json({
      ...task,
      tags: JSON.parse(task.tags || '[]'),
      assignee_avatar: task.assignee_avatar ? JSON.parse(task.assignee_avatar) : null,
      comments: comments.map(c => ({ ...c, author_avatar: c.author_avatar ? JSON.parse(c.author_avatar) : null }))
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch task' });
  }
});

// PUT /api/tasks/:taskId
router.put('/:taskId', authenticate, [
  body('title').optional().trim().notEmpty().isLength({ max: 300 }),
  body('status').optional().isIn(['todo', 'in_progress', 'review', 'done']),
  body('priority').optional().isIn(['low', 'medium', 'high', 'critical']),
  body('assignee_id').optional().isInt(),
  body('due_date').optional().isISO8601(),
  body('actual_hours').optional().isFloat({ min: 0 }),
  body('tags').optional().isArray(),
], validate, (req, res) => {
  try {
    const db = getDb();
    const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.taskId);
    if (!task) return res.status(404).json({ error: 'Task not found' });

    if (req.user.role !== 'admin') {
      const member = db.prepare('SELECT role FROM project_members WHERE project_id = ? AND user_id = ?').get(task.project_id, req.user.id);
      if (!member) return res.status(403).json({ error: 'Access denied' });
      // Members can only update status/hours if they are the assignee
      if (member.role !== 'admin' && task.creator_id !== req.user.id && task.assignee_id !== req.user.id) {
        return res.status(403).json({ error: 'You can only update tasks you created or are assigned to' });
      }
    }

    const { title, description, status, priority, assignee_id, due_date, estimated_hours, actual_hours, tags } = req.body;

    db.prepare(`
      UPDATE tasks SET
        title = COALESCE(?, title),
        description = COALESCE(?, description),
        status = COALESCE(?, status),
        priority = COALESCE(?, priority),
        assignee_id = CASE WHEN ? IS NOT NULL THEN ? ELSE assignee_id END,
        due_date = COALESCE(?, due_date),
        estimated_hours = COALESCE(?, estimated_hours),
        actual_hours = COALESCE(?, actual_hours),
        tags = COALESCE(?, tags),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(
      title || null, description || null, status || null, priority || null,
      assignee_id !== undefined ? 1 : null, assignee_id || null,
      due_date || null, estimated_hours || null, actual_hours || null,
      tags ? JSON.stringify(tags) : null,
      req.params.taskId
    );

    const updated = db.prepare(`
      SELECT t.*, u.name as assignee_name, c.name as creator_name
      FROM tasks t LEFT JOIN users u ON t.assignee_id = u.id JOIN users c ON t.creator_id = c.id
      WHERE t.id = ?
    `).get(req.params.taskId);

    res.json({ ...updated, tags: JSON.parse(updated.tags || '[]') });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update task' });
  }
});

// PATCH /api/tasks/:taskId/status - quick status update
router.patch('/:taskId/status', authenticate, [
  body('status').isIn(['todo', 'in_progress', 'review', 'done']).withMessage('Invalid status'),
], validate, (req, res) => {
  try {
    const db = getDb();
    const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.taskId);
    if (!task) return res.status(404).json({ error: 'Task not found' });

    db.prepare('UPDATE tasks SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
      .run(req.body.status, req.params.taskId);

    res.json({ id: task.id, status: req.body.status });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update status' });
  }
});

// DELETE /api/tasks/:taskId
router.delete('/:taskId', authenticate, (req, res) => {
  try {
    const db = getDb();
    const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.taskId);
    if (!task) return res.status(404).json({ error: 'Task not found' });

    if (req.user.role !== 'admin') {
      const member = db.prepare('SELECT role FROM project_members WHERE project_id = ? AND user_id = ?').get(task.project_id, req.user.id);
      if (!member || (member.role !== 'admin' && task.creator_id !== req.user.id)) {
        return res.status(403).json({ error: 'Only task creator or project admin can delete this task' });
      }
    }

    db.prepare('DELETE FROM tasks WHERE id = ?').run(req.params.taskId);
    res.json({ message: 'Task deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete task' });
  }
});

// POST /api/tasks/:taskId/comments
router.post('/:taskId/comments', authenticate, [
  body('content').trim().notEmpty().withMessage('Comment cannot be empty').isLength({ max: 1000 }),
], validate, (req, res) => {
  try {
    const db = getDb();
    const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.taskId);
    if (!task) return res.status(404).json({ error: 'Task not found' });

    const result = db.prepare('INSERT INTO task_comments (task_id, user_id, content) VALUES (?, ?, ?)').run(req.params.taskId, req.user.id, req.body.content);
    const comment = db.prepare(`
      SELECT tc.*, u.name as author_name, u.avatar as author_avatar
      FROM task_comments tc JOIN users u ON tc.user_id = u.id WHERE tc.id = ?
    `).get(result.lastInsertRowid);

    res.status(201).json({ ...comment, author_avatar: comment.author_avatar ? JSON.parse(comment.author_avatar) : null });
  } catch (err) {
    res.status(500).json({ error: 'Failed to add comment' });
  }
});

module.exports = router;
