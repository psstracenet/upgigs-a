const imaps = require("imap-simple");
const { simpleParser } = require("mailparser");
const fetch = (...args) =>
  import("node-fetch").then(({ default: fetch }) => fetch(...args));

const config = {
  imap: {
    user: "nearlyforgot@icloud.com", // your iCloud alias or full email
    password: "rwqy-alxw-rtpc-pgqk", // app-specific password
    host: "imap.mail.me.com",
    port: 993,
    tls: true,
    authTimeout: 5000,
  },
};

async function checkMail() {
  const connection = await imaps.connect({ imap: config.imap });
  await connection.openBox("INBOX");

  const searchCriteria = ["UNSEEN"];
  const fetchOptions = { bodies: ["HEADER", "TEXT"], markSeen: true };

  const messages = await connection.search(searchCriteria, fetchOptions);

  for (const item of messages) {
    const all = item.parts.find((part) => part.which === "TEXT");
    const parsed = await simpleParser(all.body);

    const plainText = parsed.text.trim();
    console.log("📬 New Email Message:", plainText);

    // Send to your local AI parser
    const res = await fetch("http://localhost:3100/api/parse-and-add", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: plainText }),
    });

    const result = await res.json();
    console.log("✅ AI Response:", result);
  }

  connection.end();
}

checkMail().catch((err) => console.error("❌ Mail check failed:", err));
