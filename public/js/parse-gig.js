document.addEventListener("DOMContentLoaded", () => {
  console.log("✅ DOM loaded and script running");

  const form = document.querySelector("#parse-gig-form");
  if (!form) {
    console.warn("⚠️ parse-gig-form not found");
    return;
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    console.log("🔥 Listener triggered");

    const token = localStorage.getItem("jwtToken");
    const message = document.getElementById("message")?.value || "";
    const artist = document.getElementById("artist")?.value || "";

    console.log("🔑 Token:", token);
    console.log("✉️ Message:", message);
    console.log("🎤 Artist:", artist);

    if (!token) {
      alert("Missing token.");
      return;
    }

    try {
      const res = await fetch("/parse-gig", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ message, artist }),
      });

      const result = await res.json();

      if (res.ok) {
        console.log("✅ Gig parsed:", result);
        alert("Gig parsed! Check console.");
      } else {
        console.warn("❌ Server returned error:", result);
        alert("Failed to parse gig.");
      }
    } catch (err) {
      console.error("❌ Fetch failed:", err);
      alert("Error during parsing. Check console.");
    }

    document.addEventListener("DOMContentLoaded", () => {
      console.log("✅ Admin script loaded");

      const token = localStorage.getItem("jwtToken");

      document
        .querySelectorAll("form[action='/delete-gig']")
        .forEach((form) => {
          form.addEventListener("submit", async (e) => {
            e.preventDefault();

            if (!token) {
              alert("Missing token");
              return;
            }

            const formData = new FormData(form);
            const artist = formData.get("artist");
            const index = formData.get("index");

            try {
              const res = await fetch("/delete-gig", {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({ artist, index }),
              });

              const data = await res.json();
              if (res.ok) {
                console.log("🗑 Deleted:", data);
                // Optionally remove the gig from the DOM here or reload
                if (res.ok) {
                  console.log("🗑 Deleted:", data);

                  const card = form.closest(".gig-card");
                  card.classList.add("fade-out");

                  setTimeout(() => {
                    card.remove();
                  }, 500); // Matches CSS transition duration

                  showUndoToast(data.deletedGig, artist, index); // We'll build this next
                } else {
                  alert("Failed to delete gig");
                }
              } else {
                alert("Failed to delete gig");
                console.error(data);
              }
            } catch (err) {
              console.error("❌ Error deleting gig", err);
              alert("Something went wrong");

              function showUndoToast(gig, artist, index) {
                const toast = document.createElement("div");
                toast.className = "toast";
                toast.innerHTML = `
                  🗑 Deleted gig: <strong>${gig.date}</strong> – ${gig.venue}, ${gig.city}
                  <button class="btn-accent" style="margin-left:1rem;">↩️ Undo</button>
                `;

                document.body.prepend(toast);

                const undoBtn = toast.querySelector("button");
                undoBtn.addEventListener("click", async () => {
                  const token = localStorage.getItem("jwtToken");
                  const res = await fetch("/undo-delete", {
                    method: "POST",
                    headers: {
                      "Content-Type": "application/json",
                      Authorization: `Bearer ${token}`,
                    },
                    body: JSON.stringify({ artist, gig: JSON.stringify(gig) }),
                  });

                  if (res.ok) {
                    location.reload(); // Or dynamically reinsert the gig card
                  } else {
                    alert("Undo failed");
                  }
                });

                setTimeout(() => toast.remove(), 5000);
              }
            }
          });
        });
    });
  });
});
