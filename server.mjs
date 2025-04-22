import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { Low } from "lowdb";
import { JSONFile } from "lowdb/node";
import dotenv from "dotenv";
import jwt from "jsonwebtoken";
import fs from "fs";
import Imap from "imap";
import { simpleParser } from "mailparser";
import fetch from "node-fetch";
import cors from "cors";
import util from "util";
import crypto from "crypto";
import cookieParser from "cookie-parser";
import bcrypt from "bcrypt";

// Load env vars
dotenv.config();

// ── paths & env ──────────────────────────────────────────────────────────────
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.PORT || 8081;
const BASE_URL = process.env.BASE_URL || `http://localhost:${PORT}`;
const JWT_SECRET_KEY = process.env.JWT_SECRET_KEY || "hello123hello123";

// ── load users from JSON file ────────────────────────────────────────────────
const usersRaw = fs.readFileSync(
  path.join(__dirname, "data", "users.json"),
  "utf8"
);
//  ➜  users is the *array* we’ll search in /login
const users = JSON.parse(usersRaw).users;

// Setup Express
const app = express();
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// CSP (Content-Security-Policy)

app.use((req, res, next) => {
  const nonce = crypto.randomBytes(16).toString("base64");
  res.locals.nonce = nonce;
  res.setHeader(
    "Content-Security-Policy",
    `
    default-src 'self' 'nonce-${nonce}';
    script-src 'self' 'nonce-${nonce}';   
    style-src 'self' 'unsafe-inline';      
    connect-src 'self' http://localhost:8081; 
    img-src 'self' data:;                  
    font-src 'self';                      
    object-src 'none';                     
    base-uri 'self';                      
    form-action 'self';                   
    frame-ancestors 'none';               
    `
      .replace(/\s{2,}/g, " ")
      .trim()
  );
  next();
});

// Cross-Origin Resource Sharing)
// app.use(
//   cors({
//     origin: "http://localhost:8080", // Origin is local website (metrojethros)
//   })
// );

app.use(cors());

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

function renderAdmin(
  res,
  {
    username,
    role,
    artist,
    gigs,
    restoredGig = null,
    savedGig = null,
    deletedGig = null,
    parsedGig = null,
    parsedEmailGig = null,
    errorMessage = null,
    nonce,
  }
) {
  res.render("admin", {
    nonce,
    username,
    role,
    artists: users.map((u) => ({
      artist: u.artist,
      displayName: u.displayName || u.artist.replace("_", " "),
    })),
    selected: artist,
    gigs,
    parsedGig,
    parsedEmailGig,
    savedGig,
    deletedGig,
    restoredGig,
    errorMessage,
  });
}

const authenticateJWT = (req, res, next) => {
  const token = req.cookies.token; // ✅ Now from cookie

  if (!token) {
    return res.status(403).json({ message: "Access token required" });
  }

  jwt.verify(token, JWT_SECRET_KEY, (err, decoded) => {
    if (err) {
      return res.status(403).json({ message: "Invalid or expired token" });
    }

    req.user = decoded; // Attach user data to request
    next();
  });
};

// // Example of protected route
// app.get("/api/protected-data", authenticateJWT, (req, res) => {
//   res.json({ message: "This is protected data" });
// });

app.get("/api/get-events", (req, res) => {
  const { token } = req.query;
  console.log("Received token:", token); // Log the token to ensure it's coming through correctly

  try {
    // Fetch events based on the token
    const events = getEventsByToken(token); // Ensure this returns an array

    // Log the fetched events to verify
    console.log("Fetched events from server:", events);

    // Ensure the events variable is an array
    if (!Array.isArray(events)) {
      console.error("Returned events is not an array!"); // Log an error if it's not an array
      return res
        .status(500)
        .json({ error: "Internal Server Error - events is not an array" });
    }

    // Check if no events were found
    if (events.length === 0) {
      console.error("No events found for token:", token); // Log if no events are found for the token
      return res.status(404).json({ error: "No events found" });
    }

    // Send the events data as a response
    res.json({ events });
  } catch (error) {
    // Catch any errors during the process
    console.error("Error fetching events:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// Function to fetch events by token from gigs.json
function getEventsByToken(token) {
  console.log("Checking events for token:", token);

  // Define the file path for the gigs.json file
  const filePath = path.join(__dirname, "data", "metro_jethros", "gigs.json");

  // Try reading the gigs.json file
  try {
    const data = fs.readFileSync(filePath, "utf8"); // Read file synchronously
    const jsonData = JSON.parse(data); // Parse the JSON data
    const events = jsonData.gigs; // Access the 'gigs' array

    if (token === "jon2025token") {
      return events; // Return all events if token matches
    } else {
      return []; // Return empty array for other tokens (can be changed as needed)
    }
  } catch (error) {
    console.error("Error reading gigs.json:", error);
    return []; // Return an empty array if there's an error reading the file
  }
}

// app.listen(8080, () => {
//   console.log("UpGigs API running on http://localhost:8081");
// });

app.listen(PORT, () => {
  console.log(`UpGigs API running on http://localhost:${PORT}`);
});

app.get("/favicon.ico", (req, res) => res.status(204).end());

// Route: homepage with EJS rendering
app.get("/", (req, res) => {
  res.render("index", {
    users, // ← the users array you loaded at startup
    gigs: [], // (optional) preload gigs here if you want
  });
});

// Route: Login
app.post("/login", (req, res) => {
  const { username, password } = req.body;

  const user = users.find((u) => u.username === username);
  if (!user || password !== user.password) {
    return res.status(401).json({ message: "Invalid credentials" });
  }

  const token = jwt.sign(
    { username: user.username, role: user.role, artist: user.artist },
    JWT_SECRET_KEY,
    { expiresIn: "1h" }
  );

  // ✅ Set secure cookie
  res.cookie("token", token, {
    // httpOnly: true, // REMOVED to allow JS access
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 1000, // 1 hour
  });

  res.json({ success: true });
});

// Route: MyGigs
app.get("/my-gigs", authenticateJWT, async (req, res) => {
  if (!req.user) {
    return res.status(403).json({ error: "User not found in token" });
  }

  const { artist, role, username } = req.user;
  const filePath = path.join(__dirname, "data", artist, "gigs.json");

  try {
    const dbArtist = new Low(new JSONFile(filePath), { gigs: [] });
    await dbArtist.read();

    res.render("my-gigs", {
      username,
      role,
      artist,
      gigs: dbArtist.data.gigs,
      errorMessage: null, // ✅ define it here
    });
  } catch (err) {
    console.error("⚠️ Failed to load gigs:", err);

    res.render("my-gigs", {
      username,
      role,
      artist,
      gigs: [],
      errorMessage: "Could not load gigs.", // ✅ define here too
    });
  }
});

// Function to get user data by username
function getUserByUsername(username) {
  return users.find((user) => user.username === username);
}

// Route: Admin - Secure with JWT
app.get("/admin", authenticateJWT, async (req, res) => {
  const { artist: userArtist, role, username } = req.user;
  const selected = req.query.artist || userArtist;
  const page = parseInt(req.query.page, 10) || 1;
  const gigsPerPage = 5;

  const filePath = path.join(__dirname, "data", selected, "gigs.json");
  let gigs = [];
  let totalPages = 1;

  try {
    const dbArtist = new Low(new JSONFile(filePath), { gigs: [] });
    await dbArtist.read();
    gigs = dbArtist.data.gigs || [];
    totalPages = Math.max(1, Math.ceil(gigs.length / gigsPerPage));
    const pagedGigs = gigs.slice((page - 1) * gigsPerPage, page * gigsPerPage);

    res.render("admin", {
      username,
      role,
      artists: users,
      selected,
      gigs: pagedGigs,
      page,
      totalPages,
      errorMessage: null,
      savedGig: null,
      deletedGig: null,
      restoredGig: null,
      parsedGig: null,
      parsedEmailGig: null,
    });
  } catch (err) {
    console.error("⚠️ Failed to load gigs:", err);
    res.render("admin", {
      username,
      role,
      artists: users,
      selected,
      gigs: [],
      page: 1,
      totalPages: 1,
      errorMessage: "Could not load gigs.",
      savedGig: null,
      deletedGig: null,
      restoredGig: null,
      parsedGig: null,
      parsedEmailGig: null,
    });
  }
});

// Route: Parse Gig
app.post("/parse-gig", authenticateJWT, async (req, res) => {
  console.log("Authorization Header:", req.headers["authorization"]);
  const { artist, message } = req.body;

  // Destructure the user information from the JWT
  const { role, username } = req.user;

  // Ensure that both artist and message are provided
  if (!artist || !message) {
    return res.status(400).send("Missing artist or message");
  }

  // Determine the file path for the artist's gigs data
  const filePath = path.join(__dirname, "data", artist, "gigs.json");
  const adapter = new JSONFile(filePath);
  const dbArtist = new Low(adapter, { gigs: [] });
  await dbArtist.read();

  // System prompt for the AI model
  const systemPrompt = `
Extract a structured gig from this message. Return JSON with:
"date", "venue", "city", and "time" if available.
Today's date is ${new Date().toISOString().slice(0, 10)}.
Only return a JSON object.
`;

  try {
    console.log("Authorization Header:", req.headers["authorization"]);

    // Send request to OpenAI API for parsing the gig message
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, // Use your OpenAI API key here
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-3.5-turbo", // or gpt-4 if preferred
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: message },
        ],
        temperature: 0.2,
      }),
    });

    const data = await response.json();
    const raw = data.choices[0]?.message?.content.trim();

    // Parse the AI response
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch (err) {
      console.warn("❌ Invalid JSON from AI:", raw);
      return res.status(500).json({ error: "Invalid JSON from AI" });
    }

    // Attach the final date and validate the parsed data
    parsed.date = new Date().toISOString().slice(0, 10);

    if (!parsed.venue || !parsed.city || !parsed.time) {
      return res.status(400).json({ error: "Missing fields" });
    }

    // Save the parsed gig data to the database
    dbArtist.data.gigs.push(parsed);
    await dbArtist.write();

    // Return the parsed gig data as response
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

// Route: Test Email
app.post("/test-email", authenticateJWT, async (req, res) => {
  const { artist, emailBody } = req.body;

  // Destructure role and username from req.user (from JWT)
  const { role, username } = req.user;

  // Check if artist and emailBody are provided
  if (!artist || !emailBody) {
    return res.status(400).send("Missing artist or email body");
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

    // Log the parsed email gig result
    await logParserResult("test-email", emailBody, parsedEmailGig || content);

    // Render the admin page with the parsed email gig result
    renderAdmin(res, artist, dbArtist.data.gigs, { parsedEmailGig });
  } catch (err) {
    console.error("❌ Email test error:", err);
    renderAdmin(res, artist, dbArtist.data.gigs, {
      errorMessage: "Gig parsing failed. Please check your input or try again.",
    });
  }
});

// Route: Save Gig
app.post("/save-gig", authenticateJWT, async (req, res) => {
  // Destructure role and username from req.user (from JWT)
  const { role, username } = req.user;

  const { artist, date, venue, city, time } = req.body;

  // Validate the required fields
  if (!artist || !date || !venue || !city) {
    return res.status(400).json({
      error: "Missing required fields: artist, date, venue, or city.",
    });
  }

  // Create the new gig object
  const newGig = { date, venue, city };
  if (time) newGig.time = time;

  const filePath = path.join(__dirname, "data", artist, "gigs.json");
  const adapter = new JSONFile(filePath);
  const dbArtist = new Low(adapter, { gigs: [] });

  try {
    await dbArtist.read(); // Read the database

    // Add the new gig to the gigs array
    dbArtist.data.gigs.push(newGig);
    await dbArtist.write(); // Write the new data back to the database

    // Render the admin page with the new gig saved
    renderAdmin(res, artist, dbArtist.data.gigs, { savedGig: newGig, role });
  } catch (err) {
    console.error("❌ Error saving gig:", err);
    return res.status(500).json({ error: "Failed to save gig" });
  }
});

// Route: Delete Gig
app.post("/delete-gig", authenticateJWT, async (req, res) => {
  const { role, username } = req.user;
  const { artist, index } = req.body;

  // Validate required fields
  if (!artist || index === undefined) {
    return res.status(400).json({ error: "Missing required fields: artist or index." });
  }

  // Coerce index to a number
  const idx = Number(index);
  if (isNaN(idx) || idx < 0) {
    return res.status(400).json({ error: "Invalid index provided." });
  }

  const filePath = path.join(__dirname, "data", artist, "gigs.json");
  const adapter = new JSONFile(filePath);
  const dbArtist = new Low(adapter, { gigs: [] });

  try {
    await dbArtist.read();
    const gigs = dbArtist.data.gigs;

    if (idx >= gigs.length) {
      return res.status(400).json({ error: "Invalid index. No gig found at that index." });
    }

    // Defensive: ensure deletedGig exists
    const deletedGig = gigs.splice(idx, 1)[0];
    if (!deletedGig) {
      return res.status(500).json({ error: "Gig could not be deleted." });
    }
    await dbArtist.write();

    res.json({ message: "Gig deleted successfully.", deletedGig });
  } catch (err) {
    console.error("Error deleting gig:", err);
    res.status(500).json({ error: "Failed to delete gig." });
  }
});

// Route: Undo Delete
app.post("/undo-delete", authenticateJWT, async (req, res) => {
  const { role, username } = req.user;
  const { artist, gig } = req.body;

  if (!artist || !gig) {
    return res
      .status(400)
      .json({ error: "Missing required fields: artist or gig." });
  }

  let restoredGig;
  try {
    restoredGig = typeof gig === "string" ? JSON.parse(gig) : gig;
  } catch {
    return res.status(400).send("Invalid gig format");
  }

  const filePath = path.join(__dirname, "data", artist, "gigs.json");
  const dbArtist = new Low(new JSONFile(filePath), { gigs: [] });

  console.log("🎯 Undo request payload:", { artist, gig });

  try {
    await dbArtist.read();
    dbArtist.data.gigs.push(restoredGig);
    await dbArtist.write();

    // ✅ Use updated renderAdmin with full object structure
    renderAdmin(res, {
      username,
      role,
      artist,
      gigs: dbArtist.data.gigs,
      restoredGig,
      nonce: res.locals.nonce,
    });
  } catch (err) {
    console.error("❌ Error restoring gig:", err);
    return res
      .status(500)
      .json({ error: "Failed to restore gig", details: err.message });
  }
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
import { resolve } from "path/win32";
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Route: Add gig from AI/email or form

app.post("/api/parse-and-add", authenticateJWT, async (req, res) => {
  console.log("JWT Token in request:", localStorage.getItem("jwtToken"));
  console.log("req.user:", req.user); // Check if req.user is set
  const { role, username } = req.user; // Get user info from JWT

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
                const { role, username } = req.user; // Destructuring 'role' and 'username' from req.user

                // Get the JWT token from localStorage (assuming it's already set there during login)
                const token = localStorage.getItem("jwtToken"); // Retrieve token from localStorage
                console.log("Retrieved Token for Parse with AI:", token);
                // Ensure that the token exists
                if (!token) {
                  throw new Error("Token not found.");
                }

                // Now, using the correct token in the Authorization header
                // const res = await fetch(`${BASE_URL}/api/parse-and-add`, {
                const res = await fetch(
                  `http://localhost:8081/api/parse-and-add`,
                  {
                    method: "POST",
                    headers: {
                      "Content-Type": "application/json",
                      Authorization: `Bearer ${token}`, // Correctly passing the token here
                    },
                    body: JSON.stringify({ message: emailText }),
                  }
                );

                // Further code remains the same...
              } catch (err) {
                console.error("Error occurred:", err);
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

// Route: View parser logs
app.get("/admin/logs", authenticateJWT, async (req, res) => {
  const user = req.user; // Extract user info from the JWT token

  if (!user || user.role !== "admin") {
    return res.status(403).send("Forbidden: Access denied");
  }

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
