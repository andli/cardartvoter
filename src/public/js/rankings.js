// This file contains client-side JavaScript for handling ranking-related interactions.

document.addEventListener('DOMContentLoaded', () => {
    const rankingContainer = document.getElementById('ranking-container');

    // Function to fetch and display rankings
    const fetchRankings = async () => {
        try {
            const response = await fetch('/api/rankings');
            const rankings = await response.json();
            displayRankings(rankings);
        } catch (error) {
            console.error('Error fetching rankings:', error);
        }
    };

    // Function to display rankings in the UI
    const displayRankings = (rankings) => {
        rankingContainer.innerHTML = ''; // Clear existing rankings
        rankings.forEach(card => {
            const cardElement = document.createElement('div');
            cardElement.classList.add('card-ranking');
            cardElement.innerHTML = `
                <img src="${card.imageUrl}" alt="${card.name}" />
                <h3>${card.name}</h3>
                <p>Rating: ${card.rating}</p>
            `;
            rankingContainer.appendChild(cardElement);
        });
    };

    // Initial fetch of rankings
    fetchRankings();
});