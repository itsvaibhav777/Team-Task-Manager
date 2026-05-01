const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body } = require('express-validator');
const { formatRecord, getDb, nextId, parseAvatar, toInt } = require('../db/database');
const { validate } = require('../middleware/validate');
const { authenticate, JWT_SECRET } = require('../middleware/auth');

function publicUser(user) {
  const record = formatRecord(user);
  if (!record) return record;

  const { password, ...safeUser } = record;
  return { ...safeUser, avatar: parseAvatar(record.avatar) };
}

// POST /api/auth/register
router.post('/register', [
  body('name').trim().notEmpty().withMessage('Name is required').isLength({ max: 100 }),
  body('email').isEmail().withMessage('Valid email is required').normalizeEmail(),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('role').optional().isIn(['admin', 'member']).withMessage('Role must be admin or member'),
], validate, async (req, res) => {
  try {
    const { name, email, password, role = 'member' } = req.body;
    const db = await getDb();

    const existing = await db.collection('users').findOne({ email });
    if (existing) {
      return res.status(409).json({ error: 'Email already registered' });
    }

    const hashedPassword = bcrypt.hashSync(password, 12);
    const initials = name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);
    const colors = ['#6366f1', '#8b5cf6', '#06b6d4', '#10b981', '#f59e0b', '#ef4444', '#ec4899'];
    const avatar = { initials, color: colors[Math.floor(Math.random() * colors.length)] };
    const now = new Date();
    const user = {
      id: await nextId('users'),
      name,
      email,
      password: hashedPassword,
      role,
      avatar,
      created_at: now,
    };

    await db.collection('users').insertOne(user);

    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '7d' });

    res.status(201).json({
      message: 'Account created successfully',
      token,
      user: publicUser(user),
    });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ error: 'Failed to create account' });
  }
});

// POST /api/auth/login
router.post('/login', [
  body('email').isEmail().withMessage('Valid email is required').normalizeEmail(),
  body('password').notEmpty().withMessage('Password is required'),
], validate, async (req, res) => {
  try {
    const { email, password } = req.body;
    const db = await getDb();

    const user = await db.collection('users').findOne({ email });
    if (!user || !bcrypt.compareSync(password, user.password)) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '7d' });

    res.json({
      message: 'Login successful',
      token,
      user: publicUser(user),
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Login failed' });
  }
});

// GET /api/auth/me
router.get('/me', authenticate, async (req, res) => {
  const db = await getDb();
  const user = await db.collection('users').findOne({ id: req.user.id });
  res.json(publicUser(user));
});

// PUT /api/auth/profile
router.put('/profile', authenticate, [
  body('name').optional().trim().notEmpty().isLength({ max: 100 }),
  body('email').optional().isEmail().normalizeEmail(),
], validate, async (req, res) => {
  try {
    const { name, email } = req.body;
    const db = await getDb();

    if (email) {
      const existing = await db.collection('users').findOne({ email, id: { $ne: req.user.id } });
      if (existing) return res.status(409).json({ error: 'Email already in use' });
    }

    const updates = {};
    if (name) updates.name = name;
    if (email) updates.email = email;

    if (Object.keys(updates).length) {
      await db.collection('users').updateOne({ id: req.user.id }, { $set: updates });
    }

    const updated = await db.collection('users').findOne({ id: req.user.id });
    res.json(publicUser(updated));
  } catch (err) {
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

// PUT /api/auth/change-password
router.put('/change-password', authenticate, [
  body('currentPassword').notEmpty().withMessage('Current password required'),
  body('newPassword').isLength({ min: 6 }).withMessage('New password must be at least 6 characters'),
], validate, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const db = await getDb();
    const user = await db.collection('users').findOne({ id: toInt(req.user.id) });

    if (!user || !bcrypt.compareSync(currentPassword, user.password)) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }

    const hashed = bcrypt.hashSync(newPassword, 12);
    await db.collection('users').updateOne({ id: req.user.id }, { $set: { password: hashed } });
    res.json({ message: 'Password changed successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to change password' });
  }
});

module.exports = router;
