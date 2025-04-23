# cardartvoter

## Description

Card Art Voter is a web app for deciding which art for a card game (starting with MtG) is the most appreciated.

The idea is to let anonymous users see two cards and then click on the one they like best. After voting for a card, a new pair is shown and the user can keep clicking as long as they like. Over time, all cards in the card pool will have been compared and the site will display a full ranking.

After a while (a month?) the ranking could be reset and historical rankings can be saved and browsed through.

Card art and data like unique id numbers for cards will be fetched from the Scryfall API.

The ranking algorithm is Elo:

- Each card can accumulate a rating over time regardless of how many total cards exist
- New cards can enter the pool without disrupting the overall system
- Partial data still produces useful rankings

## Features to implement further on

- Smart pairing - Match cards with similar ratings to get more meaningful comparisons
- Cold start handling - New cards need special treatment to quickly establish baseline ratings
- Data sampling - Track which cards have fewer votes and prioritize showing them.

## Tech Stack

- **Backend:** Express.js (Node.js)
- **Database:** MongoDB (using Mongoose for models)
- **Frontend:**
  - Server-rendered pages with EJS templating
  - Bootstrap 5 for styling
  - Client-side JavaScript for interactive features
- **Real-time Communication:** Socket.IO for live rankings
- **Deployment:** Vercel & MongoDB Atlas (planned)
