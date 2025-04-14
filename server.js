const express = require("express");
const fs = require("fs");
const path = require("path");
const fetch = (...args) =>
  import("node-fetch").then(({ default: fetch }) => fetch(...args));
const cors = require("cors");

const app = express(); // ✅ Declare app first

app.use(cors()); // ✅ Then apply CORS
app.use(express.json()); // ✅ Then use JSON middleware

const PORT = process.env.PORT || 3100;

// --- AI parser using Ollama + deepseek-r1:7b ---
async function callOllamaDeepseek(prompt) {
  const res = await fetch("http://localhost:11434/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "deepseek-r1:7b",
      format: "json",
      messages: [
        {
          role: "system",
          content:
            "You extract structured gig details and respond with raw JSON using keys: date, venue, city, time.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
    }),
  });

  const raw = await res.text();
  console.log("🔍 FULL RAW OLLAMA RESPONSE:\n", raw);

  const lines = raw.trim().split("\n").filter(Boolean);

  let combined = "";

  for (const line of lines) {
    try {
      const parsed = JSON.parse(line);
      if (parsed.message && parsed.message.content) {
        combined += parsed.message.content;
      }
    } catch (err) {
      // skip malformed lines
    }
  }

  const jsonStr = combined.trim();
  console.log("✅ Final combined response:\n", jsonStr);

  if (!jsonStr || !jsonStr.startsWith("{")) {
    throw new Error("AI returned invalid JSON.");
  }

  try {
    const cleaned = jsonStr.replace(/,\s*}/g, "}");
    return JSON.parse(cleaned);
  } catch (err) {
    console.error("❌ Failed to parse:\n", jsonStr);
    throw err;
  }
}

app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  next();
});

// --- POST route for AI-parsed natural language input ---
app.post("/api/parse-and-add", async (req, res) => {
  const { message } = req.body;
  if (!message) return res.status(400).json({ error: "No message provided." });

  try {
    const parsedGig = await callOllamaDeepseek(message);

    if (!parsedGig || !parsedGig.date) {
      return res
        .status(422)
        .json({ error: "Could not parse message into gig format." });
    }

    const gigsPath = path.join(__dirname, "_data", "gigs.json");
    const data = await fs.promises.readFile(gigsPath, "utf8");
    const gigs = JSON.parse(data);
    gigs.push(parsedGig);
    await fs.promises.writeFile(gigsPath, JSON.stringify(gigs, null, 2));
    res.json({ success: true, gig: parsedGig });
  } catch (err) {
    console.error("Ollama error:", err.message || err);
    res.status(500).json({ error: "Ollama AI error." });
  }
});

// --- POST route for direct JSON gig input ---
app.post("/api/add-gig", (req, res) => {
  const newGig = req.body;
  const gigsPath = path.join(__dirname, "_data", "gigs.json");

  fs.readFile(gigsPath, "utf8", (err, data) => {
    if (err) return res.status(500).json({ error: "Failed to read gigs.json" });

    let gigs = JSON.parse(data);
    gigs.push(newGig);

    fs.writeFile(gigsPath, JSON.stringify(gigs, null, 2), (err) => {
      if (err)
        return res.status(500).json({ error: "Failed to write gigs.json" });
      res.json({ success: true, gigs });
    });
  });
});

app.get("/", (req, res) => {
  res.send("🎸 UpGigs API is alive!");
});

app.listen(PORT, () => {
  console.log(`Server listening at http://localhost:${PORT}`);
});
