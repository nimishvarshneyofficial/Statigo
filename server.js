import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const app = express();
const PORT = process.env.PORT || 4000;
const SECRET = process.env.JWT_SECRET || "statigo-local-secret";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.join(__dirname, "data", "database.json");
fs.mkdirSync(path.dirname(dbPath), { recursive: true });
if (!fs.existsSync(dbPath)) fs.writeFileSync(dbPath, JSON.stringify({ users: [], todos: [], sessions: [] }, null, 2));
const readDb = () => JSON.parse(fs.readFileSync(dbPath, "utf8"));
const writeDb = (db) => fs.writeFileSync(dbPath, JSON.stringify(db, null, 2));
const id = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const auth = (req, res, next) => {
  try {
    const token = req.headers.authorization?.replace("Bearer ", "");
    req.user = jwt.verify(token, SECRET);
    next();
  } catch { res.status(401).json({ error: "Please sign in again." }); }
};

app.use(express.json());
app.post("/api/auth/register", async (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password || password.length < 6) return res.status(400).json({ error: "Name, email and a 6+ character password are required." });
  const db = readDb();
  if (db.users.some((u) => u.email === email.toLowerCase())) return res.status(409).json({ error: "An account with that email already exists." });
  const user = { id: id(), name, email: email.toLowerCase(), password: await bcrypt.hash(password, 10), plan: "free", createdAt: new Date().toISOString() };
  db.users.push(user); writeDb(db);
  res.json({ token: jwt.sign({ id: user.id, name: user.name, email: user.email, plan: user.plan }, SECRET, { expiresIn: "7d" }) });
});
app.post("/api/auth/login", async (req, res) => {
  const db = readDb(); const user = db.users.find((u) => u.email === String(req.body.email || "").toLowerCase());
  if (!user || !(await bcrypt.compare(req.body.password || "", user.password))) return res.status(401).json({ error: "Email or password is incorrect." });
  res.json({ token: jwt.sign({ id: user.id, name: user.name, email: user.email, plan: user.plan }, SECRET, { expiresIn: "7d" }) });
});
app.get("/api/me", auth, (req, res) => {
  const user = readDb().users.find((item) => item.id === req.user.id);
  if (!user) return res.status(404).json({ error: "Account not found." });
  res.json({ id: user.id, name: user.name, email: user.email, plan: user.plan, theme: user.theme || "light" });
});
app.patch("/api/me", auth, (req, res) => {
  const db = readDb(); const user = db.users.find((item) => item.id === req.user.id);
  if (!user) return res.status(404).json({ error: "Account not found." });
  if (typeof req.body.name === "string" && req.body.name.trim()) user.name = req.body.name.trim();
  if (["light", "dark", "ocean", "sunset", "forest", "rose"].includes(req.body.theme)) user.theme = req.body.theme;
  writeDb(db); res.json({ id: user.id, name: user.name, email: user.email, plan: user.plan, theme: user.theme || "light" });
});
app.post("/api/premium/redeem", auth, (req, res) => {
  if (String(req.body.code || "").trim().toUpperCase() !== "TOBICHAN") return res.status(400).json({ error: "That code is not valid." });
  const db = readDb(); const user = db.users.find((item) => item.id === req.user.id);
  if (!user) return res.status(404).json({ error: "Account not found." });
  user.plan = "premium"; user.premiumCode = "TOBICHAN"; user.premiumSince = new Date().toISOString(); writeDb(db);
  const profile = { id: user.id, name: user.name, email: user.email, plan: user.plan, theme: user.theme || "light" };
  res.json({ user: profile, token: jwt.sign({ ...profile }, SECRET, { expiresIn: "7d" }) });
});
app.get("/api/dashboard", auth, (req, res) => {
  const db = readDb(); const todos = db.todos.filter((t) => t.userId === req.user.id);
  const days = Array.from({ length: 7 }, (_, i) => ({ day: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"][i], minutes: 0 }));
  res.json({ todos, days, stats: { streak: 0, focusMinutes: 0, sessions: 0, completion: todos.length ? Math.round(todos.filter((t) => t.done).length / todos.length * 100) : 0 } });
});
app.get("/api/todos", auth, (req, res) => res.json(readDb().todos.filter((t) => t.userId === req.user.id)));
app.post("/api/todos", auth, (req, res) => {
  const { title, subject = "General", dueDate = new Date().toISOString().slice(0, 10), priority = "Medium" } = req.body;
  if (!title?.trim()) return res.status(400).json({ error: "A task title is required." });
  const task = { id: id(), userId: req.user.id, title: title.trim(), subject, dueDate, priority, done: false };
  const db = readDb(); db.todos.unshift(task); writeDb(db); res.status(201).json(task);
});
app.patch("/api/todos/:todoId", auth, (req, res) => {
  const db = readDb(); const task = db.todos.find((t) => t.id === req.params.todoId && t.userId === req.user.id);
  if (!task) return res.status(404).json({ error: "Task not found." });
  Object.assign(task, req.body); writeDb(db); res.json(task);
});
app.delete("/api/todos/:todoId", auth, (req, res) => {
  const db = readDb(); db.todos = db.todos.filter((t) => !(t.id === req.params.todoId && t.userId === req.user.id)); writeDb(db); res.status(204).end();
});
app.use(express.static(path.join(__dirname, "dist")));
app.get("*", (_, res) => res.sendFile(path.join(__dirname, "dist", "index.html")));
app.listen(PORT, () => console.log(`Statigo API running on http://localhost:${PORT}`));
