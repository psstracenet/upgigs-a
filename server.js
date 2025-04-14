const express = require("express");
const fs = require("fs");
const path = require("path");
const cors = require("cors");
const { OpenAI } = require("openai");
const SECRET_TOKEN = process.env.SECRET_TOKEN || "gigs2025tokenX107";

const app = express();
const PORT = process.env.PORT || 3100;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "dist")));

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Health check route
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
    const parsedGig = await callOpenAI(message); //

    if (!parsedGig) {
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

// POST route to add a gig directly via JSON
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

// OpenAI gig parser
async function callOpenAI(prompt) {
  const systemPrompt = `You are a JSON API. Extract the gig details from the message below.
Respond ONLY with a single line of raw JSON, using these exact keys:
"date", "venue", "city", "time". Do NOT include any text before or after the JSON.

Example:
{"date":"2025-08-20","venue":"The Fillmore","city":"San Francisco","time":"9:00 PM"}`;

  const response = await openai.chat.completions.create({
    model: "gpt-3.5-turbo",
    temperature: 0.2,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: prompt },
    ],
  });

  const content = response.choices[0].message.content;
  console.log("🧠 OpenAI response:\n", content);

  try {
    return JSON.parse(content);
  } catch (err) {
    console.error("❌ Failed to parse OpenAI response:\n", content);
    return null;
  }
}

// Start server
app.listen(PORT, () => {
  console.log(`Server listening at http://localhost:${PORT}`);
});
