// server.js
const express = require("express");
const path = require("path");
const db = require("./db");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// ---------------------------------------------------------------------
// Auth helper
//
// This project simulates "who am I logged in as" via an x-user-id header
// sent by the frontend (chosen from a dropdown - see public/app.js).
// There's no password/login flow, since that's out of scope for this
// exercise, but the important security rule from the spec still holds:
// the server NEVER trusts a client-sent "is admin" flag. It always looks
// the user up in the database itself and checks is_admin there.
// ---------------------------------------------------------------------

function getCurrentUser(req) {
  const userId = Number(req.header("x-user-id"));
  if (!userId) return null;
  return db.prepare("SELECT * FROM users WHERE id = ?").get(userId) || null;
}

function requireAdmin(req, res, next) {
  const user = getCurrentUser(req);
  if (!user) {
    return res.status(401).json({ error: "Missing or invalid x-user-id." });
  }
  if (!user.is_admin) {
    return res.status(403).json({ error: "Admin access required." });
  }
  req.currentUser = user;
  next();
}

// ---------------------------------------------------------------------
// Public endpoints
// ---------------------------------------------------------------------

// GET /api/users - list all users, for the "select a colleague" dropdown
app.get("/api/users", (req, res) => {
  const users = db.prepare("SELECT id, name, email, is_admin FROM users ORDER BY name").all();
  res.json(users);
});

// POST /api/kudos - submit a new kudos
app.post("/api/kudos", (req, res) => {
  const senderId = Number(req.header("x-user-id"));
  const { recipient_id, message } = req.body;

  if (!senderId) {
    return res.status(401).json({ error: "Missing x-user-id header - who is sending this kudos?" });
  }
  if (!recipient_id) {
    return res.status(400).json({ error: "recipient_id is required." });
  }
  if (Number(recipient_id) === senderId) {
    return res.status(400).json({ error: "You can't give kudos to yourself." });
  }
  if (!message || !message.trim()) {
    return res.status(400).json({ error: "Message is required." });
  }
  if (message.length > 500) {
    return res.status(400).json({ error: "Message must be 500 characters or fewer." });
  }

  const sender = db.prepare("SELECT id FROM users WHERE id = ?").get(senderId);
  const recipient = db.prepare("SELECT id FROM users WHERE id = ?").get(recipient_id);
  if (!sender || !recipient) {
    return res.status(400).json({ error: "Unknown sender or recipient." });
  }

  const result = db
    .prepare("INSERT INTO kudos (sender_id, recipient_id, message) VALUES (?, ?, ?)")
    .run(senderId, recipient_id, message.trim());

  const created = db.prepare("SELECT * FROM kudos WHERE id = ?").get(result.lastInsertRowid);
  res.status(201).json(created);
});

// GET /api/kudos - public feed: recent, VISIBLE kudos only, newest first
app.get("/api/kudos", (req, res) => {
  const rows = db
    .prepare(
      `SELECT kudos.id, kudos.message, kudos.created_at,
              sender.name AS sender_name,
              recipient.name AS recipient_name
       FROM kudos
       JOIN users AS sender ON sender.id = kudos.sender_id
       JOIN users AS recipient ON recipient.id = kudos.recipient_id
       WHERE kudos.is_visible = 1
       ORDER BY kudos.created_at DESC
       LIMIT 50`
    )
    .all();
  res.json(rows);
});

// ---------------------------------------------------------------------
// Admin-only endpoints (server-side admin check via requireAdmin)
// ---------------------------------------------------------------------

// GET /api/admin/kudos - ALL kudos, including hidden ones
app.get("/api/admin/kudos", requireAdmin, (req, res) => {
  const rows = db
    .prepare(
      `SELECT kudos.*,
              sender.name AS sender_name,
              recipient.name AS recipient_name,
              moderator.name AS moderated_by_name
       FROM kudos
       JOIN users AS sender ON sender.id = kudos.sender_id
       JOIN users AS recipient ON recipient.id = kudos.recipient_id
       LEFT JOIN users AS moderator ON moderator.id = kudos.moderated_by
       ORDER BY kudos.created_at DESC`
    )
    .all();
  res.json(rows);
});

// PATCH /api/admin/kudos/:id/hide - soft-delete: mark as hidden, log why
app.patch("/api/admin/kudos/:id/hide", requireAdmin, (req, res) => {
  const { reason_for_moderation } = req.body;
  const kudos = db.prepare("SELECT * FROM kudos WHERE id = ?").get(req.params.id);
  if (!kudos) return res.status(404).json({ error: "Kudos not found." });

  db.prepare(
    `UPDATE kudos
     SET is_visible = 0,
         moderated_by = ?,
         moderated_at = datetime('now'),
         reason_for_moderation = ?
     WHERE id = ?`
  ).run(req.currentUser.id, reason_for_moderation || null, req.params.id);

  const updated = db.prepare("SELECT * FROM kudos WHERE id = ?").get(req.params.id);
  res.json(updated);
});

// PATCH /api/admin/kudos/:id/unhide - restore a hidden kudos
app.patch("/api/admin/kudos/:id/unhide", requireAdmin, (req, res) => {
  const kudos = db.prepare("SELECT * FROM kudos WHERE id = ?").get(req.params.id);
  if (!kudos) return res.status(404).json({ error: "Kudos not found." });

  db.prepare(
    `UPDATE kudos
     SET is_visible = 1, moderated_by = NULL, moderated_at = NULL, reason_for_moderation = NULL
     WHERE id = ?`
  ).run(req.params.id);

  const updated = db.prepare("SELECT * FROM kudos WHERE id = ?").get(req.params.id);
  res.json(updated);
});

// DELETE /api/admin/kudos/:id - permanent delete
app.delete("/api/admin/kudos/:id", requireAdmin, (req, res) => {
  const kudos = db.prepare("SELECT * FROM kudos WHERE id = ?").get(req.params.id);
  if (!kudos) return res.status(404).json({ error: "Kudos not found." });

  db.prepare("DELETE FROM kudos WHERE id = ?").run(req.params.id);
  res.json({ deleted: true, id: Number(req.params.id) });
});

app.listen(PORT, () => {
  console.log(`Kudos system running at http://localhost:${PORT}`);
});
