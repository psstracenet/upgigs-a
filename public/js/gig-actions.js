
import { getCookie } from './utils.js';
import { showToast } from './toast.js';



document.addEventListener("DOMContentLoaded", () => {
  console.log("🧃 gig-actions.js loaded");

  // Delegate delete gig handling to all forms with class delete-gig-form
  document.querySelectorAll(".delete-gig-form").forEach((form) => {
    form.addEventListener("submit", async (e) => {
      e.preventDefault();

     // Use the same getCookie function as in admin.js
function getCookie(name) {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop().split(";").shift();
  return null;
}
const token = getCookie("token");
if (!token) {
  alert("JWT token missing!");
  return;
}

      const artist = form.dataset.artist;
      const index = form.dataset.index;

      try {
        const response = await fetch("/delete-gig", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ artist, index }),
          credentials: "same-origin", // Ensure cookies are sent with the request
        });

        const result = await response.json();

        if (response.ok) {
          showToast(
            `🗑 Deleted gig on ${
              result.deleted.date
            }. <button class="undo-btn" data-artist="${artist}" data-gig='${JSON.stringify(
              result.deleted
            )}'>↩️ Undo</button>`
          );
          form.closest(".gig-card").remove();
        } else {
          showToast("❌ Delete failed: " + (result.error || "Unknown error"));
        }
      } catch (err) {
        console.error("❌ Delete error:", err);
        showToast("❌ Network error while deleting gig");
      }
    });
  });

  // 🧨 Handle undo click from toast
  document.addEventListener("click", async (e) => {
    if (!e.target.classList.contains("undo-btn")) return;

    const gig = JSON.parse(e.target.dataset.gig);
    const artist = e.target.dataset.artist;
    // const token = localStorage.getItem("jwtToken");
    const token = getCookie("token");
    if (!token) {
      alert("JWT token missing!");
      return;
    }

    // ✅ Save current artist selection before undo
    const artistSelect = document.getElementById("artist-switch");
    const previousArtist = artistSelect?.value || artist;

    try {
      const response = await fetch("/undo-delete", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ artist, gig }),
      });

      if (response.ok) {
        const html = await response.text();
        const tempDoc = new DOMParser().parseFromString(html, "text/html");
        const newSection = tempDoc.getElementById("gig-section");
        const currentSection = document.getElementById("gig-section");

        if (newSection && currentSection) {
          currentSection.replaceWith(newSection);
          showToast("↩️ Gig restored.");

          // ✅ Reapply current artist to dropdown
          const newArtistSelect = document.getElementById("artist-switch");
          if (newArtistSelect) {
            newArtistSelect.value = previousArtist;
          }
        } else {
          showToast("⚠️ Undo succeeded but UI update failed.");
        }
      } else {
        showToast("❌ Undo failed.");
      }
    } catch (err) {
      console.error("❌ Undo error:", err);
      showToast("❌ Network error while undoing");
    }
  });
});
