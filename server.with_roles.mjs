
// Token-to-role-and-artist map
const userTokens = {
  "gigs2025tokenX107": { artist: "metro_jethros", role: "admin" },
  "jon2025token": { artist: "metro_jethros", role: "user" }
};

// Friendly band URL admin route with role-based logic
app.get(["/admin", "/:slug/admin"], async (req, res) => {
  const token = req.query.token;
  const user = userTokens[token];
  if (!user) return res.status(403).send("Invalid token");

  const slug = req.params.slug;
  const selected = slug ? slug.replace(/-/g, "_") : user.artist;
  if (user.artist !== selected) return res.status(403).send("Token does not match artist");

  const filePath = path.join(__dirname, "data", selected, "gigs.json");

  try {
    const dbArtist = new Low(new JSONFile(filePath), { gigs: [] });
    await dbArtist.read();

    // Log access
    const logEntry = `[${new Date().toISOString()}] ${token} accessed ${selected} as ${user.role}\n`;
    fs.appendFileSync(path.join(__dirname, "logs", "access.log"), logEntry);

    renderAdmin(res, selected, dbArtist.data.gigs, { role: user.role });
  } catch (err) {
    console.error("⚠️ Admin load error:", err);
    renderAdmin(res, selected, [], {
      role: user.role,
      errorMessage: "Failed to load gigs.",
    });
  }
});
