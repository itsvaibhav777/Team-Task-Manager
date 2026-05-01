const { MongoClient } = require('mongodb');
const bcrypt = require('bcryptjs');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017';
const MONGODB_DB = process.env.MONGODB_DB || 'team_task_manager';

let client;
let db;

async function getDb() {
  if (!db) {
    client = new MongoClient(MONGODB_URI);
    await client.connect();
    db = client.db(MONGODB_DB);
    await initializeSchema();
  }

  return db;
}

async function initializeSchema() {
  await Promise.all([
    db.collection('users').createIndex({ id: 1 }, { unique: true }),
    db.collection('users').createIndex({ email: 1 }, { unique: true }),
    db.collection('projects').createIndex({ id: 1 }, { unique: true }),
    db.collection('project_members').createIndex({ id: 1 }, { unique: true }),
    db.collection('project_members').createIndex({ project_id: 1, user_id: 1 }, { unique: true }),
    db.collection('tasks').createIndex({ id: 1 }, { unique: true }),
    db.collection('tasks').createIndex({ project_id: 1 }),
    db.collection('tasks').createIndex({ assignee_id: 1 }),
    db.collection('task_comments').createIndex({ id: 1 }, { unique: true }),
    db.collection('task_comments').createIndex({ task_id: 1 }),
    db.collection('notifications').createIndex({ id: 1 }, { unique: true }),
    db.collection('notifications').createIndex({ user_id: 1, read: 1 }),
  ]);

  await seedDemoUsers();
}

async function seedDemoUsers() {
  const userCount = await db.collection('users').countDocuments();
  if (userCount > 0) return;

  const now = new Date();
  await db.collection('users').insertMany([
    {
      id: await nextId('users'),
      name: 'Demo Admin',
      email: 'admin@demo.com',
      password: bcrypt.hashSync('admin123', 12),
      role: 'admin',
      avatar: { initials: 'DA', color: '#6366f1' },
      created_at: now,
    },
    {
      id: await nextId('users'),
      name: 'Demo Member',
      email: 'member@demo.com',
      password: bcrypt.hashSync('member123', 12),
      role: 'member',
      avatar: { initials: 'DM', color: '#10b981' },
      created_at: now,
    },
  ]);
}

async function nextId(sequenceName) {
  const result = await db.collection('counters').findOneAndUpdate(
    { _id: sequenceName },
    { $inc: { value: 1 } },
    { upsert: true, returnDocument: 'after' }
  );

  if (result?.value && typeof result.value === 'object') {
    return result.value.value;
  }

  return result?.value;
}

function toInt(value) {
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? value : parsed;
}

function stripMongoId(document) {
  if (!document) return document;
  const { _id, ...rest } = document;
  return rest;
}

function parseAvatar(avatar) {
  if (!avatar) return {};
  if (typeof avatar === 'object') return avatar;

  try {
    return JSON.parse(avatar);
  } catch (_err) {
    return {};
  }
}

function formatDate(value) {
  if (!value) return value;
  if (value instanceof Date) return value.toISOString();
  return value;
}

function formatRecord(document) {
  const record = stripMongoId(document);
  if (!record) return record;

  return {
    ...record,
    created_at: formatDate(record.created_at),
    updated_at: formatDate(record.updated_at),
    joined_at: formatDate(record.joined_at),
  };
}

async function closeDb() {
  if (client) {
    await client.close();
    client = null;
    db = null;
  }
}

module.exports = {
  closeDb,
  formatRecord,
  getDb,
  nextId,
  parseAvatar,
  stripMongoId,
  toInt,
};
