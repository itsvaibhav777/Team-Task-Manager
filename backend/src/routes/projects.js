const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const { formatRecord, getDb, nextId, parseAvatar, toInt } = require('../db/database');
const { authenticate, requireProjectAccess, requireProjectAdmin } = require('../middleware/auth');
const { validate } = require('../middleware/validate');

async function projectSummary(db, project, myRole) {
  const [owner, taskCount, completedTasks, memberCount] = await Promise.all([
    db.collection('users').findOne({ id: project.owner_id }, { projection: { _id: 0, name: 1 } }),
    db.collection('tasks').countDocuments({ project_id: project.id }),
    db.collection('tasks').countDocuments({ project_id: project.id, status: 'done' }),
    db.collection('project_members').countDocuments({ project_id: project.id }),
  ]);

  return {
    ...formatRecord(project),
    owner_name: owner?.name,
    my_role: myRole,
    task_count: taskCount,
    completed_tasks: completedTasks,
    member_count: memberCount,
  };
}

// GET /api/projects - list all projects for user
router.get('/', authenticate, async (req, res) => {
  try {
    const db = await getDb();
    let projects;
    let rolesByProject = new Map();

    if (req.user.role === 'admin') {
      projects = await db.collection('projects').find({}, { projection: { _id: 0 } }).sort({ created_at: -1 }).toArray();
    } else {
      const memberships = await db.collection('project_members')
        .find({ user_id: req.user.id }, { projection: { _id: 0, project_id: 1, role: 1 } })
        .toArray();
      const projectIds = memberships.map((membership) => membership.project_id);
      rolesByProject = new Map(memberships.map((membership) => [membership.project_id, membership.role]));
      projects = await db.collection('projects')
        .find({ id: { $in: projectIds } }, { projection: { _id: 0 } })
        .sort({ created_at: -1 })
        .toArray();
    }

    const summaries = await Promise.all(
      projects.map((project) => projectSummary(db, project, rolesByProject.get(project.id)))
    );

    res.json(summaries);
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
], validate, async (req, res) => {
  try {
    const { name, description, status = 'active', priority = 'medium', start_date, end_date } = req.body;
    const db = await getDb();
    const now = new Date();
    const project = {
      id: await nextId('projects'),
      name,
      description,
      status,
      priority,
      start_date,
      end_date,
      owner_id: req.user.id,
      created_at: now,
      updated_at: now,
    };

    await db.collection('projects').insertOne(project);
    await db.collection('project_members').insertOne({
      id: await nextId('project_members'),
      project_id: project.id,
      user_id: req.user.id,
      role: 'admin',
      joined_at: now,
    });

    res.status(201).json(formatRecord(project));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create project' });
  }
});

// GET /api/projects/:projectId
router.get('/:projectId', authenticate, requireProjectAccess, async (req, res) => {
  try {
    const db = await getDb();
    const projectId = toInt(req.params.projectId);
    const project = await db.collection('projects').findOne({ id: projectId }, { projection: { _id: 0 } });

    if (!project) return res.status(404).json({ error: 'Project not found' });

    const [owner, memberships, tasks] = await Promise.all([
      db.collection('users').findOne({ id: project.owner_id }, { projection: { _id: 0, name: 1 } }),
      db.collection('project_members').find({ project_id: projectId }, { projection: { _id: 0 } }).toArray(),
      db.collection('tasks').find({ project_id: projectId }, { projection: { _id: 0 } }).sort({ created_at: -1 }).toArray(),
    ]);

    const userIds = [...new Set([
      ...memberships.map((membership) => membership.user_id),
      ...tasks.map((task) => task.assignee_id).filter(Boolean),
      ...tasks.map((task) => task.creator_id).filter(Boolean),
    ])];
    const users = await db.collection('users')
      .find({ id: { $in: userIds } }, { projection: { _id: 0, id: 1, name: 1, email: 1, avatar: 1, role: 1 } })
      .toArray();
    const usersById = new Map(users.map((user) => [user.id, user]));

    const members = memberships.map((membership) => {
      const user = usersById.get(membership.user_id);
      return {
        id: user?.id,
        name: user?.name,
        email: user?.email,
        avatar: parseAvatar(user?.avatar),
        system_role: user?.role,
        project_role: membership.role,
        joined_at: formatRecord(membership).joined_at,
      };
    });

    const enrichedTasks = tasks.map((task) => {
      const assignee = usersById.get(task.assignee_id);
      const creator = usersById.get(task.creator_id);
      return {
        ...formatRecord(task),
        assignee_name: assignee?.name,
        assignee_avatar: assignee?.avatar ? parseAvatar(assignee.avatar) : null,
        creator_name: creator?.name,
      };
    });

    res.json({
      ...formatRecord(project),
      owner_name: owner?.name,
      members,
      tasks: enrichedTasks,
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
], validate, async (req, res) => {
  try {
    const db = await getDb();
    const projectId = toInt(req.params.projectId);
    const existing = await db.collection('projects').findOne({ id: projectId });
    if (!existing) return res.status(404).json({ error: 'Project not found' });

    const updates = {};
    ['name', 'description', 'status', 'priority', 'start_date', 'end_date'].forEach((field) => {
      if (req.body[field] !== undefined) updates[field] = req.body[field];
    });
    updates.updated_at = new Date();

    await db.collection('projects').updateOne({ id: projectId }, { $set: updates });
    const updated = await db.collection('projects').findOne({ id: projectId }, { projection: { _id: 0 } });
    res.json(formatRecord(updated));
  } catch (err) {
    res.status(500).json({ error: 'Failed to update project' });
  }
});

// DELETE /api/projects/:projectId
router.delete('/:projectId', authenticate, requireProjectAdmin, async (req, res) => {
  try {
    const db = await getDb();
    const projectId = toInt(req.params.projectId);
    const project = await db.collection('projects').findOne({ id: projectId });
    if (!project) return res.status(404).json({ error: 'Project not found' });

    if (req.user.role !== 'admin' && project.owner_id !== req.user.id) {
      return res.status(403).json({ error: 'Only project owner can delete this project' });
    }

    const tasks = await db.collection('tasks').find({ project_id: projectId }, { projection: { _id: 0, id: 1 } }).toArray();
    const taskIds = tasks.map((task) => task.id);
    await Promise.all([
      db.collection('projects').deleteOne({ id: projectId }),
      db.collection('project_members').deleteMany({ project_id: projectId }),
      db.collection('tasks').deleteMany({ project_id: projectId }),
      db.collection('task_comments').deleteMany({ task_id: { $in: taskIds } }),
    ]);

    res.json({ message: 'Project deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete project' });
  }
});

// POST /api/projects/:projectId/members - add member
router.post('/:projectId/members', authenticate, requireProjectAdmin, [
  body('userId').isInt().withMessage('Valid user ID required'),
  body('role').optional().isIn(['admin', 'member']),
], validate, async (req, res) => {
  try {
    const { role = 'member' } = req.body;
    const userId = toInt(req.body.userId);
    const projectId = toInt(req.params.projectId);
    const db = await getDb();

    const user = await db.collection('users').findOne(
      { id: userId },
      { projection: { _id: 0, id: 1, name: 1, email: 1 } }
    );
    if (!user) return res.status(404).json({ error: 'User not found' });

    const existing = await db.collection('project_members').findOne({ project_id: projectId, user_id: userId });
    if (existing) return res.status(409).json({ error: 'User is already a member' });

    await db.collection('project_members').insertOne({
      id: await nextId('project_members'),
      project_id: projectId,
      user_id: userId,
      role,
      joined_at: new Date(),
    });

    await db.collection('notifications').insertOne({
      id: await nextId('notifications'),
      user_id: userId,
      title: 'Added to Project',
      message: `You have been added to a project as ${role}`,
      type: 'info',
      read: 0,
      created_at: new Date(),
    });

    res.status(201).json({ message: 'Member added successfully', user, role });
  } catch (err) {
    res.status(500).json({ error: 'Failed to add member' });
  }
});

// DELETE /api/projects/:projectId/members/:userId - remove member
router.delete('/:projectId/members/:userId', authenticate, requireProjectAdmin, async (req, res) => {
  try {
    const db = await getDb();
    const projectId = toInt(req.params.projectId);
    const userId = toInt(req.params.userId);

    const project = await db.collection('projects').findOne({ id: projectId }, { projection: { _id: 0, owner_id: 1 } });
    if (!project) return res.status(404).json({ error: 'Project not found' });
    if (userId === project.owner_id) {
      return res.status(400).json({ error: 'Cannot remove project owner' });
    }

    await db.collection('project_members').deleteOne({ project_id: projectId, user_id: userId });
    res.json({ message: 'Member removed successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to remove member' });
  }
});

module.exports = router;
