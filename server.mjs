import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { Low } from "lowdb";
import { JSONFile } from "lowdb/node";
import dotenv from "dotenv";

// Load env vars
dotenv.config();

// Setup ESM __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.PORT || 8080;
const BASE_URL = process.env.BASE_URL || `http://localhost:${PORT}`;
const SECRET_TOKEN = process.env.SECRET_TOKEN || "gigs2025tokenX107";

// Setup Express
const app = express();
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.use(express.json());
app.use(express.static("public"));

// Setup LowDB
const gigsFile = path.join(__dirname, "runtime", "gigs.json");
const adapter = new JSONFile(gigsFile);

// ✅ PASS DEFAULT STRUCTURE TO THE CONSTRUCTOR
const db = new Low(adapter, { gigs: [] });

await db.read();

// Route: homepage with EJS rendering
app.get("/", (req, res) => {
  const gigs = db.data.gigs;
  res.render("index", { gigs });
});

// Route: API gigs list
app.get("/api/gigs", (req, res) => {
  res.json(db.data.gigs);
});

// Route: Add gig from AI/email or form
app.post("/api/parse-and-add", async (req, res) => {
  const auth = req.headers.authorization;
  if (!auth || auth !== `Bearer ${SECRET_TOKEN}`) {
    return res.status(403).json({ error: "Forbidden: Invalid token" });
  }

  const gig = req.body;
  if (!gig || !gig.date || !gig.venue || !gig.city || !gig.time) {
    return res.status(400).json({ error: "Missing fields" });
  }

  db.data.gigs.push(gig);
  await db.write();

  res.json({ gig });
});

app.get("/update", (req, res) => {
  res.render("update");
});

// Start the server
app.listen(PORT, () => {
  console.log(`🚀 Server running at ${BASE_URL}`);
});
