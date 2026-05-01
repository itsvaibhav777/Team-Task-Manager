const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const { getDb } = require('../db/database');
const { authenticate, requireProjectAccess, requireProjectAdmin } = require('../middleware/auth');
const { validate } = require('../middleware/validate');

// GET /api/projects - list all projects for user
router.get('/', authenticate, (req, res) => {
  try {
    const db = getDb();
    let projects;

    if (req.user.role === 'admin') {
      projects = db.prepare(`
        SELECT p.*, u.name as owner_name,
          (SELECT COUNT(*) FROM tasks t WHERE t.project_id = p.id) as task_count,
          (SELECT COUNT(*) FROM tasks t WHERE t.project_id = p.id AND t.status = 'done') as completed_tasks,
          (SELECT COUNT(*) FROM project_members pm WHERE pm.project_id = p.id) as member_count
        FROM projects p
        JOIN users u ON p.owner_id = u.id
        ORDER BY p.created_at DESC
      `).all();
    } else {
      projects = db.prepare(`
        SELECT p.*, u.name as owner_name, pm.role as my_role,
          (SELECT COUNT(*) FROM tasks t WHERE t.project_id = p.id) as task_count,
          (SELECT COUNT(*) FROM tasks t WHERE t.project_id = p.id AND t.status = 'done') as completed_tasks,
          (SELECT COUNT(*) FROM project_members pmc WHERE pmc.project_id = p.id) as member_count
        FROM projects p
        JOIN users u ON p.owner_id = u.id
        JOIN project_members pm ON pm.project_id = p.id AND pm.user_id = ?
        ORDER BY p.created_at DESC
      `).all(req.user.id);
    }

    res.json(projects);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch projects' });
  }
});

// POST /api/projects - create project
router.post('/', authenticate, [
  body('name').trim().notEmpty().withMessage('Project name is required').isLength({ max: 200 }),
  body('description').optional().isLength({ max: 1000 }),
  body('status').optional().isIn(['active', 'completed', 'on_hold', 'archived']),
  body('priority').optional().isIn(['low', 'medium', 'high', 'critical']),
  body('start_date').optional().isISO8601(),
  body('end_date').optional().isISO8601(),
], validate, (req, res) => {
  try {
    const { name, description, status = 'active', priority = 'medium', start_date, end_date } = req.body;
    const db = getDb();

    const result = db.prepare(
      'INSERT INTO projects (name, description, status, priority, start_date, end_date, owner_id) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).run(name, description, status, priority, start_date, end_date, req.user.id);

    // Auto-add creator as admin member
    db.prepare(
      'INSERT INTO project_members (project_id, user_id, role) VALUES (?, ?, ?)'
    ).run(result.lastInsertRowid, req.user.id, 'admin');

    const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(project);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create project' });
  }
});

// GET /api/projects/:projectId
router.get('/:projectId', authenticate, requireProjectAccess, (req, res) => {
  try {
    const db = getDb();
    const project = db.prepare(`
      SELECT p.*, u.name as owner_name
      FROM projects p JOIN users u ON p.owner_id = u.id
      WHERE p.id = ?
    `).get(req.params.projectId);

    if (!project) return res.status(404).json({ error: 'Project not found' });

    const members = db.prepare(`
      SELECT u.id, u.name, u.email, u.avatar, u.role as system_role, pm.role as project_role, pm.joined_at
      FROM project_members pm JOIN users u ON pm.user_id = u.id
      WHERE pm.project_id = ?
    `).all(req.params.projectId);

    const tasks = db.prepare(`
      SELECT t.*, u.name as assignee_name, u.avatar as assignee_avatar, c.name as creator_name
      FROM tasks t
      LEFT JOIN users u ON t.assignee_id = u.id
      JOIN users c ON t.creator_id = c.id
      WHERE t.project_id = ?
      ORDER BY t.created_at DESC
    `).all(req.params.projectId);

    res.json({
      ...project,
      members: members.map(m => ({ ...m, avatar: JSON.parse(m.avatar || '{}') })),
      tasks
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch project' });
  }
});

// PUT /api/projects/:projectId
router.put('/:projectId', authenticate, requireProjectAdmin, [
  body('name').optional().trim().notEmpty().isLength({ max: 200 }),
  body('description').optional().isLength({ max: 1000 }),
  body('status').optional().isIn(['active', 'completed', 'on_hold', 'archived']),
  body('priority').optional().isIn(['low', 'medium', 'high', 'critical']),
], validate, (req, res) => {
  try {
    const { name, description, status, priority, start_date, end_date } = req.body;
    const db = getDb();

    const existing = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.projectId);
    if (!existing) return res.status(404).json({ error: 'Project not found' });

    db.prepare(`
      UPDATE projects SET
        name = COALESCE(?, name),
        description = COALESCE(?, description),
        status = COALESCE(?, status),
        priority = COALESCE(?, priority),
        start_date = COALESCE(?, start_date),
        end_date = COALESCE(?, end_date),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(name, description, status, priority, start_date, end_date, req.params.projectId);

    const updated = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.projectId);
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update project' });
  }
});

// DELETE /api/projects/:projectId
router.delete('/:projectId', authenticate, requireProjectAdmin, (req, res) => {
  try {
    const db = getDb();
    const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.projectId);
    if (!project) return res.status(404).json({ error: 'Project not found' });

    if (req.user.role !== 'admin' && project.owner_id !== req.user.id) {
      return res.status(403).json({ error: 'Only project owner can delete this project' });
    }

    db.prepare('DELETE FROM projects WHERE id = ?').run(req.params.projectId);
    res.json({ message: 'Project deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete project' });
  }
});

// POST /api/projects/:projectId/members - add member
router.post('/:projectId/members', authenticate, requireProjectAdmin, [
  body('userId').isInt().withMessage('Valid user ID required'),
  body('role').optional().isIn(['admin', 'member']),
], validate, (req, res) => {
  try {
    const { userId, role = 'member' } = req.body;
    const db = getDb();

    const user = db.prepare('SELECT id, name, email FROM users WHERE id = ?').get(userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const existing = db.prepare('SELECT id FROM project_members WHERE project_id = ? AND user_id = ?').get(req.params.projectId, userId);
    if (existing) return res.status(409).json({ error: 'User is already a member' });

    db.prepare('INSERT INTO project_members (project_id, user_id, role) VALUES (?, ?, ?)').run(req.params.projectId, userId, role);

    // Notify user
    db.prepare('INSERT INTO notifications (user_id, title, message, type) VALUES (?, ?, ?, ?)').run(
      userId, 'Added to Project', `You have been added to a project as ${role}`, 'info'
    );

    res.status(201).json({ message: 'Member added successfully', user, role });
  } catch (err) {
    res.status(500).json({ error: 'Failed to add member' });
  }
});

// DELETE /api/projects/:projectId/members/:userId - remove member
router.delete('/:projectId/members/:userId', authenticate, requireProjectAdmin, (req, res) => {
  try {
    const db = getDb();
    const { projectId, userId } = req.params;

    const project = db.prepare('SELECT owner_id FROM projects WHERE id = ?').get(projectId);
    if (parseInt(userId) === project.owner_id) {
      return res.status(400).json({ error: 'Cannot remove project owner' });
    }

    db.prepare('DELETE FROM project_members WHERE project_id = ? AND user_id = ?').run(projectId, userId);
    res.json({ message: 'Member removed successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to remove member' });
  }
});

module.exports = router;
