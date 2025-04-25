// This file contains client-side JavaScript for managing the voting process.

document.addEventListener('DOMContentLoaded', () => {
    const voteButtons = document.querySelectorAll('.vote-button');
    const resultDisplay = document.getElementById('result-display');

    voteButtons.forEach(button => {
        button.addEventListener('click', () => {
            const cardId = button.dataset.cardId;
            submitVote(cardId);
        });
    });

    function submitVote(cardId) {
        fetch(`/api/vote/${cardId}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ cardId })
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                resultDisplay.innerText = `You voted for card ID: ${cardId}`;
                // Optionally, load the next pair of cards here
            } else {
                resultDisplay.innerText = 'Error submitting vote. Please try again.';
            }
        })
        .catch(error => {
            console.error('Error:', error);
            resultDisplay.innerText = 'Error submitting vote. Please try again.';
        });
    }
});