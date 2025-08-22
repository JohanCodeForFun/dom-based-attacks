// server.js
const express = require("express");
const helmet = require("helmet");
const cors = require("cors");
const { z } = require("zod");
const sqlite3 = require("sqlite3").verbose();

const app = express();
app.use(express.json({ limit: "64kb" }));
app.use(helmet({ contentSecurityPolicy: false })); // keep CSP off so DOM-XSS is visible in the demo

// ----- CORS: allow Live Server origins -----
const allowedOrigins = ["http://127.0.0.1:5500", "http://localhost:5500"];
const corsOptions = {
  origin(origin, cb) {
    if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
    return cb(new Error("Not allowed by CORS"));
  },
  methods: ["GET", "POST", "PATCH", "OPTIONS"],
  allowedHeaders: ["Content-Type"],
};
const allowFront = cors(corsOptions);

// ----- DB: demo-only in-memory -----
const db = new sqlite3.Database(":memory:");
db.serialize(() => {
  db.run(`CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL,
    password TEXT NOT NULL,
    role TEXT NOT NULL
  );`);
  const u = db.prepare(
    "INSERT INTO users (username, password, role) VALUES (?,?,?)"
  );
  [
    ["alice", "wonderland", "admin"],
    ["bob", "builder", "user"],
    ["charlie", "chocolate", "user"],
  ].forEach((r) => u.run(...r));
  u.finalize();

  db.run(`CREATE TABLE tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT NOT NULL, -- stored as-is; DOM-XSS is on the client render
    status TEXT NOT NULL CHECK (status IN ('todo','doing','done')) DEFAULT 'todo',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );`);
});

// ----- Schemas -----
const LoginSchema = z.object({
  username: z
    .string()
    .min(3)
    .max(32)
    .regex(/^[a-z0-9_]+$/i),
  password: z.string().min(3).max(128),
});
const NewTaskSchema = z.object({
  username: z
    .string()
    .min(3)
    .max(32)
    .regex(/^[a-z0-9_]+$/i),
  title: z.string().min(1).max(100),
  description: z.string().min(0).max(5000), // we do NOT sanitize here to show DOM-XSS on frontend
  status: z.enum(["todo", "doing", "done"]).default("todo"),
});
const UpdateTaskSchema = z.object({
  status: z.enum(["todo", "doing", "done"]),
});

// ----- Auth (safe) -----
app.options("/api/login", allowFront);
app.post("/api/login", allowFront, (req, res) => {
  const parsed = LoginSchema.safeParse(req.body);
  if (!parsed.success)
    return res.status(400).json({ message: "Invalid input" });
  const { username, password } = parsed.data;
  db.get(
    "SELECT id, username, role FROM users WHERE username = ? AND password = ?",
    [username, password],
    (err, row) => {
      if (err) return res.status(500).json({ message: "Server error" });
      if (!row) return res.status(401).json({ message: "Invalid credentials" });
      // Demo token: NOT secure, just echo username
      res.json({
        message: `Welcome ${row.username}`,
        role: row.role,
        token: row.username,
      });
    }
  );
});

// ----- Vulnerable login (SQLi) -----
app.options("/api/login-vulnerable", allowFront);
app.post("/api/login-vulnerable", allowFront, (req, res) => {
  const { username = "", password = "" } = req.body || {};
  const sql = `SELECT id, username, role FROM users WHERE username='${username}' AND password='${password}'`; // 🚨 injectable
  db.all(sql, (err, rows) => {
    if (err)
      return res.status(400).json({ message: `Query error: ${err.message}` });
    if (rows && rows.length)
      return res.json({
        message: `Logged in as ${rows[0].username} (${rows[0].role})`,
        token: rows[0].username,
      });
    return res.status(401).json({ message: "Invalid credentials" });
  });
});

// ----- Tasks API -----
// List tasks for a user
app.options("/api/tasks", allowFront);
app.get("/api/tasks", allowFront, (req, res) => {
  const user = (req.query.username || "").toString();
  if (!/^[a-z0-9_]{3,32}$/i.test(user))
    return res.status(400).json({ message: "Invalid user" });
  db.all(
    "SELECT id, username, title, description, status, created_at FROM tasks WHERE username = ? ORDER BY created_at DESC",
    [user],
    (err, rows) => {
      if (err) return res.status(500).json({ message: "Server error" });
      res.json({ tasks: rows });
    }
  );
});

// Create task (no sanitization here on purpose; DOM-XSS is client-side)
app.options("/api/tasks", allowFront);
app.post("/api/tasks", allowFront, (req, res) => {
  const parsed = NewTaskSchema.safeParse(req.body);
  if (!parsed.success)
    return res.status(400).json({ message: "Invalid input" });
  const { username, title, description, status } = parsed.data;
  const stmt = db.prepare(
    "INSERT INTO tasks (username, title, description, status) VALUES (?,?,?,?)"
  );
  stmt.run(username, title, description, status, function (err) {
    if (err) return res.status(500).json({ message: "Server error" });
    db.get(
      "SELECT id, username, title, description, status, created_at FROM tasks WHERE id = ?",
      [this.lastID],
      (e, row) => {
        if (e) return res.status(500).json({ message: "Server error" });
        res.status(201).json({ task: row });
      }
    );
  });
});

// Update task status
app.options("/api/tasks/:id", allowFront);
app.patch("/api/tasks/:id", allowFront, (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ message: "Bad id" });
  const parsed = UpdateTaskSchema.safeParse(req.body);
  if (!parsed.success)
    return res.status(400).json({ message: "Invalid status" });

  db.run(
    "UPDATE tasks SET status = ? WHERE id = ?",
    [parsed.data.status, id],
    function (err) {
      if (err) return res.status(500).json({ message: "Server error" });
      if (this.changes === 0)
        return res.status(404).json({ message: "Not found" });
      res.json({ message: "Updated" });
    }
  );
});

app.disable("x-powered-by");
const PORT = 3000;
app.listen(PORT, () => console.log(`API on http://localhost:${PORT}`));
