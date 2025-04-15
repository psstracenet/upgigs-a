const express = require("express");
const fs = require("fs");
const path = require("path");
const OpenAI = require("openai");
const bodyParser = require("body-parser");
const Imap = require("imap");
const { simpleParser } = require("mailparser");

const app = express();
const PORT = process.env.PORT || 8080;
const BASE_URL = process.env.BASE_URL || `http://localhost:${PORT}`;

const SECRET_TOKEN = process.env.SECRET_TOKEN || "gigs2025tokenX107";
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const EMAIL_USER = process.env.EMAIL_USER;
const EMAIL_PASS = process.env.EMAIL_PASS;

if (!OPENAI_API_KEY || !EMAIL_USER || !EMAIL_PASS) {
  console.error("❌ Missing required environment variables.");
  process.exit(1);
}

const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

const gigsPath = path.join(__dirname, "_data", "gigs.json");
let gigsCache = [];
let isFileWritable = true;

try {
  const content = fs.readFileSync(gigsPath, "utf-8");
  gigsCache = JSON.parse(content);
} catch {
  console.warn("📁 No gigs.json found. Starting empty.");
  gigsCache = [];
}

try {
  fs.accessSync(gigsPath, fs.constants.W_OK);
} catch {
  console.warn("⚠️ gigs.json not writable — in-memory only");
  isFileWritable = false;
}

app.use(bodyParser.json());
app.use(express.static("dist"));

app.get("/gigs.json", (req, res) => {
  res.json(gigsCache);
});

app.post("/api/parse-and-add", async (req, res) => {
  const auth = req.headers.authorization;
  if (!auth || auth !== `Bearer ${SECRET_TOKEN}`) {
    return res.status(403).json({ error: "Forbidden: Invalid token" });
  }

  const message = req.body.message;
  if (!message) return res.status(400).json({ error: "Missing message" });

  // 🧠 Step 1: Try to extract date from message
  let finalDate = null;
  const today = new Date();
  const monthDayMatch = message.match(/([A-Za-z]+)\s+(\d{1,2})(?:\D|$)/); // e.g. February 25

  if (monthDayMatch) {
    const [_, monthStr, dayStr] = monthDayMatch;
    const parsedDay = parseInt(dayStr);
    const dateThisYear = new Date(
      `${monthStr} ${parsedDay}, ${today.getFullYear()}`
    );

    if (!isNaN(dateThisYear.getTime())) {
      const isPast = dateThisYear < today;
      const finalYear = isPast ? today.getFullYear() + 1 : today.getFullYear();

      finalDate = `${finalYear}-${String(dateThisYear.getMonth() + 1).padStart(
        2,
        "0"
      )}-${String(parsedDay).padStart(2, "0")}`;
    }
  }

  if (!finalDate) {
    return res.status(400).json({ error: "Could not parse date from message" });
  }

  // 🧠 Step 2: Remove date from message before passing to AI
  const strippedMessage = message.replace(monthDayMatch[0], "").trim();

  // 🧠 Step 3: Ask OpenAI to extract only venue, city, and time
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

    let parsed;
    try {
      parsed = JSON.parse(aiResponse.choices[0].message.content.trim());
    } catch (err) {
      console.warn(
        "❌ Invalid JSON from AI:",
        aiResponse.choices[0].message.content
      );
      return res.status(500).json({ error: "Invalid JSON from AI" });
    }

    // 🧷 Reattach the final date
    parsed.date = finalDate;

    // Save to memory + disk
    gigsCache.push(parsed);
    if (isFileWritable) {
      fs.writeFileSync(gigsPath, JSON.stringify(gigsCache, null, 2));
    }

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

function checkMail() {
  console.log("📬 Checking for new gigs via email...");

  const imap = new Imap({
    user: EMAIL_USER,
    password: EMAIL_PASS,
    host: "imap.mail.me.com",
    port: 993,
    tls: true,
    tlsOptions: { rejectUnauthorized: false },
  });

  imap.getBoxes((err, boxes) => {
    if (err) {
      console.error("❌ Could not list folders:", err);
    } else {
      console.log("📂 Mailboxes available:", Object.keys(boxes));
    }
  });

  function openInbox(cb) {
    imap.openBox("NearlyForgot", false, (err, box) => {
      if (err && err.textCode === "NONEXISTENT") {
        console.warn("📂 Folder not found. Retrying in 5s...");
        setTimeout(() => imap.openBox("NearlyForgot", false, cb), 5000);
      } else {
        cb(err, box);
      }
    });
  }

  imap.once("ready", function () {
    openInbox(function (err, box) {
      if (err) {
        console.error("❌ Inbox error:", err);
        imap.end();
        return;
      }

      imap.search(["UNSEEN", ["SUBJECT", "gig"]], function (err, results) {
        console.log("📨 Search results:", results);
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
                const fetch = (await import("node-fetch")).default;
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

        f.once("error", function (err) {
          console.error("❌ Fetch error:", err);
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

app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
  setInterval(checkMail, 2 * 60 * 1000);
  checkMail();
});

process.on("uncaughtException", (err) => {
  console.error("🧨 Uncaught Exception:", err);
});

process.on("unhandledRejection", (err) => {
  console.error("🧨 Unhandled Rejection:", err);
});
