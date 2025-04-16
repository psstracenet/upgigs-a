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

// Start the server
app.listen(PORT, () => {
  console.log(`🚀 Server running at ${BASE_URL}`);
});

// Start email polling
checkMail(); // Run once on server start
setInterval(checkMail, 2 * 60 * 1000); // Run every 2 minutes
