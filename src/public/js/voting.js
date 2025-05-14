// This file contains client-side JavaScript for managing the voting process.

document.addEventListener("DOMContentLoaded", function () {
  const votingContainer = document.querySelector(".voting-section");
  // Get the progress bar elements
  const progressVoteCount = document.getElementById("progressVoteCount");
  const progressBar = document.querySelector(".progress-bar");
  const progressElement = document.querySelector(".progress");
  // Get the max value from the progress element (defaulting to 500000)
  const maxVotes = parseInt(
    progressElement?.getAttribute("aria-valuemax") || "500000"
  );

  if (!votingContainer) {
    return;
  }

  // Event delegation for card clicks
  votingContainer.addEventListener("click", async function (event) {
    // Find the clicked card
    const cardElement = event.target.closest(".voting-card");
    if (!cardElement) {
      return;
    }

    // Prevent default action if it's a link or form
    event.preventDefault();

    // Get the card ID and pair ID
    const selectedCardId = cardElement.dataset.cardId;
    const pairIdElement = document.querySelector('input[name="pairId"]');

    // Add this to highlight the selected card
    cardElement.classList.add("selected");

    if (!pairIdElement) {
      console.error("No pairId input found!");
      return;
    }

    const pairId = pairIdElement.value;

    // Find the other card in the pair
    const allCardElements = document.querySelectorAll(".voting-card");
    let otherCardId = null;

    // Loop through all card elements to find the one that wasn't selected
    allCardElements.forEach((card) => {
      if (card !== cardElement && card.dataset.cardId) {
        otherCardId = card.dataset.cardId;
      }
    });

    try {
      // Increase delay to 500ms (0.5s) to show the highlight longer
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Show loading state and start exit animation
      votingContainer.classList.add("voting-loading");
      votingContainer.classList.add("animating");

      // First trigger exit animations
      const containers = document.querySelectorAll(".voting-container");

      containers.forEach((container) => {
        container.classList.add("exit");
      });

      // Submit the vote via AJAX
      const response = await fetch("/api/vote", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          selectedCardId: selectedCardId,
          otherCardId: otherCardId, // Include the other card ID
          pairId: pairId,
        }),
        credentials: "same-origin", // Ensure cookies are sent with the request
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.error || `Network response was not ok: ${response.status}`
        );
      }

      const data = await response.json();

      if (data.success) {
        // Check if we had a session reset
        if (data.info && data.info.includes("Session was reset")) {
          console.log(
            "Session was reset, showing new cards without counting vote"
          );
        }

        // Update the vote count in the progress bar
        if (data.voteCount !== undefined && progressVoteCount && progressBar) {
          // Update the displayed vote count
          progressVoteCount.textContent = Number(
            data.voteCount
          ).toLocaleString();

          // Update progress bar width
          const percentage = Math.min(100, (data.voteCount / maxVotes) * 100);
          progressBar.style.width = percentage + "%";

          // Update aria attributes
          if (progressElement) {
            progressElement.setAttribute("aria-valuenow", data.voteCount);
          }
        }

        // Update the cards with the new pair
        setTimeout(() => updateCardPair(data.newPair), 800);

        // Update vote history from the same response
        if (data.voteHistory) {
          updateVoteHistory(data.voteHistory);
        }
      } else {
        throw new Error(data.error || "Unknown error");
      }
    } catch (error) {
      console.error("Error during voting:", error);

      // Show a more specific error message based on what went wrong
      if (error.message.includes("Session")) {
        alert("Session issue detected. Please refresh the page and try again.");
      } else {
        alert("Error submitting vote. Please try again.");
      }
    } finally {
      setTimeout(() => votingContainer.classList.remove("voting-loading"), 800);
      setTimeout(() => votingContainer.classList.remove("animating"), 1200);
    }
  });

  // Update the DOM with new card data
  function updateCardPair(newPair) {
    const cards = newPair.cards;
    const containers = document.querySelectorAll(".voting-container");

    // Update the pair ID in all forms
    document.querySelectorAll('input[name="pairId"]').forEach((input) => {
      input.value = newPair.pairId;
    });

    // Preload images before showing them
    const preloadPromises = cards.map((card) => {
      return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(card);
        img.onerror = () => {
          console.error(`Failed to load image for ${card.name}`);
          resolve(card); // Resolve anyway to continue the process
        };
        img.src = card.imageUrl;
      });
    });

    // Wait for images to be preloaded
    Promise.all(preloadPromises).then(() => {
      // Now update the DOM content while cards are still hidden
      for (let i = 0; i < Math.min(containers.length, cards.length); i++) {
        const container = containers[i];
        const card = cards[i];

        // Update card data
        const cardElement = container.querySelector(".voting-card");
        cardElement.dataset.cardId = card.scryfallId;
        cardElement.classList.remove("selected");

        // Update image - image is already cached now
        const img = container.querySelector(".card-img");
        img.src = card.imageUrl;
        img.alt = card.name;

        // Update title and artist
        container.querySelector(".card-title").textContent = card.name;
        const artistLink = container.querySelector(".artist-link");
        artistLink.href = `https://scryfall.com/search?q=a%3A%22${encodeURIComponent(
          card.artist
        )}%22&unique=art`;
        artistLink.textContent = card.artist;
      }

      // Now start entrance animation only after images are loaded and DOM updated
      requestAnimationFrame(() => {
        containers.forEach((container) => {
          container.classList.add("enter");
          container.classList.remove("exit");
        });

        // Force reflow
        void document.body.offsetHeight;

        // Complete the animation
        requestAnimationFrame(() => {
          setTimeout(() => {
            containers.forEach((container) =>
              container.classList.remove("enter")
            );
          }, 20);
        });
      });
    });
  }

  // Update vote history panel with new data
  function updateVoteHistory(voteHistory) {
    const historyPanel = document.querySelector(".card.mt-3");
    if (!historyPanel) return;

    const historyBody = historyPanel.querySelector(".card-body");
    if (!historyBody) return;

    if (voteHistory && voteHistory.length > 0) {
      // Create HTML for vote history
      let historyHTML = '<ul class="list-group list-group-flush">';

      voteHistory.forEach((vote) => {
        // Generate proper Scryfall URLs for images
        const leftArtUrl = generateArtCropUrl(vote.leftCard.id);
        const leftCardUrl = generateCardUrl(vote.leftCard.id);
        const rightArtUrl = generateArtCropUrl(vote.rightCard.id);
        const rightCardUrl = generateCardUrl(vote.rightCard.id);

        // Determine which card has the winner styling (green border)
        const leftCardBorder = vote.leftCard.isWinner
          ? "border: 2px solid #28a745;"
          : "";
        const rightCardBorder = vote.rightCard.isWinner
          ? "border: 2px solid #28a745;"
          : "";

        historyHTML += `
          <li class="list-group-item">
            <div class="d-flex justify-content-between align-items-center">
              <!-- Left Card -->
              <div class="d-flex align-items-center">
                <a href="https://scryfall.com/card/${vote.leftCard.id}" 
                   target="_blank" rel="noopener noreferrer" 
                   class="d-flex align-items-center text-decoration-none">
                  <div class="card-thumbnail-container">
                    <img
                      src="${leftArtUrl}" 
                      alt="${vote.leftCard.name}" 
                      class="me-2 rounded" 
                      style="width: 40px; height: 40px; object-fit: cover; ${leftCardBorder}" 
                      onerror="this.onerror=null; this.src='/api/card-back-thumb';"
                    />
                    <img
                      src="${leftCardUrl}"
                      alt="${vote.leftCard.name}"
                      class="card-full-preview"
                      loading="lazy"
                    />
                  </div>
                  <span class="text-dark">${vote.leftCard.name}</span>
                </a>
              </div>
              
              <span class="mx-2">vs</span>
              
              <!-- Right Card -->
              <div class="d-flex align-items-center">
                <a href="https://scryfall.com/card/${vote.rightCard.id}" 
                   target="_blank" rel="noopener noreferrer" 
                   class="d-flex align-items-center text-decoration-none">
                  <span class="text-dark">${vote.rightCard.name}</span>
                  <div class="card-thumbnail-container">
                    <img
                      src="${rightArtUrl}" 
                      alt="${vote.rightCard.name}" 
                      class="ms-2 rounded" 
                      style="width: 40px; height: 40px; object-fit: cover; ${rightCardBorder}" 
                      onerror="this.onerror=null; this.src='/api/card-back-thumb';"
                    />
                    <img
                      src="${rightCardUrl}"
                      alt="${vote.rightCard.name}"
                      class="card-full-preview"
                      loading="lazy"
                    />
                  </div>
                </a>
              </div>
            </div>
          </li>
        `;
      });

      historyHTML += "</ul>";
      historyBody.innerHTML = historyHTML;
    } else {
      historyBody.innerHTML =
        '<p class="p-3 text-center">No vote history yet.<br>Start voting to see your choices here!</p>';
    }
  }

  // Helper function to generate art crop URLs (same as server-side getArtCropUrl)
  function generateArtCropUrl(scryfallId) {
    if (!scryfallId) return "/api/card-back-thumb";

    try {
      const firstChar = scryfallId.charAt(0);
      const secondChar = scryfallId.charAt(1);
      return `https://cards.scryfall.io/art_crop/front/${firstChar}/${secondChar}/${scryfallId}.jpg`;
    } catch (err) {
      console.error("Error generating art URL for", scryfallId, err);
      return "/api/card-back-thumb";
    }
  }

  // Helper function to generate card URLs (same as server-side getCardUrl)
  function generateCardUrl(scryfallId) {
    if (!scryfallId) return "/api/card-back";

    try {
      const firstChar = scryfallId.charAt(0);
      const secondChar = scryfallId.charAt(1);
      return `https://cards.scryfall.io/normal/front/${firstChar}/${secondChar}/${scryfallId}.jpg`;
    } catch (err) {
      console.error("Error generating card URL for", scryfallId, err);
      return "/api/card-back";
    }
  }
});
