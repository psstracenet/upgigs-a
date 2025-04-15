const express = require("express");
const fs = require("fs");
const path = require("path");
const cors = require("cors");
const { OpenAI } = require("openai");

console.log("👀 server.js starting...");

const app = express();
const PORT = process.env.PORT || 3100;
const SECRET_TOKEN = process.env.SECRET_TOKEN || "gigs2025tokenX107";

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "dist")));

console.log("🔧 Middleware and static serving initialized.");

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Health check
app.get("/", (req, res) => {
  res.send("🎸 UpGigs API is alive!");
});

console.log("🔧 Registering /api/parse-and-add route...");

app.post("/api/parse-and-add", async (req, res) => {
  console.log("📩 Received parse-and-add request:", req.body);

  const authHeader = req.headers.authorization || "";
  const token = authHeader.replace("Bearer ", "");

  if (token !== SECRET_TOKEN) {
    console.warn("🚫 Invalid token received");
    return res.status(403).json({ error: "Forbidden: Invalid token" });
  }

  const { message } = req.body;
  if (!message) {
    return res.status(400).json({ error: "No message provided." });
  }

  try {
    console.log("🧠 Calling OpenAI with prompt:", message);
    const parsedGig = await callOpenAI(message);

    if (!parsedGig || parsedGig.error) {
      console.error("⚠️ OpenAI returned invalid response.");
      return res
        .status(422)
        .json({ error: "OpenAI returned invalid or unparseable JSON." });
    }

    const gigsPath = path.join(__dirname, "_data", "gigs.json");

    fs.readFile(gigsPath, "utf8", (err, data) => {
      if (err) {
        console.error("❌ Failed to read gigs.json:", err);
        return res.status(500).json({ error: "Failed to read gigs.json" });
      }

      const gigs = JSON.parse(data);
      gigs.push(parsedGig);

      console.log("💾 Writing updated gigs.json...");
      fs.writeFile(gigsPath, JSON.stringify(gigs, null, 2), (err) => {
        if (err) {
          console.error("❌ Failed to write gigs.json:", err);
          return res.status(500).json({ error: "Failed to write gigs.json" });
        }

        console.log("✅ Gig saved:", parsedGig);
        res.json({ success: true, gig: parsedGig });
      });
    });
  } catch (error) {
    console.error("🔥 Error in /api/parse-and-add:", error);
    res.status(500).json({ error: "Failed to parse message using OpenAI." });
  }
});

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

async function callOpenAI(prompt) {
  const systemPrompt = `
You are a strict JSON generator. Only respond with this format:
{"date":"2025-10-02","venue":"The Bluebird","city":"Nashville","time":"8:30 PM"}
Return valid one-line JSON. No other text. If unparseable, return: {"error":"unparseable"}
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

app
  .listen(PORT, () => {
    console.log(`Server listening at http://localhost:${PORT}`);
  })
  .on("error", (err) => {
    console.error("💥 Failed to bind server:", err);
  });

// 🔐 Catch unexpected runtime crashes
process.on("uncaughtException", (err) => {
  console.error("💥 Uncaught Exception:", err);
});
process.on("unhandledRejection", (reason) => {
  console.error("💥 Unhandled Promise Rejection:", reason);
});
