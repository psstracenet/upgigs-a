
import { getCookie } from "./utils.js";

// Function to retrieve a cookie by name


document.addEventListener("DOMContentLoaded", () => {
  console.log("✅ DOM loaded and admin.js running");

  // 🚪 Logout handler
  const logoutLink = document.getElementById("logout-link");
  if (logoutLink) {
    logoutLink.addEventListener("click", (e) => {
      e.preventDefault();
      document.cookie = "token=;expires=Thu, 01 Jan 1970 00:00:00 UTC;path=/"; // Clear the token cookie
      window.location.href = "/";
    });
  }

  // 🎤 Artist Dropdown – Load selected artist's gigs securely
  const artistDropdown = document.getElementById("artist-switch");

  if (artistDropdown) {
    console.log("🎧 Found #artist-switch dropdown");

    // artistDropdown.addEventListener("change", async () => {
    //   const artist = artistDropdown.value;
    //   console.log("🎯 Artist dropdown changed to:", artist);

    //   // Retrieve the token from cookies
    //   const token = getCookie("token");
    //   console.log("Retrieved token from cookies:", token); // Debugging the token value

    //   if (!token) {
    //     console.error("❌ No token found in cookies");
    //     showToast("⚠️ No token found. Please log in again.");
    //     return;
    //   }

    //   try {
    //     const response = await fetch(`/admin?artist=${artist}`, {
    //       method: "GET",
    //       headers: {
    //         "X-Requested-With": "XMLHttpRequest",
    //       },
    //       credentials: "same-origin", // Ensure cookies are included with the request
    //     });

    //     const html = await response.text();
    //     console.log("📦 Response received. Length:", html.length);

    //     const tempDoc = new DOMParser().parseFromString(html, "text/html");
    //     const updatedSection = tempDoc.getElementById("gig-section");

    //     if (updatedSection) {
    //       document.getElementById("gig-section").replaceWith(updatedSection);
    //       console.log("✅ Gig section updated for:", artist);

    //       // ✅ Update the heading with the selected artist name
    //       const displayName =
    //         artistDropdown.options[artistDropdown.selectedIndex]?.textContent;
    //       const heading = document.querySelector("#gig-section h2");
    //       if (heading && displayName) {
    //         heading.textContent = `Current Gigs for ${displayName}`;
    //       }
    //     } else {
    //       console.warn("❌ #gig-section not found in response.");
    //       showToast("⚠️ Could not load updated gigs");
    //     }
    //   } catch (err) {
    //     console.error("❌ Fetch or parse error:", err);
    //     showToast("❌ Error switching artist.");
    //   }
    // });

    function attachPaginationListeners(selectedArtist) {
      const prevBtn = document.getElementById("prev-page");
      const nextBtn = document.getElementById("next-page");
    
      [prevBtn, nextBtn].forEach(btn => {
        if (btn) {
          // Remove any previous listeners to prevent stacking
          btn.onclick = null;
          btn.onclick = async function () {
            const currentPage = parseInt(document.querySelector(".pagination-controls span").textContent.match(/Page (\d+)/)[1], 10);
            const newPage = btn.id === "prev-page" ? currentPage - 1 : currentPage + 1;
            await fetchAndUpdateGigs(selectedArtist, newPage);
          };
        }
      });
    }
    
    async function fetchAndUpdateGigs(artist, page = 1) {
      try {
        const response = await fetch(`/admin?artist=${artist}&page=${page}`, {
          method: "GET",
          headers: {
            "X-Requested-With": "XMLHttpRequest",
          },
        });
        const html = await response.text();
        const tempDoc = new DOMParser().parseFromString(html, "text/html");
        const updatedSection = tempDoc.getElementById("gig-section");
        if (updatedSection) {
          document.getElementById("gig-section").replaceWith(updatedSection);
          attachPaginationListeners(artist); // Always reattach after every update
          // Only call attachArtistDropdownListener if you ever replace the dropdown itself
        }
      } catch (err) {
        console.error("❌ Error fetching gigs:", err);
      }
    }
    
    // Attach the artist dropdown handler ONCE:
    if (artistDropdown) {
      artistDropdown.addEventListener("change", async () => {
        const artist = artistDropdown.value;
        await fetchAndUpdateGigs(artist, 1);
      });
      // On initial page load, also attach pagination listeners for the default artist
      attachPaginationListeners(artistDropdown.value);
    }
  }
});

// ✅ Independent reattachment logic (removed the unnecessary cloning logic)
function attachArtistDropdownListener() {
  const artistDropdown = document.getElementById("artist-switch");

  if (!artistDropdown) {
    console.warn("⚠️ #artist-switch not found when attaching listener.");
    return;
  }

  // Only attach the listener once here.
  artistDropdown.addEventListener("change", async () => {
    const artist = artistDropdown.value;
    console.log("🎯 Artist dropdown changed to:", artist);

    // Retrieve the token from cookies
    const token = getCookie("token");
    console.log("Retrieved token:", token); // Debugging the token value

    if (!token) {
      console.error("❌ No token found in cookies");
      showToast("⚠️ No token found. Please log in again.");
      return;
    }

    try {
      const response = await fetch(`/admin?artist=${artist}`, {
        method: "GET",
        headers: {
          "X-Requested-With": "XMLHttpRequest",
        },
        credentials: "same-origin", // Ensure cookies are included
      });

      const html = await response.text();
      console.log("📦 Response received. Length:", html.length);

      const tempDoc = new DOMParser().parseFromString(html, "text/html");
      const updatedSection = tempDoc.getElementById("gig-section");

      if (updatedSection) {
        document.getElementById("gig-section").replaceWith(updatedSection);
        console.log("✅ Gig section updated for:", artist);

        // ✅ Update the heading with the selected artist name
        const dropdown = document.getElementById("artist-switch");
        const displayName =
          dropdown?.options[dropdown.selectedIndex]?.textContent;
        const heading = document.querySelector("#gig-section h2");
        if (heading && displayName) {
          heading.textContent = `Current Gigs for ${displayName}`;
        }
      } else {
        console.warn("❌ #gig-section not found in response.");
        showToast("⚠️ Could not load updated gigs");
      }
    } catch (err) {
      console.error("❌ Error switching artist:", err);
    }
  });
}

attachArtistDropdownListener(); // Attach listener to the dropdown on page load
