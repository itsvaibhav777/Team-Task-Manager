const express = require('express');
const router = express.Router();
const { getDb } = require('../db/database');
const { authenticate } = require('../middleware/auth');

// GET /api/dashboard
router.get('/', authenticate, (req, res) => {
  try {
    const db = getDb();
    const userId = req.user.id;
    const isAdmin = req.user.role === 'admin';

    const projectFilter = isAdmin
      ? ''
      : 'AND p.id IN (SELECT project_id FROM project_members WHERE user_id = ?)';
    const taskFilter = isAdmin
      ? ''
      : 'AND t.project_id IN (SELECT project_id FROM project_members WHERE user_id = ?)';
    const params = isAdmin ? [] : [userId];

    // Project stats
    const projectStats = db.prepare(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
        SUM(CASE WHEN status = 'on_hold' THEN 1 ELSE 0 END) as on_hold
      FROM projects p WHERE 1=1 ${projectFilter}
    `).get(...params);

    // Task stats
    const taskStats = db.prepare(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN t.status = 'todo' THEN 1 ELSE 0 END) as todo,
        SUM(CASE WHEN t.status = 'in_progress' THEN 1 ELSE 0 END) as in_progress,
        SUM(CASE WHEN t.status = 'review' THEN 1 ELSE 0 END) as review,
        SUM(CASE WHEN t.status = 'done' THEN 1 ELSE 0 END) as done,
        SUM(CASE WHEN t.due_date < date('now') AND t.status != 'done' THEN 1 ELSE 0 END) as overdue
      FROM tasks t WHERE 1=1 ${taskFilter}
    `).get(...params);

    // My tasks (assigned to me)
    const myTasks = db.prepare(`
      SELECT t.*, p.name as project_name
      FROM tasks t JOIN projects p ON t.project_id = p.id
      WHERE t.assignee_id = ? AND t.status != 'done'
      ORDER BY CASE WHEN t.priority = 'critical' THEN 0 WHEN t.priority = 'high' THEN 1 WHEN t.priority = 'medium' THEN 2 ELSE 3 END,
               t.due_date ASC NULLS LAST
      LIMIT 10
    `).all(userId);

    // Overdue tasks
    const overdueTasks = db.prepare(`
      SELECT t.*, p.name as project_name, u.name as assignee_name
      FROM tasks t
      JOIN projects p ON t.project_id = p.id
      LEFT JOIN users u ON t.assignee_id = u.id
      WHERE t.due_date < date('now') AND t.status != 'done' ${taskFilter}
      ORDER BY t.due_date ASC
      LIMIT 10
    `).all(...params);

    // Recent activity (recently updated tasks)
    const recentActivity = db.prepare(`
      SELECT t.id, t.title, t.status, t.priority, t.updated_at,
             p.name as project_name, u.name as assignee_name
      FROM tasks t
      JOIN projects p ON t.project_id = p.id
      LEFT JOIN users u ON t.assignee_id = u.id
      WHERE 1=1 ${taskFilter}
      ORDER BY t.updated_at DESC
      LIMIT 8
    `).all(...params);

    // Priority breakdown
    const priorityBreakdown = db.prepare(`
      SELECT priority, COUNT(*) as count
      FROM tasks t WHERE t.status != 'done' ${taskFilter}
      GROUP BY priority
    `).all(...params);

    // Unread notifications count
    const unreadCount = db.prepare(
      'SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND read = 0'
    ).get(userId);

    // Top projects by task completion
    const topProjects = db.prepare(`
      SELECT p.id, p.name, p.status, p.priority, p.end_date,
        COUNT(t.id) as total_tasks,
        SUM(CASE WHEN t.status = 'done' THEN 1 ELSE 0 END) as done_tasks
      FROM projects p
      LEFT JOIN tasks t ON t.project_id = p.id
      WHERE 1=1 ${projectFilter}
      GROUP BY p.id
      ORDER BY p.updated_at DESC
      LIMIT 5
    `).all(...params);

    res.json({
      projectStats,
      taskStats,
      myTasks: myTasks.map(t => ({ ...t, tags: JSON.parse(t.tags || '[]') })),
      overdueTasks: overdueTasks.map(t => ({ ...t, tags: JSON.parse(t.tags || '[]') })),
      recentActivity,
      priorityBreakdown,
      unreadNotifications: unreadCount.count,
      topProjects
    });
  } catch (err) {
    console.error('Dashboard error:', err);
    res.status(500).json({ error: 'Failed to load dashboard' });
  }
});

module.exports = router;
