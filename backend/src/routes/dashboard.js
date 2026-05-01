const express = require('express');
const router = express.Router();
const { formatRecord, getDb } = require('../db/database');
const { authenticate } = require('../middleware/auth');

function emptyProjectStats() {
  return { total: 0, active: 0, completed: 0, on_hold: 0 };
}

function emptyTaskStats() {
  return { total: 0, todo: 0, in_progress: 0, review: 0, done: 0, overdue: 0 };
}

function priorityRank(priority) {
  return { critical: 0, high: 1, medium: 2, low: 3 }[priority] ?? 4;
}

function todayDate() {
  return new Date().toISOString().slice(0, 10);
}

// GET /api/dashboard
router.get('/', authenticate, async (req, res) => {
  try {
    const db = await getDb();
    const userId = req.user.id;
    const isAdmin = req.user.role === 'admin';

    let visibleProjectIds = null;
    if (!isAdmin) {
      const memberships = await db.collection('project_members')
        .find({ user_id: userId }, { projection: { _id: 0, project_id: 1 } })
        .toArray();
      visibleProjectIds = memberships.map((membership) => membership.project_id);
    }

    const projectFilter = isAdmin ? {} : { id: { $in: visibleProjectIds } };
    const taskFilter = isAdmin ? {} : { project_id: { $in: visibleProjectIds } };
    const [projects, tasks, unreadNotifications] = await Promise.all([
      db.collection('projects').find(projectFilter, { projection: { _id: 0 } }).toArray(),
      db.collection('tasks').find(taskFilter, { projection: { _id: 0 } }).toArray(),
      db.collection('notifications').countDocuments({ user_id: userId, read: 0 }),
    ]);

    const projectStats = projects.reduce((stats, project) => {
      stats.total += 1;
      if (project.status === 'active') stats.active += 1;
      if (project.status === 'completed') stats.completed += 1;
      if (project.status === 'on_hold') stats.on_hold += 1;
      return stats;
    }, emptyProjectStats());

    const today = todayDate();
    const taskStats = tasks.reduce((stats, task) => {
      stats.total += 1;
      if (stats[task.status] !== undefined) stats[task.status] += 1;
      if (task.due_date && task.due_date < today && task.status !== 'done') stats.overdue += 1;
      return stats;
    }, emptyTaskStats());

    const projectsById = new Map(projects.map((project) => [project.id, project]));
    const users = await db.collection('users')
      .find({ id: { $in: [...new Set(tasks.map((task) => task.assignee_id).filter(Boolean))] } }, { projection: { _id: 0, id: 1, name: 1 } })
      .toArray();
    const usersById = new Map(users.map((user) => [user.id, user]));

    const myTasks = tasks
      .filter((task) => task.assignee_id === userId && task.status !== 'done')
      .sort((a, b) => priorityRank(a.priority) - priorityRank(b.priority)
        || String(a.due_date || '9999-12-31').localeCompare(String(b.due_date || '9999-12-31')))
      .slice(0, 10)
      .map((task) => ({
        ...formatRecord(task),
        tags: task.tags || [],
        project_name: projectsById.get(task.project_id)?.name,
      }));

    const overdueTasks = tasks
      .filter((task) => task.due_date && task.due_date < today && task.status !== 'done')
      .sort((a, b) => String(a.due_date || '').localeCompare(String(b.due_date || '')))
      .slice(0, 10)
      .map((task) => ({
        ...formatRecord(task),
        tags: task.tags || [],
        project_name: projectsById.get(task.project_id)?.name,
        assignee_name: usersById.get(task.assignee_id)?.name,
      }));

    const recentActivity = [...tasks]
      .sort((a, b) => new Date(b.updated_at || 0) - new Date(a.updated_at || 0))
      .slice(0, 8)
      .map((task) => ({
        id: task.id,
        title: task.title,
        status: task.status,
        priority: task.priority,
        updated_at: formatRecord(task).updated_at,
        project_name: projectsById.get(task.project_id)?.name,
        assignee_name: usersById.get(task.assignee_id)?.name,
      }));

    const priorityCounts = tasks
      .filter((task) => task.status !== 'done')
      .reduce((counts, task) => {
        counts.set(task.priority, (counts.get(task.priority) || 0) + 1);
        return counts;
      }, new Map());
    const priorityBreakdown = [...priorityCounts.entries()].map(([priority, count]) => ({ priority, count }));

    const taskCountsByProject = tasks.reduce((counts, task) => {
      const current = counts.get(task.project_id) || { total_tasks: 0, done_tasks: 0 };
      current.total_tasks += 1;
      if (task.status === 'done') current.done_tasks += 1;
      counts.set(task.project_id, current);
      return counts;
    }, new Map());
    const topProjects = [...projects]
      .sort((a, b) => new Date(b.updated_at || 0) - new Date(a.updated_at || 0))
      .slice(0, 5)
      .map((project) => {
        const counts = taskCountsByProject.get(project.id) || { total_tasks: 0, done_tasks: 0 };
        return {
          id: project.id,
          name: project.name,
          status: project.status,
          priority: project.priority,
          end_date: project.end_date,
          ...counts,
        };
      });

    res.json({
      projectStats,
      taskStats,
      myTasks,
      overdueTasks,
      recentActivity,
      priorityBreakdown,
      unreadNotifications,
      topProjects,
    });
  } catch (err) {
    console.error('Dashboard error:', err);
    res.status(500).json({ error: 'Failed to load dashboard' });
  }
});

module.exports = router;
