import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { Low } from "lowdb";
import { JSONFile } from "lowdb/node";
import dotenv from "dotenv";

import Imap from "imap";
import { simpleParser } from "mailparser";
import fetch from "node-fetch";

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
app.use(express.static(path.join(__dirname, "public")));
app.use(express.urlencoded({ extended: true }));

import fs from "fs";
import util from "util";
const appendLog = util.promisify(fs.appendFile);
const logFile = path.join(__dirname, "logs", "parser.log");

async function logParserResult(source, input, output) {
  const log = `[${new Date().toISOString()}] [${source.toUpperCase()}]
Input: ${input.trim().slice(0, 300)}...
Output: ${JSON.stringify(output).slice(0, 500)}...

---\n`;
  try {
    await appendLog(logFile, log);
  } catch (err) {
    console.error("❌ Failed to write to log:", err);
  }
}

// Setup LowDB
const gigsFile = path.join(__dirname, "runtime", "gigs.json");
const adapter = new JSONFile(gigsFile);

// ✅ PASS DEFAULT STRUCTURE TO THE CONSTRUCTOR
const dbArtist = new Low(adapter, { gigs: [] });
await dbArtist.read();

// Helper Functions

function renderAdmin(res, artist, gigs, extra = {}) {
  res.render("admin", {
    artists: ["metro_jethros", "mellow_swells", "moon_unit"],
    selected: artist,
    gigs,
    parsedGig: null,
    parsedEmailGig: null,
    savedGig: null,
    deletedGig: null,
    restoredGig: null,
    errorMessage: null,
    ...extra,
  });
}

// Route: homepage with EJS rendering
app.get("/", (req, res) => {
  const gigs = db.data.gigs;
  res.render("index", { gigs });
});

// Route: Admin
app.get("/admin", async (req, res) => {
  const token = req.query.token;
  if (token !== SECRET_TOKEN) return res.status(403).send("Forbidden");

  const selected = req.query.artist || "metro_jethros";
  const filePath = path.join(__dirname, "data", selected, "gigs.json");

  try {
    const dbArtist = new Low(new JSONFile(filePath), { gigs: [] });
    await dbArtist.read();

    renderAdmin(res, selected, dbArtist.data.gigs);
  } catch (err) {
    console.error("⚠️ Admin load error:", err);
    renderAdmin(res, selected, [], {
      errorMessage: "Failed to load gigs for this artist.",
    });
  }
});

// Route: Parse Gig
app.post("/parse-gig", async (req, res) => {
  const { token, artist, message } = req.body;

  if (token !== process.env.SECRET_TOKEN) {
    return res.status(403).send("Forbidden");
  }

  if (!artist || !message) {
    return res.status(400).send("Missing artist or message");
  }

  const filePath = path.join(__dirname, "data", artist, "gigs.json");
  const adapter = new JSONFile(filePath);
  const dbArtist = new Low(adapter, { gigs: [] });
  await dbArtist.read();

  const systemPrompt = `
Extract a structured gig from this message. Return JSON with:
"date", "venue", "city", and "time" if available.
Today's date is ${new Date().toISOString().slice(0, 10)}.
Only return a JSON object.
`;

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-3.5-turbo",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: message },
        ],
        temperature: 0.2,
      }),
    });

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    let parsedGig = null;
    try {
      parsedGig = JSON.parse(content);
    } catch (err) {
      parsedGig = { error: "Failed to parse JSON from AI", raw: content };
    }

    await logParserResult("parse-gig", message, parsedGig || content);
    renderAdmin(res, artist, dbArtist.data.gigs, { parsedGig });
  } catch (err) {
    console.error("❌ Error parsing gig:", err);
    renderAdmin(res, artist, dbArtist.data.gigs, {
      errorMessage: "Gig parsing failed. Please check your input or try again.",
    });
  }
});

// Route: Test Email
app.post("/test-email", async (req, res) => {
  const { token, artist, emailBody } = req.body;

  if (token !== process.env.SECRET_TOKEN) {
    return res.status(403).send("Forbidden");
  }

  const filePath = path.join(__dirname, "data", artist, "gigs.json");
  const adapter = new JSONFile(filePath);
  const dbArtist = new Low(adapter, { gigs: [] });
  await dbArtist.read();

  const systemPrompt = `
You are a gig parser. Extract a structured gig from this email content.
Return a JSON object with: "date", "venue", "city", and "time" (if available).
Today is ${new Date().toISOString().slice(0, 10)}.
Only return JSON.
`;

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-3.5-turbo",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: emailBody },
        ],
        temperature: 0.2,
      }),
    });

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    let parsedEmailGig = null;
    try {
      parsedEmailGig = JSON.parse(content);
    } catch (err) {
      parsedEmailGig = { error: "Could not parse AI response", raw: content };
    }

    await logParserResult("test-email", emailBody, parsedEmailGig || content);
    renderAdmin(res, artist, dbArtist.data.gigs, { parsedEmailGig });
  } catch (err) {
    console.error("❌ Email test error:", err);
    renderAdmin(res, artist, dbArtist.data.gigs, {
      errorMessage: "Gig parsing failed. Please check your input or try again.",
    });
  }
});

// Route: Save Gig
// Route: Save Gig
app.post("/save-gig", async (req, res) => {
  const { token, artist, date, venue, city, time } = req.body;
  if (token !== SECRET_TOKEN) return res.status(403).send("Forbidden");

  const newGig = { date, venue, city };
  if (time) newGig.time = time;

  const filePath = path.join(__dirname, "data", artist, "gigs.json");
  const dbArtist = new Low(new JSONFile(filePath), { gigs: [] });
  await dbArtist.read();

  dbArtist.data.gigs.push(newGig);
  await dbArtist.write();

  renderAdmin(res, artist, dbArtist.data.gigs, { savedGig: newGig });
});

// Route: Delete Gig
app.post("/delete-gig", async (req, res) => {
  const { token, artist, index } = req.body;
  if (token !== SECRET_TOKEN) return res.status(403).send("Forbidden");

  const filePath = path.join(__dirname, "data", artist, "gigs.json");
  const dbArtist = new Low(new JSONFile(filePath), { gigs: [] });
  await dbArtist.read();

  const i = parseInt(index, 10);
  const deletedGig = dbArtist.data.gigs.splice(i, 1);
  await dbArtist.write();

  renderAdmin(res, artist, dbArtist.data.gigs, { deletedGig: deletedGig[0] });
});

// Route: Undo Delete
app.post("/undo-delete", async (req, res) => {
  const { token, artist, gig } = req.body;
  if (token !== SECRET_TOKEN) return res.status(403).send("Forbidden");

  let restoredGig;
  try {
    restoredGig = JSON.parse(gig);
  } catch {
    return res.status(400).send("Invalid gig format");
  }

  const filePath = path.join(__dirname, "data", artist, "gigs.json");
  const dbArtist = new Low(new JSONFile(filePath), { gigs: [] });
  await dbArtist.read();

  dbArtist.data.gigs.push(restoredGig);
  await dbArtist.write();

  renderAdmin(res, artist, dbArtist.data.gigs, { restoredGig });
});

// Route: Artists
app.get("/gigs/:artist", async (req, res) => {
  const artist = req.params.artist;
  const filePath = path.join(__dirname, "data", artist, "gigs.json");

  try {
    const adapter = new JSONFile(filePath);
    const dbArtist = new Low(adapter, { gigs: [] });
    await dbArtist.read();

    const gigs = db.data?.gigs || [];

    res.render("gigs", {
      artist,
      gigs,
    });
  } catch (err) {
    console.error(`❌ Failed to load gigs for ${artist}:`, err.message);
    res.status(404).send("Artist not found or gigs data missing.");
  }
});

// Route: API gigs list
app.get("/api/gigs", (req, res) => {
  res.json(db.data.gigs);
});

// OpenAI Definitions
import OpenAI from "openai";
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Route: Add gig from AI/email or form
app.post("/api/parse-and-add", async (req, res) => {
  const auth = req.headers.authorization;
  if (!auth || auth !== `Bearer ${SECRET_TOKEN}`) {
    return res.status(403).json({ error: "Forbidden: Invalid token" });
  }

  const message = req.body.message;
  if (!message) return res.status(400).json({ error: "Missing message" });

  // 🧠 Step 1: Try to extract date
  let finalDate = null;
  const today = new Date();
  const monthDayMatch = message.match(/([A-Za-z]+)\s+(\d{1,2})(?:\D|$)/); // e.g. February 25

  if (monthDayMatch) {
    const [_, monthStr, dayStr] = monthDayMatch;
    const parsedDay = parseInt(dayStr);
    const monthIndex = new Date(`${monthStr} 1`).getMonth(); // 0-based
    const dateThisYear = new Date(
      Date.UTC(today.getFullYear(), monthIndex, parsedDay)
    );

    if (!isNaN(dateThisYear.getTime())) {
      const isPast = dateThisYear < today;
      const finalYear = isPast ? today.getFullYear() + 1 : today.getFullYear();
      finalDate = `${finalYear}-${String(monthIndex + 1).padStart(
        2,
        "0"
      )}-${String(parsedDay).padStart(2, "0")}`;
    }
  }

  if (!finalDate) {
    return res.status(400).json({ error: "Could not parse date from message" });
  }

  // 🧠 Step 2: Strip date portion before sending to AI
  const strippedMessage = message.replace(monthDayMatch[0], "").trim();

  try {
    const aiResponse = await openai.chat.completions.create({
      model: "gpt-4",
      temperature: 0.2,
      messages: [
        {
          role: "system",
          content: `
  You will receive a gig message. The date has already been extracted.
  
  Your job is to return only valid JSON with the following fields:
  - "venue"
  - "city"
  - "time" (like "8:00 PM", or "TBD" if unknown)
  
  Never guess or invent values. Respond with JSON only, no explanation.
  Example:
  {
    "venue": "The Pour House",
    "city": "Raleigh",
    "time": "9:00 PM"
  }
          `.trim(),
        },
        {
          role: "user",
          content: strippedMessage,
        },
      ],
    });

    const raw = aiResponse.choices[0].message.content.trim();
    console.log("🧠 AI raw:", raw);

    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch (err) {
      console.warn("❌ Invalid JSON from AI:", raw);
      return res.status(500).json({ error: "Invalid JSON from AI" });
    }

    // Attach the final date
    parsed.date = finalDate;

    if (!parsed.venue || !parsed.city || !parsed.time) {
      return res.status(400).json({ error: "Missing fields" });
    }

    // Save to LowDB
    db.data.gigs.push(parsed);
    await db.write();

    res.json({ gig: parsed });
  } catch (err) {
    console.error("❌ OpenAI request failed:", err.message || err);
    return res.status(502).json({
      status: "error",
      code: 502,
      message: "AI backend failed to respond",
    });
  }
});

app.get("/update", (req, res) => {
  res.render("update");
});

// Check Mail

function checkMail() {
  console.log("📬 Checking for new gigs via email...");

  const imap = new Imap({
    user: process.env.EMAIL_USER,
    password: process.env.EMAIL_PASS,
    host: "imap.mail.me.com",
    port: 993,
    tls: true,
    tlsOptions: { rejectUnauthorized: false },
  });

  function openInbox(cb) {
    imap.openBox("NearlyForgot", false, cb); // Or your desired folder
  }

  imap.once("ready", function () {
    openInbox(function (err, box) {
      if (err) {
        console.error("❌ Inbox error:", err);
        imap.end();
        return;
      }

      imap.search(["UNSEEN", ["SUBJECT", "gig"]], function (err, results) {
        if (err || !results.length) {
          console.log("📭 No new messages.");
          imap.end();
          return;
        }

        const f = imap.fetch(results, { bodies: "" });

        f.on("message", function (msg) {
          msg.on("body", function (stream) {
            simpleParser(stream, async (err, parsed) => {
              if (err) {
                console.error("❌ Email parse error:", err);
                return;
              }

              const emailText = parsed.text.trim();
              console.log("📩 Email body:", emailText);

              try {
                const res = await fetch(`${BASE_URL}/api/parse-and-add`, {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${SECRET_TOKEN}`,
                  },
                  body: JSON.stringify({ message: emailText }),
                });

                const result = await res.json();
                console.log("✅ Gig added from email:", result);
              } catch (err) {
                console.error("❌ API post failed:", err.message);
              }
            });
          });

          msg.once("attributes", function (attrs) {
            imap.addFlags(attrs.uid, ["\\Seen"], () => {
              console.log("📌 Marked email as read");
            });
          });
        });

        f.once("end", function () {
          console.log("✅ Done processing email.");
          imap.end();
        });
      });
    });
  });

  imap.once("error", function (err) {
    console.error("❌ IMAP error:", err);
  });

  imap.once("end", function () {
    console.log("👋 IMAP connection closed");
  });

  imap.connect();
}

// View parser logs
app.get("/admin/logs", async (req, res) => {
  const token = req.query.token;
  if (token !== SECRET_TOKEN) return res.status(403).send("Forbidden");

  try {
    const logs = fs.readFileSync(logFile, "utf-8");
    res.type("text/plain").send(logs);
  } catch (err) {
    res.status(500).send("Log file not found or unreadable.");
  }
});

// Start the server
app.listen(PORT, () => {
  console.log(`🚀 Server running at ${BASE_URL}`);
});

// Start email polling
if (process.env.EMAIL_ENABLED === "true") {
  // Check if local
  checkMail(); // Run once on server start
  setInterval(checkMail, 2 * 60 * 1000); // Run every 2 minutes
} else {
  console.log("✉️  Email listener disabled (EMAIL_ENABLED=false)");
}
