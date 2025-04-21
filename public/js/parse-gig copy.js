console.log("🧪 parse-gig.js loaded");

document.addEventListener("DOMContentLoaded", () => {
  // 🧼 Auto-dismiss delete message
  const alert = document.getElementById("delete-alert");
  if (alert) {
    setTimeout(() => {
      alert.style.display = "none";
    }, 5000);
  }

  // 🧼 Logout handler
  const logoutLink = document.getElementById("logout-link");
  if (logoutLink) {
    logoutLink.addEventListener("click", (e) => {
      e.preventDefault();
      localStorage.removeItem("jwtToken");
      window.location.href = "/";
    });
  }

  // 🧼 Cancel parsed gig forms
  document.querySelectorAll(".cancel-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const form = btn.closest("form.gig-card");
      if (!form) return;

      form.classList.add("dismiss");
      setTimeout(() => {
        form.remove();
      }, 300);
    });
  });

  // 🧼 Submit the gig parsing request with Authorization header
  const parseGigForm = document.getElementById("parse-gig-form");
  if (parseGigForm) {
    parseGigForm.addEventListener("submit", async (e) => {
      console.log("✅ Original submit handler fired");

      e.preventDefault();

      const token = localStorage.getItem("jwtToken"); // Get the JWT token
      const message = document.getElementById("message").value; // The message to be parsed
      const artist = document.getElementById("artist").value; // Artist name (from the dropdown)
      console.log("Authorization Header:", `Bearer ${token}`);

      if (!token) {
        alert("No token found.");
        return;
      }

      try {
        console.log("JWT Token from localStorage:", token);
        console.log("Authorization Header:", `Bearer ${token}`);

        const response = await fetch("http://localhost:8081/parse-gig/", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`, // Include the JWT in the Authorization header
          },
          body: JSON.stringify({ message, artist }),
        });

        const result = await response.json();
        if (response.ok) {
          console.log("Gig parsed successfully:", result);
          // You can handle the result, e.g., display parsed gig information
        } else {
          alert("Failed to parse gig.");
          console.error(result);
        }
      } catch (err) {
        console.error("Error parsing gig:", err);
        alert("Error processing gig. Please try again.");
      }
    });
  }
});
