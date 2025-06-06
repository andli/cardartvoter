document.addEventListener("DOMContentLoaded", function () {
  // Get all thumbnail containers
  const thumbnails = document.querySelectorAll(".card-thumbnail-container");

  thumbnails.forEach((container) => {
    const thumbnail = container.querySelector(".card-thumbnail");
    const preview = container.querySelector(".card-full-preview");

    if (!thumbnail || !preview) return;

    // Show preview in the right position on hover
    container.addEventListener("mouseenter", positionPreview);
    container.addEventListener("mousemove", positionPreview);

    function positionPreview(event) {
      const rect = thumbnail.getBoundingClientRect();
      const windowWidth = window.innerWidth;
      const windowHeight = window.innerHeight;

      // Default position is to the right of thumbnail
      let left = rect.right + 10;
      let top = rect.top - 30;

      // If too close to right edge, show on left instead
      if (left + 265 > windowWidth - 20) {
        left = rect.left - 275;
      }

      // If too close to bottom, adjust upward
      if (top + 370 > windowHeight) {
        top = windowHeight - 390;
      }

      // If too close to top, adjust downward
      if (top < 10) {
        top = 10;
      }

      // Set position
      preview.style.left = `${left}px`;
      preview.style.top = `${top}px`;
    }
  });
});
