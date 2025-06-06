# cardartvoter

## Description

Card Art Voter is a web app for deciding which art for a card game (starting with MtG) is the most appreciated.

The idea is to let anonymous users see two cards and then click on the one they like best. After voting for a card, a new pair is shown and the user can keep clicking as long as they like. Over time, all cards in the card pool will have been compared and the site will display a full ranking.

After a while (a month?) the ranking could be reset and historical rankings can be saved and browsed through.

Card art and data like unique id numbers for cards will be fetched from the Scryfall API. We adhere to Scryfall's Rate Limits and Good Citizenship.

Note that these sets have been excluded:

- sunf (Unfinity Sticker Sheets)
- cmb1 (Mystery Booster Playtest Cards 2019)
- dbl (Innistrad: Double Feature)
- art:"universes beyond" -art:"forgotten realms" -art:"romance-of-the-three-kingdoms"
  [40K, ACR, AFR, BOT, CLB, FCA, FIC, FIN, H17, LTC, LTR, PIP, REX, SPE, WHO] as of 2025-05-22

Explicitly included blocks: [jgp, mpr, fnm]

## TODO

- Set ranking; search for a set and get a list of how the cards in that set ranks
- Ranking trends up/down
- List most most popular red cards, etc etc on the Rankings page
- Handle double sided cards
- For generic names like "Mountain", add a gatherer ID

## Ranking algorithm

The ranking algorithm is Elo:

- Each card can accumulate a rating over time regardless of how many total cards exist
- New cards can enter the pool without disrupting the overall system
- Partial data still produces useful rankings

Initial Rating: Start all cards at 2500 points
K-Factor: Use a higher K-factor (32-64) for new cards and lower (16-24) for established ones
Confidence Tracking: Record the number of comparisons for each card

## Most appreciated artist

Trying out Bayesian Average Rating for artists:

bayesianRating = (C × M + R × V) / (C + V)

Where:

- R = current average rating for the artist's cards
- V = number of cards by the artist
- M = global average rating across all cards
- C = weight constant (typically 5-10)

### Card Selection Logic

- Prioritize showing cards with fewer comparisons
- Try to match cards with similar ratings (within ~200 points)
- Occasionally randomize to avoid "bubbles" of similar cards

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
- **Real-time Communication:** Socket.IO for live rankings (planned)
- **Deployment:** Vercel & MongoDB Atlas
