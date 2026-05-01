const jwt = require('jsonwebtoken');
const { getDb, formatRecord, parseAvatar, toInt } = require('../db/database');

const JWT_SECRET = process.env.JWT_SECRET || 'taskmanager_super_secret_key_2024';

async function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const db = await getDb();
    const user = await db.collection('users').findOne(
      { id: toInt(decoded.userId) },
      { projection: { _id: 0, id: 1, name: 1, email: 1, role: 1, avatar: 1 } }
    );

    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }

    req.user = { ...formatRecord(user), avatar: parseAvatar(user.avatar) };
    next();
  } catch (err) {
    return res.status(403).json({ error: 'Invalid or expired token' });
  }
}

function requireAdmin(req, res, next) {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
}

async function requireProjectAccess(req, res, next) {
  try {
    const db = await getDb();
    const projectId = toInt(req.params.projectId || req.body.project_id);

    if (!projectId) return next();
    if (req.user.role === 'admin') return next();

    const membership = await db.collection('project_members').findOne(
      { project_id: projectId, user_id: req.user.id },
      { projection: { _id: 0, role: 1 } }
    );

    if (!membership) {
      return res.status(403).json({ error: 'You are not a member of this project' });
    }

    req.projectRole = membership.role;
    next();
  } catch (err) {
    res.status(500).json({ error: 'Failed to verify project access' });
  }
}

async function requireProjectAdmin(req, res, next) {
  try {
    const db = await getDb();
    const projectId = toInt(req.params.projectId || req.body.project_id);

    if (req.user.role === 'admin') return next();

    const membership = await db.collection('project_members').findOne(
      { project_id: projectId, user_id: req.user.id },
      { projection: { _id: 0, role: 1 } }
    );

    if (!membership || membership.role !== 'admin') {
      return res.status(403).json({ error: 'Project admin access required' });
    }

    req.projectRole = 'admin';
    next();
  } catch (err) {
    res.status(500).json({ error: 'Failed to verify project admin access' });
  }
}

module.exports = { authenticate, requireAdmin, requireProjectAccess, requireProjectAdmin, JWT_SECRET };
