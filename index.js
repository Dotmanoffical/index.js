require("dotenv").config();

const { randomUUID } = require("node:crypto");
const fs = require("node:fs");
const express = require("express");
const path = require("node:path");

const dataDirectory = path.join(__dirname, "data");
const usersFile = path.join(dataDirectory, "users.json");

function readUsers() {
  let contents;

  try {
    contents = fs.readFileSync(usersFile, "utf8");
  } catch (error) {
    if (error.code === "ENOENT") {
      return [];
    }

    throw error;
  }

  const users = JSON.parse(contents);
  if (!Array.isArray(users)) {
    throw new Error("User data must be a JSON array");
  }

  return users;
}

function saveUsers(users) {
  fs.mkdirSync(dataDirectory, { recursive: true });

  const temporaryFile = `${usersFile}.${randomUUID()}.tmp`;
  fs.writeFileSync(temporaryFile, JSON.stringify(users, null, 2));
  fs.renameSync(temporaryFile, usersFile);
}

const app = express();
app.use((req, res, next) => {
  const startedAt = Date.now();

  res.on("finish", () => {
    console.log(
      `${req.method} ${req.originalUrl} ${res.statusCode} ${Date.now() - startedAt}ms`,
    );
  });

  next();
});
app.use(express.json());
app.use((err, req, res, next) => {
  if (err.type === "entity.parse.failed") {
    return res.status(400).json({ error: "Invalid JSON" });
  }

  return next(err);
});
app.use(express.static(path.join(__dirname, "public")));

app.post("/register", (req, res) => {
  const { name, email } = req.body ?? {};

  if (typeof name !== "string" || typeof email !== "string") {
    return res.status(400).json({ error: "name and email are required" });
  }

  const normalizedName = name.trim();
  const normalizedEmail = email.trim().toLowerCase();
  const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail);

  if (!normalizedName || normalizedName.length > 100) {
    return res.status(400).json({ error: "name must be between 1 and 100 characters" });
  }

  if (normalizedEmail.length > 254 || !validEmail) {
    return res.status(400).json({ error: "a valid email is required" });
  }

  const users = readUsers();
  if (users.some((user) => user.email === normalizedEmail)) {
    return res.status(409).json({ error: "email is already registered" });
  }

  const user = {
    id: randomUUID(),
    name: normalizedName,
    email: normalizedEmail,
  };
  users.push(user);
  saveUsers(users);

  return res.status(201).json({
    message: `Registered: ${user.name} (${user.email})`,
    user,
  });
});

app.get("/user/:id", (req, res) => {
  const user = readUsers().find((registeredUser) => registeredUser.id === req.params.id);
  if (!user) {
    return res.status(404).json({ error: "user not found" });
  }

  return res.json(user);
});

app.use((err, req, res, next) => {
  if (res.headersSent) {
    return next(err);
  }

  console.error(err);
  return res.status(500).json({ error: "Internal server error" });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
