import { getCookie } from './utils.js';
import { showToast } from './toast.js';

// --- DOM Elements ---
const parseForm = document.getElementById("parse-gig-form");
const aiLoader = document.getElementById("ai-loader");
const submitBtn = parseForm ? parseForm.querySelector('button[type="submit"]') : null;

// --- Helper Functions ---
function setLoading(isLoading) {
  if (!aiLoader || !submitBtn) return;
  aiLoader.classList.toggle("hidden", !isLoading);
  submitBtn.disabled = isLoading;
}

// --- Parse Gig Form Handler ---
function handleParseFormSubmit(e) {
  e.preventDefault();

  const token = getCookie("token");
  if (!token) {
    showToast("❌ Missing token. Please log in again.");
    return;
  }

  const artist = parseForm.elements["artist"].value;
  const message = parseForm.elements["message"].value;

  setLoading(true);

  fetch("/parse-gig", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`,
    },
    body: JSON.stringify({ artist, message }),
  })
    .then(async (response) => {
      setLoading(false);
      if (response.ok) {
        window.location.reload();
      } else {
        const result = await response.json();
        showToast("❌ Parse failed: " + (result.error || "Unknown error"));
      }
    })
    .catch(() => {
      setLoading(false);
      showToast("❌ Network error while parsing gig.");
    });
}

// --- Delete Gig Handler ---
function handleDeleteGigForm(form) {
  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const token = getCookie("token");
    if (!token) {
      showToast("❌ Missing token. Please log in again.");
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
          "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify({ artist, index }),
      });

      if (res.ok) {
        const data = await res.json();
        const card = form.closest(".gig-card");
        if (card) {   
          card.style.transition = "opacity 0.5s";
          card.style.opacity = "0";
          setTimeout(() => card.remove(), 500);
        }
        if (data.deletedGig) {
          showUndoToast(data.deletedGig, artist, index);
        } else {
          showToast("❌ Delete failed: No gig data returned.");
          console.error("Delete response missing deletedGig:", data);
        }
      } else {
        const data = await res.json();
        showToast("❌ Failed to delete gig: " + (data.error || "Unknown error"));
      }
    } catch {
      showToast("❌ Error deleting gig");
    }
  });
}

// --- Undo Toast for Gig Deletion ---
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
    const token = getCookie("token");
    if (!token) {
      showToast("❌ Missing token. Please log in again.");
      return;
    }
    try {
      const res = await fetch("/undo-delete", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify({ artist, gig }),
      });
      if (res.ok) {
        window.location.reload();
      } else {
        showToast("❌ Undo failed");
      }
    } catch {
      showToast("❌ Network error while undoing delete");
    }
  });

  setTimeout(() => toast.remove(), 5000);
}

// --- Initialize Event Listeners ---
document.addEventListener("DOMContentLoaded", () => {
  if (parseForm) {
    parseForm.addEventListener("submit", handleParseFormSubmit);
  }
  document.querySelectorAll("form[action='/delete-gig']").forEach(handleDeleteGigForm);
});