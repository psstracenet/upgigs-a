const express = require("express");
const fs = require("fs");
const path = require("path");
const OpenAI = require("openai");
const bodyParser = require("body-parser");

const app = express();
const PORT = process.env.PORT || 8080;

// Env setup
const SECRET_TOKEN = process.env.SECRET_TOKEN || "gigs2025tokenX107";
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
if (!OPENAI_API_KEY) {
  console.error("❌ OPENAI_API_KEY not set!");
  process.exit(1);
}
const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

// Middleware
app.use(bodyParser.json());
app.use(express.static("dist"));

// Gig file and memory fallback
const gigsPath = path.join(__dirname, "_data", "gigs.json");

let gigsCache = [];
let isFileWritable = true;

// Load gigs from file or start fresh
try {
  const content = fs.readFileSync(gigsPath, "utf-8");
  gigsCache = JSON.parse(content);
} catch {
  console.warn("📁 No gigs.json found. Starting with empty list.");
  gigsCache = [];
}

// Check write access
try {
  fs.accessSync(gigsPath, fs.constants.W_OK);
} catch {
  console.warn("⚠️ gigs.json not writable — running in memory mode");
  isFileWritable = false;
}

// Serve gigs dynamically
app.get("/gigs.json", (req, res) => {
  res.json(gigsCache);
});

// POST: parse and add gig via AI
app.post("/api/parse-and-add", async (req, res) => {
  const auth = req.headers.authorization;
  if (!auth || auth !== `Bearer ${SECRET_TOKEN}`) {
    return res.status(403).json({ error: "Forbidden: Invalid token" });
  }

  const message = req.body.message;
  if (!message) {
    return res.status(400).json({ error: "Missing message" });
  }

  try {
    const aiResponse = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        {
          role: "system",
          content:
            "Extract gig info from a sentence. Return JSON with keys: date, venue, city, time.",
        },
        {
          role: "user",
          content: message,
        },
      ],
    });

    const parsed = JSON.parse(aiResponse.choices[0].message.content.trim());
    gigsCache.push(parsed);

    if (isFileWritable) {
      try {
        fs.writeFileSync(gigsPath, JSON.stringify(gigsCache, null, 2));
      } catch (err) {
        console.warn("❌ Failed to write gigs.json:", err.message);
      }
    }

    res.json({ gig: parsed });
  } catch (err) {
    console.error("❌ AI parsing failed:", err);
    res.status(500).json({ error: "Failed to parse message" });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});
