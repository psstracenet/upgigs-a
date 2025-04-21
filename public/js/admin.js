document.addEventListener("DOMContentLoaded", () => {
  console.log("✅ DOM loaded and admin.js running");

  // 🚪 Logout handler
  const logoutLink = document.getElementById("logout-link");
  if (logoutLink) {
    logoutLink.addEventListener("click", (e) => {
      e.preventDefault();
      localStorage.removeItem("jwtToken");
      window.location.href = "/";
    });
  }

  // ❌ Cancel button removes the form
  document.querySelectorAll(".cancel-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const form = btn.closest("form.gig-card");
      if (form) {
        form.classList.add("dismiss");
        setTimeout(() => form.remove(), 300);
      }
    });
  });

  // 🎤 Artist Dropdown – Load selected artist's gigs securely
  document.addEventListener("DOMContentLoaded", () => {
    console.log("✅ DOM loaded and admin.js running");

    const logoutLink = document.getElementById("logout-link");
    if (logoutLink) {
      logoutLink.addEventListener("click", (e) => {
        e.preventDefault();
        localStorage.removeItem("jwtToken");
        window.location.href = "/";
      });
    }

    document.querySelectorAll(".cancel-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const form = btn.closest("form.gig-card");
        if (form) {
          form.classList.add("dismiss");
          setTimeout(() => form.remove(), 300);
        }
      });
    });

    const artistDropdown = document.getElementById("artist-switch");

    if (artistDropdown) {
      console.log("🎧 Found #artist-switch dropdown");

      let userInitiated = false;

      artistDropdown.addEventListener("mousedown", () => {
        userInitiated = true;
      });

      artistDropdown.addEventListener("change", async () => {
        console.log("🎯 Artist dropdown changed:", artistDropdown.value);
        userInitiated = false;

        const token = localStorage.getItem("jwtToken");
        const artist = artistDropdown.value;

        try {
          const response = await fetch(`/admin?artist=${artist}`, {
            method: "GET",
            headers: {
              Authorization: `Bearer ${token}`,
              "X-Requested-With": "XMLHttpRequest",
            },
          });

          const html = await response.text();
          console.log("📦 Response received. Length:", html.length);

          const tempDoc = new DOMParser().parseFromString(html, "text/html");
          const updatedList = tempDoc.getElementById("gig-list");

          if (updatedList) {
            document.getElementById("gig-list").replaceWith(updatedList);
            console.log("✅ Gig list updated for:", artist);

            const dropdown = document.getElementById("artist-switch");
            if (dropdown) dropdown.value = artist;

            const displayName =
              dropdown?.options[dropdown.selectedIndex]?.textContent;
            const heading = document.querySelector("#gig-section h2");
            if (heading && displayName) {
              heading.textContent = `Current Gigs for ${displayName}`;
            }

            attachArtistDropdownListener(); // reattach listener to new DOM
          } else {
            console.warn("❌ #gig-list not found in response.");
            showToast("⚠️ Could not load updated gigs");
          }
        } catch (err) {
          console.error("❌ Fetch or parse error:", err);
          showToast("❌ Error switching artist.");
        }
      });
    }
  });

  // ✅ Independent reattachment logic
  function attachArtistDropdownListener() {
    const artistDropdown = document.getElementById("artist-switch");

    if (!artistDropdown) {
      console.warn("⚠️ #artist-switch not found when attaching listener.");
      return;
    }

    const clone = artistDropdown.cloneNode(true);
    artistDropdown.parentNode.replaceChild(clone, artistDropdown);

    console.log("🎧 Re-attaching artist-switch change listener");

    clone.addEventListener("change", async () => {
      const artist = clone.value;
      console.log("🎯 Artist dropdown changed to:", artist);

      try {
        const response = await fetch(`/admin?artist=${artist}`, {
          method: "GET",
          headers: {
            "X-Requested-With": "XMLHttpRequest",
          },
        });

        const html = await response.text();
        const tempDoc = new DOMParser().parseFromString(html, "text/html");
        const updatedList = tempDoc.getElementById("gig-list");

        if (updatedList) {
          document.getElementById("gig-list").replaceWith(updatedList);
          console.log("✅ Gig list replaced for:", artist);

          const dropdown = document.getElementById("artist-switch");
          if (dropdown) dropdown.value = artist;

          const displayName =
            dropdown?.options[dropdown.selectedIndex]?.textContent;
          const heading = document.querySelector("#gig-section h2");
          if (heading && displayName) {
            heading.textContent = `Current Gigs for ${displayName}`;
          }

          attachArtistDropdownListener(); // rebind again
        }
      } catch (err) {
        console.error("❌ Error switching artist:", err);
      }
    });
  }

  attachArtistDropdownListener();
});
