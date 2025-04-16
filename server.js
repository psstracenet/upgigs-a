const express = require("express");
const path = require("path");
const fs = require("fs");
const bodyParser = require("body-parser");
const { Low, JSONFile } = require("lowdb");

const app = express();
const PORT = process.env.PORT || 8080;

// 🗂 Setup lowdb
const gigsFile = path.join(__dirname, "runtime", "gigs.json");
const adapter = new JSONFile(gigsFile);
const db = new Low(adapter);

// 🖼 Setup EJS view engine
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

// 🛡 Middleware
app.use(bodyParser.json());
app.use(express.static("public")); // Optional for CSS or JS files

// 📄 Load gigs
async function loadGigs() {
  await db.read();
  db.data ||= { gigs: [] };
  return db.data.gigs;
}

// 🏠 Route: Render homepage with gigs
app.get("/", async (req, res) => {
  const gigs = await loadGigs();
  res.render("index", { gigs });
});

// 🌐 Route: Get gigs as JSON
app.get("/api/gigs", async (req, res) => {
  const gigs = await loadGigs();
  res.json(gigs);
});

// ✉️ Route: Add gig from OpenAI-parsed message
app.post("/api/parse-and-add", async (req, res) => {
  const gig = req.body;
  if (!gig || !gig.date || !gig.venue || !gig.city || !gig.time) {
    return res.status(400).json({ error: "Missing fields" });
  }

  const gigs = await loadGigs();
  gigs.push(gig);
  await db.write();

  res.json({ gig });
});

app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});
