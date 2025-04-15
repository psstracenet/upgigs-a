const Imap = require("imap");
const { simpleParser } = require("mailparser");
const fetch = require("node-fetch");
const dotenv = require("dotenv");

// --- Email account setup
const imap = new Imap({
  user: process.env.EMAIL_USER,
  password: process.env.EMAIL_PASS,
  host: "imap.gmail.com",
  port: 993,
  tls: true,
});

// --- Parse email text and send it to your gig API
async function sendToGigAPI(message) {
  try {
    const res = await fetch(
      "https://up-gigs-production.up.railway.app/api/parse-and-add",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer gigs2025tokenX107",
        },
        body: JSON.stringify({ message }),
      }
    );

    const result = await res.json();
    console.log("✅ Gig added:", result);
  } catch (err) {
    console.error("❌ Failed to send gig to API:", err.message);
  }
}

// --- Open the inbox and check messages
function openInbox(cb) {
  imap.openBox("INBOX", false, cb);
}

imap.once("ready", function () {
  openInbox(function (err, box) {
    if (err) throw err;

    // Search for unseen messages
    imap.search(["UNSEEN"], function (err, results) {
      if (err) throw err;
      if (!results || results.length === 0) {
        console.log("📭 No new messages.");
        imap.end();
        return;
      }

      const f = imap.fetch(results, { bodies: "" });

      f.on("message", function (msg) {
        msg.on("body", function (stream) {
          simpleParser(stream, async (err, parsed) => {
            if (err) {
              console.error("Parse error:", err);
              return;
            }

            const emailText = parsed.text.trim();
            console.log("📩 Email body:", emailText);

            // Send to /api/parse-and-add
            await sendToGigAPI(emailText);
          });
        });

        msg.once("attributes", function (attrs) {
          const { uid } = attrs;
          imap.addFlags(uid, ["\\Seen"], () => {
            console.log("📌 Marked as read");
          });
        });
      });

      f.once("error", function (err) {
        console.error("Fetch error:", err);
      });

      f.once("end", function () {
        console.log("✅ Done fetching all unseen messages.");
        imap.end();
      });
    });
  });
});

imap.once("error", function (err) {
  console.error("IMAP error:", err);
});

imap.once("end", function () {
  console.log("👋 Connection ended");
});

imap.connect();
