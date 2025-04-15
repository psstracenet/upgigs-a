async function loadGigs() {
  const res = await fetch("../gigs.json");
  const gigs = await res.json();

  const container = document.getElementById("gig-list");
  container.innerHTML = ""; // Clear "Loading" text

  if (!gigs.length) {
    container.innerHTML = "<p>No gigs found.</p>";
    return;
  }

  gigs.forEach((gig) => {
    const div = document.createElement("div");
    div.classList.add("gig-card");

    div.innerHTML = `
        <strong>${new Date(gig.date).toLocaleDateString()}</strong><br>
        <span>${gig.venue}</span><br>
        <em>${gig.city}</em><br>
        <span class="time">${gig.time}</span>
      `;

    container.appendChild(div);
  });
}

loadGigs();
