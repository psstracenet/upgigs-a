document.addEventListener("DOMContentLoaded", () => {
  console.log("🍞 toast.js loaded");

  // Toast container (create if not present)
  let toastContainer = document.getElementById("toast-container");
  if (!toastContainer) {
    toastContainer = document.createElement("div");
    toastContainer.id = "toast-container";
    toastContainer.style.position = "fixed";
    toastContainer.style.bottom = "1rem";
    toastContainer.style.left = "50%";
    toastContainer.style.transform = "translateX(-50%)";
    toastContainer.style.zIndex = "9999";
    toastContainer.style.maxWidth = "90%";
    document.body.appendChild(toastContainer);
  }

  // ✅ Global function
  window.showToast = function (message, duration = 5000) {
    const toast = document.createElement("div");
    toast.className = "toast";
    toast.innerHTML = message;

    toast.style.marginBottom = "0.75rem";
    toast.style.padding = "0.75rem 1rem";
    toast.style.border = "1px solid var(--accent, #2d89ef)";
    toast.style.background = "#fff";
    toast.style.boxShadow = "0 2px 5px rgba(0,0,0,0.1)";
    toast.style.borderRadius = "6px";
    toast.style.fontSize = "1rem";
    toast.style.display = "inline-block";

    toastContainer.appendChild(toast);

    setTimeout(() => {
      toast.remove();
    }, duration);
  };
});
