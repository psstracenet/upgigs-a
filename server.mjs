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
