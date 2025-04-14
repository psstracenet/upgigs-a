const express = require("express");
const fs = require("fs");
const path = require("path");
const cors = require("cors");
const { OpenAI } = require("openai");

const app = express();
const PORT = process.env.PORT || 3100;
const SECRET_TOKEN = process.env.SECRET_TOKEN || "gigs2025tokenXYZ";

// Middleware
app.use(cors());
app.use(express.json());

// ✅ Serve Eleventy static files
app.use(express.static(path.join(__dirname, "dist")));

// OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Health check
app.get("/", (req, res) => {
  res.send("🎸 UpGigs API is alive!");
});

// 🔐 AI-powered endpoint with token auth
app.post("/api/parse-and-add", async (req, res) => {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.replace("Bearer ", "");

  if (token !== SECRET_TOKEN) {
    return res.status(403).json({ error: "Forbidden: Invalid token" });
  }

  const { message } = req.body;
  if (!message) {
    return res.status(400).json({ error: "No message provided." });
  }

  try {
    const parsedGig = await callOpenAI(message);

    if (!parsedGig || parsedGig.error) {
      return res
        .status(422)
        .json({ error: "OpenAI returned invalid or unparseable JSON." });
    }

    const gigsPath = path.join(__dirname, "_data", "gigs.json");
    fs.readFile(gigsPath, "utf8", (err, data) => {
      if (err)
        return res.status(500).json({ error: "Failed to read gigs.json" });

      const gigs = JSON.parse(data);
      gigs.push(parsedGig);

      fs.writeFile(gigsPath, JSON.stringify(gigs, null, 2), (err) => {
        if (err)
          return res.status(500).json({ error: "Failed to write gigs.json" });
        res.json({ success: true, gig: parsedGig });
      });
    });
  } catch (error) {
    console.error("OpenAI error:", error);
    res.status(500).json({ error: "Failed to parse message using OpenAI." });
  }
});

// 🔁 Direct gig input endpoint
app.post("/api/add-gig", (req, res) => {
  const newGig = req.body;
  const gigsPath = path.join(__dirname, "_data", "gigs.json");

  fs.readFile(gigsPath, "utf8", (err, data) => {
    if (err) return res.status(500).json({ error: "Failed to read gigs.json" });

    const gigs = JSON.parse(data);
    gigs.push(newGig);

    fs.writeFile(gigsPath, JSON.stringify(gigs, null, 2), (err) => {
      if (err)
        return res.status(500).json({ error: "Failed to write gigs.json" });
      res.json({ success: true, gigs });
    });
  });
});

// 🧠 OpenAI gig extractor
async function callOpenAI(prompt) {
  const systemPrompt = `
  You are a strict JSON generator. Only reply with this format:
  {"date":"2025-10-02","venue":"The Bluebird","city":"Nashville","time":"8:30 PM"}
  No explanations. Just one line of raw JSON.
  `;

  const response = await openai.chat.completions.create({
    model: "gpt-3.5-turbo",
    temperature: 0.2,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: prompt },
    ],
  });

  const rawContent = response.choices[0].message.content;

  console.log(
    "🔎 Raw OpenAI full response:\n",
    JSON.stringify(response, null, 2)
  );
  console.log("🧠 OpenAI responded:");
  console.log("-----");
  console.log(rawContent);
  console.log("-----");

  if (!rawContent || rawContent.trim() === "") {
    console.error("⚠️ OpenAI returned an empty response.");
    return null;
  }

  try {
    return JSON.parse(rawContent);
  } catch (err) {
    console.error("❌ Failed to parse OpenAI response:\n", rawContent);
    return null;
  }
}

app.listen(PORT, () => {
  console.log(`Server listening at http://localhost:${PORT}`);
});
