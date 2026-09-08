// db.js
//
// This is the ENTIRE "database setup" for this project. There is no
// separate database server to install or start. better-sqlite3 stores
// everything in a single file (kudos.db) that gets created automatically
// the first time this file runs. Deleting kudos.db and restarting the
// server gives you a fresh database.

const path = require("path");
const Database = require("better-sqlite3");

const DB_PATH = path.join(__dirname, "kudos.db");
const db = new Database(DB_PATH);

db.pragma("foreign_keys = ON");

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    is_admin INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS kudos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sender_id INTEGER NOT NULL REFERENCES users(id),
    recipient_id INTEGER NOT NULL REFERENCES users(id),
    message TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    is_visible INTEGER NOT NULL DEFAULT 1,
    moderated_by INTEGER REFERENCES users(id),
    moderated_at TEXT,
    reason_for_moderation TEXT
  );
`);

// Seed a handful of users (including one admin) only if the table is empty,
// so restarting the server doesn't keep duplicating sample data.
const userCount = db.prepare("SELECT COUNT(*) AS count FROM users").get().count;

if (userCount === 0) {
  const insertUser = db.prepare(
    "INSERT INTO users (name, email, is_admin) VALUES (?, ?, ?)"
  );
  insertUser.run("Alex Chen", "alex.chen@datacom.example", 1); // admin
  insertUser.run("Priya Sharma", "priya.sharma@datacom.example", 0);
  insertUser.run("Sam Okoye", "sam.okoye@datacom.example", 0);
  insertUser.run("Jordan Lee", "jordan.lee@datacom.example", 0);

  const insertKudos = db.prepare(
    "INSERT INTO kudos (sender_id, recipient_id, message) VALUES (?, ?, ?)"
  );
  insertKudos.run(2, 3, "Thanks for jumping in on the release last night, you saved us hours.");
  insertKudos.run(3, 4, "Really clear explanation in today's standup, made the handoff easy.");
  insertKudos.run(4, 2, "Appreciate you reviewing my PR so quickly!");

  console.log("Seeded starter users and kudos.");
}

module.exports = db;
