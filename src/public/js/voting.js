// This file contains client-side JavaScript for managing the voting process.

document.addEventListener("DOMContentLoaded", function () {
  console.log("Voting script loaded");
  const votingContainer = document.querySelector(".voting-section");

  if (!votingContainer) {
    console.warn("No voting section found on page");
    return;
  }

  console.log("Voting container found, setting up event listeners");

  // Event delegation for card clicks
  votingContainer.addEventListener("click", async function (event) {
    console.log("Click detected in voting container");

    // Find the clicked card
    const cardElement = event.target.closest(".voting-card");
    if (!cardElement) {
      console.log("Click was not on a card element");
      return;
    }

    console.log("Card clicked:", cardElement);

    // Prevent default action if it's a link or form
    event.preventDefault();

    // Get the card ID and pair ID
    const cardId = cardElement.dataset.cardId;
    const pairIdElement = document.querySelector('input[name="pairId"]');

    // Add this to highlight the selected card
    cardElement.classList.add("selected");

    if (!pairIdElement) {
      console.error("No pairId input found!");
      return;
    }

    const pairId = pairIdElement.value;
    console.log(`Voting for card ${cardId} with pair ID ${pairId}`);

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
          selectedCardId: cardId,
          pairId: pairId,
        }),
      });

      console.log("Got response:", response);

      if (!response.ok) {
        throw new Error(`Network response was not ok: ${response.status}`);
      }

      const data = await response.json();
      console.log("Response data:", data);

      if (data.success) {
        console.log("Vote successful, showing feedback");
        // Show brief feedback about the vote result
        showVoteFeedback(cardId, data.result.ratingChange);

        // Update the cards with the new pair
        console.log("Updating card pair with new data");
        setTimeout(() => updateCardPair(data.newPair), 800);
      } else {
        throw new Error(data.error || "Unknown error");
      }
    } catch (error) {
      console.error("Error during voting:", error);
      alert("Error submitting vote. Please try again.");
    } finally {
      setTimeout(() => votingContainer.classList.remove("voting-loading"), 800);
      setTimeout(() => votingContainer.classList.remove("animating"), 1200);
    }
  });

  // Update the DOM with new card data
  function updateCardPair(newPair) {
    console.log("Updating card pair:", newPair);
    const cards = newPair.cards;
    const containers = document.querySelectorAll(".voting-container");

    // Update the pair ID in all forms
    document.querySelectorAll('input[name="pairId"]').forEach((input) => {
      input.value = newPair.pairId;
    });

    // Delay to allow exit animation to complete
    setTimeout(() => {
      // Update each card
      for (let i = 0; i < Math.min(containers.length, cards.length); i++) {
        const container = containers[i];
        const card = cards[i];

        console.log(`Updating card ${i + 1}:`, card.name);

        // Update card data
        const cardElement = container.querySelector(".voting-card");
        cardElement.dataset.cardId = card.scryfallId;
        cardElement.classList.remove("selected"); // IMPORTANT: Remove the selected class from the new cards

        // Update image
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

      // After updating, add the enter class to prepare for animation
      containers.forEach((container) => {
        container.classList.add("enter");
        container.classList.remove("exit");
      });

      // Force reflow
      void document.body.offsetHeight;

      // Use requestAnimationFrame for smoother animation timing
      requestAnimationFrame(() => {
        setTimeout(() => {
          containers.forEach((container) =>
            container.classList.remove("enter")
          );
        }, 20); // Shorter delay for more immediate response
      });
    }, 450); // Give more time for exit animation to complete
  }

  // Show feedback for the vote result
  function showVoteFeedback(cardId, ratingChange) {
    console.log("Showing vote feedback:", ratingChange);
    const card = document.querySelector(
      `.voting-card[data-card-id="${cardId}"]`
    );
    if (!card) return;

    // Create a feedback element
    const feedback = document.createElement("div");
    feedback.className = "vote-feedback";
    feedback.textContent = ratingChange > 0 ? `+${ratingChange}` : ratingChange;
    feedback.classList.add(ratingChange > 0 ? "positive" : "negative");

    // Add to the card
    card.appendChild(feedback);

    // Animate and remove after animation
    setTimeout(() => {
      feedback.classList.add("animate");
      setTimeout(() => feedback.remove(), 750);
    }, 50);
  }
});
