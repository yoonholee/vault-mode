// preview.js -- Markdown preview script: flash the element an in-page link jumps to.
// The webview host scrolls #links with scrollIntoView and cancels navigation, so the
// hash never changes; this listener marks the target with .vault-flash (preview.css).
document.addEventListener(
  "click",
  (event) => {
    const link = event.target instanceof Element && event.target.closest('a[href^="#"]');
    if (!link) return;
    const id = link.getAttribute("href").slice(1);
    const target = document.getElementById(id) ?? document.getElementById(decodeURIComponent(id));
    if (!target) return;
    target.classList.remove("vault-flash");
    void target.offsetWidth; // restart the animation on repeat clicks
    target.classList.add("vault-flash");
    target.addEventListener("animationend", () => target.classList.remove("vault-flash"), {
      once: true,
    });
  },
  true,
);
