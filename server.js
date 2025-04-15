const express = require("express");
const fs = require("fs");
const path = require("path");
const bodyParser = require("body-parser");
const OpenAI = require("openai");
const Imap = require("imap");
const { simpleParser } = require("mailparser");

const app = express();
const PORT = process.env.PORT || 8080;
const BASE_URL = process.env.BASE_URL || `http://localhost:${PORT}`;

const SECRET_TOKEN = process.env.SECRET_TOKEN || "gigs2025tokenX107";
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const EMAIL_USER = process.env.EMAIL_USER;
const EMAIL_PASS = process.env.EMAIL_PASS;

const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

app.use(bodyParser.json());
app.use(express.static("dist"));

const gigsPath = path.join(__dirname, "_data", "gigs.json");
let gigsCache = [];
let isFileWritable = true;

try {
  const data = fs.readFileSync(gigsPath, "utf-8");
  gigsCache = JSON.parse(data);
} catch {
  gigsCache = [];
}

try {
  fs.accessSync(gigsPath, fs.constants.W_OK);
} catch {
  isFileWritable = false;
}

// Serve gigs.json
app.get("/gigs.json", (req, res) => {
  res.json(gigsCache);
});

// AI gig parsing endpoint
app.post("/api/parse-and-add", async (req, res) => {
  const auth = req.headers.authorization;
  if (!auth || auth !== `Bearer ${SECRET_TOKEN}`) {
    return res.status(403).json({ error: "Forbidden: Invalid token" });
  }

  const message = req.body.message;
  if (!message) return res.status(400).json({ error: "Missing message" });

  try {
    const aiResponse = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        {
          role: "system",
          content:
            "You are a strict date parser. Extract gig info and return ONLY valid JSON. The 'date' field MUST be in ISO format: YYYY-MM-DD. Do not include month names or slashes. Example: '2025-04-25'. Keys: date, venue, city, time (like '8:00 PM').",
        },
        { role: "user", content: message },
      ],
      timeout: 20000,
    });

    let parsed;

    try {
      parsed = JSON.parse(aiResponse.choices[0].message.content.trim());
    } catch (err) {
      console.warn(
        "❌ Invalid JSON returned by AI:",
        aiResponse.choices[0].message.content
      );
      return res.status(500).json({ error: "Invalid JSON from AI" });
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(parsed.date)) {
      console.warn("⛔ Invalid date format:", parsed.date);
      return res.status(400).json({ error: "Invalid date format" });
    }

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

// Run server
app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
  checkMail(); // run once immediately
  setInterval(checkMail, 10 * 60 * 1000); // every 10 minutes
});

// Check email inbox for gigs
function checkMail() {
  console.log("📬 Checking for new gigs via email...");

  const imap = new Imap({
    user: EMAIL_USER,
    password: EMAIL_PASS,
    host: "imap.mail.me.com", // iCloud
    port: 993,
    tls: true,
    tlsOptions: { rejectUnauthorized: false },
  });

  imap.once("ready", function () {
    imap.openBox("GigUpdates", false, function (err, box) {
      if (err) {
        console.error("❌ openBox error:", err);
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
            simpleParser(stream, async (err, parsedEmail) => {
              if (err) {
                console.error("❌ Email parse error:", err);
                return;
              }

              const emailText = parsedEmail.text.trim();
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
                console.error("❌ Failed to contact gig API:", err.message);
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
