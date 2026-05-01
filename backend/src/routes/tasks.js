const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const { formatRecord, getDb, nextId, parseAvatar, toInt } = require('../db/database');
const { authenticate, requireProjectAccess } = require('../middleware/auth');
const { validate } = require('../middleware/validate');

async function enrichTasks(db, tasks) {
  const userIds = [...new Set([
    ...tasks.map((task) => task.assignee_id).filter(Boolean),
    ...tasks.map((task) => task.creator_id).filter(Boolean),
  ])];
  const projectIds = [...new Set(tasks.map((task) => task.project_id).filter(Boolean))];

  const [users, projects] = await Promise.all([
    db.collection('users').find({ id: { $in: userIds } }, { projection: { _id: 0, id: 1, name: 1, avatar: 1 } }).toArray(),
    db.collection('projects').find({ id: { $in: projectIds } }, { projection: { _id: 0, id: 1, name: 1 } }).toArray(),
  ]);

  const usersById = new Map(users.map((user) => [user.id, user]));
  const projectsById = new Map(projects.map((project) => [project.id, project]));

  return tasks.map((task) => {
    const assignee = usersById.get(task.assignee_id);
    const creator = usersById.get(task.creator_id);
    const project = projectsById.get(task.project_id);

    return {
      ...formatRecord(task),
      tags: task.tags || [],
      project_name: project?.name,
      assignee_name: assignee?.name,
      assignee_avatar: assignee?.avatar ? parseAvatar(assignee.avatar) : null,
      creator_name: creator?.name,
    };
  });
}

function priorityRank(priority) {
  return { critical: 0, high: 1, medium: 2, low: 3 }[priority] ?? 4;
}

// GET /api/tasks - all tasks visible to user
router.get('/', authenticate, async (req, res) => {
  try {
    const db = await getDb();
    const { status, priority, project_id, assignee_id, overdue } = req.query;
    const filter = {};

    if (req.user.role !== 'admin') {
      const memberships = await db.collection('project_members')
        .find({ user_id: req.user.id }, { projection: { _id: 0, project_id: 1 } })
        .toArray();
      filter.project_id = { $in: memberships.map((membership) => membership.project_id) };
    }

    if (status) filter.status = status;
    if (priority) filter.priority = priority;
    if (project_id) filter.project_id = toInt(project_id);
    if (assignee_id) filter.assignee_id = toInt(assignee_id);
    if (overdue === 'true') {
      filter.due_date = { $lt: new Date().toISOString().slice(0, 10) };
      filter.status = { $ne: 'done' };
    }

    const tasks = await db.collection('tasks').find(filter, { projection: { _id: 0 } }).sort({ created_at: -1 }).toArray();
    res.json(await enrichTasks(db, tasks));
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
], validate, requireProjectAccess, async (req, res) => {
  try {
    const {
      title,
      description,
      status = 'todo',
      priority = 'medium',
      due_date,
      estimated_hours,
      tags = [],
    } = req.body;
    const projectId = toInt(req.body.project_id);
    const assigneeId = req.body.assignee_id ? toInt(req.body.assignee_id) : null;
    const db = await getDb();

    if (assigneeId) {
      const isMember = await db.collection('project_members').findOne({ project_id: projectId, user_id: assigneeId });
      if (!isMember && req.user.role !== 'admin') {
        return res.status(400).json({ error: 'Assignee must be a project member' });
      }
    }

    const now = new Date();
    const task = {
      id: await nextId('tasks'),
      title,
      description,
      status,
      priority,
      project_id: projectId,
      assignee_id: assigneeId,
      creator_id: req.user.id,
      due_date,
      estimated_hours,
      actual_hours: null,
      tags,
      created_at: now,
      updated_at: now,
    };

    await db.collection('tasks').insertOne(task);

    if (assigneeId && assigneeId !== req.user.id) {
      await db.collection('notifications').insertOne({
        id: await nextId('notifications'),
        user_id: assigneeId,
        title: 'New Task Assigned',
        message: `You have been assigned: "${title}"`,
        type: 'task',
        read: 0,
        created_at: now,
      });
    }

    const [enriched] = await enrichTasks(db, [task]);
    res.status(201).json(enriched);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create task' });
  }
});

// GET /api/tasks/:taskId
router.get('/:taskId', authenticate, async (req, res) => {
  try {
    const db = await getDb();
    const taskId = toInt(req.params.taskId);
    const task = await db.collection('tasks').findOne({ id: taskId }, { projection: { _id: 0 } });

    if (!task) return res.status(404).json({ error: 'Task not found' });

    if (req.user.role !== 'admin') {
      const member = await db.collection('project_members').findOne({ project_id: task.project_id, user_id: req.user.id });
      if (!member) return res.status(403).json({ error: 'Access denied' });
    }

    const comments = await db.collection('task_comments')
      .find({ task_id: taskId }, { projection: { _id: 0 } })
      .sort({ created_at: 1 })
      .toArray();
    const userIds = [...new Set(comments.map((comment) => comment.user_id))];
    const users = await db.collection('users')
      .find({ id: { $in: userIds } }, { projection: { _id: 0, id: 1, name: 1, avatar: 1 } })
      .toArray();
    const usersById = new Map(users.map((user) => [user.id, user]));
    const [enrichedTask] = await enrichTasks(db, [task]);

    res.json({
      ...enrichedTask,
      comments: comments.map((comment) => {
        const author = usersById.get(comment.user_id);
        return {
          ...formatRecord(comment),
          author_name: author?.name,
          author_avatar: author?.avatar ? parseAvatar(author.avatar) : null,
        };
      }),
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
], validate, async (req, res) => {
  try {
    const db = await getDb();
    const taskId = toInt(req.params.taskId);
    const task = await db.collection('tasks').findOne({ id: taskId });
    if (!task) return res.status(404).json({ error: 'Task not found' });

    if (req.user.role !== 'admin') {
      const member = await db.collection('project_members').findOne({ project_id: task.project_id, user_id: req.user.id });
      if (!member) return res.status(403).json({ error: 'Access denied' });
      if (member.role !== 'admin' && task.creator_id !== req.user.id && task.assignee_id !== req.user.id) {
        return res.status(403).json({ error: 'You can only update tasks you created or are assigned to' });
      }
    }

    const updates = {};
    ['title', 'description', 'status', 'priority', 'due_date', 'estimated_hours', 'actual_hours', 'tags'].forEach((field) => {
      if (req.body[field] !== undefined) updates[field] = req.body[field];
    });
    if (req.body.assignee_id !== undefined) updates.assignee_id = req.body.assignee_id ? toInt(req.body.assignee_id) : null;
    updates.updated_at = new Date();

    await db.collection('tasks').updateOne({ id: taskId }, { $set: updates });
    const updated = await db.collection('tasks').findOne({ id: taskId }, { projection: { _id: 0 } });
    const [enriched] = await enrichTasks(db, [updated]);
    res.json(enriched);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update task' });
  }
});

// PATCH /api/tasks/:taskId/status - quick status update
router.patch('/:taskId/status', authenticate, [
  body('status').isIn(['todo', 'in_progress', 'review', 'done']).withMessage('Invalid status'),
], validate, async (req, res) => {
  try {
    const db = await getDb();
    const taskId = toInt(req.params.taskId);
    const task = await db.collection('tasks').findOne({ id: taskId });
    if (!task) return res.status(404).json({ error: 'Task not found' });

    await db.collection('tasks').updateOne({ id: taskId }, { $set: { status: req.body.status, updated_at: new Date() } });
    res.json({ id: task.id, status: req.body.status });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update status' });
  }
});

// DELETE /api/tasks/:taskId
router.delete('/:taskId', authenticate, async (req, res) => {
  try {
    const db = await getDb();
    const taskId = toInt(req.params.taskId);
    const task = await db.collection('tasks').findOne({ id: taskId });
    if (!task) return res.status(404).json({ error: 'Task not found' });

    if (req.user.role !== 'admin') {
      const member = await db.collection('project_members').findOne({ project_id: task.project_id, user_id: req.user.id });
      if (!member || (member.role !== 'admin' && task.creator_id !== req.user.id)) {
        return res.status(403).json({ error: 'Only task creator or project admin can delete this task' });
      }
    }

    await Promise.all([
      db.collection('tasks').deleteOne({ id: taskId }),
      db.collection('task_comments').deleteMany({ task_id: taskId }),
    ]);
    res.json({ message: 'Task deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete task' });
  }
});

// POST /api/tasks/:taskId/comments
router.post('/:taskId/comments', authenticate, [
  body('content').trim().notEmpty().withMessage('Comment cannot be empty').isLength({ max: 1000 }),
], validate, async (req, res) => {
  try {
    const db = await getDb();
    const taskId = toInt(req.params.taskId);
    const task = await db.collection('tasks').findOne({ id: taskId });
    if (!task) return res.status(404).json({ error: 'Task not found' });

    const comment = {
      id: await nextId('task_comments'),
      task_id: taskId,
      user_id: req.user.id,
      content: req.body.content,
      created_at: new Date(),
    };
    await db.collection('task_comments').insertOne(comment);

    res.status(201).json({
      ...formatRecord(comment),
      author_name: req.user.name,
      author_avatar: req.user.avatar ? parseAvatar(req.user.avatar) : null,
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to add comment' });
  }
});

module.exports = router;
