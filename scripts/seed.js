// Run once with: npm run seed
// Creates the admin account (password is hashed with bcrypt before it ever
// touches disk) and a demo client account so you can see both portals work.

const bcrypt = require('bcryptjs');
const { v4: uuid } = require('uuid');
const db = require('../src/db');

db.ensureDataDir();

const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'The company';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'luxureb19';

const users = db.readAll('users');

if (!users.find(u => u.username === ADMIN_USERNAME)) {
  users.push({
    id: uuid(),
    username: ADMIN_USERNAME,
    passwordHash: bcrypt.hashSync(ADMIN_PASSWORD, 12),
    role: 'admin',
    companyName: 'The B Company',
    email: null,
    active: true,
    createdAt: new Date().toISOString()
  });
  console.log(`Created admin account: "${ADMIN_USERNAME}"`);
} else {
  console.log('Admin account already exists — skipped.');
}

const demoClientUsername = 'demo-client';
if (!users.find(u => u.username === demoClientUsername)) {
  users.push({
    id: uuid(),
    username: demoClientUsername,
    passwordHash: bcrypt.hashSync('ChangeMe123!', 12),
    role: 'client',
    companyName: 'Orion Textiles Pvt Ltd',
    email: 'contact@oriontextiles.example',
    active: true,
    createdAt: new Date().toISOString()
  });
  console.log(`Created demo client account: "${demoClientUsername}" / "ChangeMe123!"`);
}

db.writeAll('users', users);

console.log('\nSeed complete. IMPORTANT: change the admin password after first login,');
console.log('and delete/rotate the demo client account before going live.\n');
