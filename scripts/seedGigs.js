const fs = require("fs");
const path = require("path");
const { Pool } = require("pg");
require("dotenv").config();

const db = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl:
    process.env.NODE_ENV === "production"
      ? { rejectUnauthorized: false }
      : false,
});

async function seedGigs() {
  const filePath = path.join(__dirname, "..", "_data", "gigs.json");
  const data = JSON.parse(fs.readFileSync(filePath, "utf-8"));

  for (const gig of data) {
    try {
      await db.query(
        `INSERT INTO gigs (date, venue, city, time) VALUES ($1, $2, $3, $4)`,
        [gig.date, gig.venue, gig.city, gig.time]
      );
      console.log(`✅ Inserted: ${gig.venue} on ${gig.date}`);
    } catch (err) {
      console.error("❌ Error inserting gig:", gig, err.message);
    }
  }

  await db.end();
  console.log("🌱 Seeding complete");
}

seedGigs();
