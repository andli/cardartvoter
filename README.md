# cardartvoter

## Description
Card Art Voter is a web app for deciding which art for a card game (starting with MtG) is the most appreciated.

The idea is to let anonymous users see two cards and then click on the one they like best. After voting for a card, a new pair is shown and the user can keep clicking as long as they like. Over time, all cards in the card pool will have been compared and the site will display a full ranking.

After a while (a month?) the ranking could be reset and historical rankings can be saved and browsed through.





## Tech Stack

- **Backend:** Express.js (Node.js)
- **Database:** MongoDB (using Mongoose for models)
- **Frontend:**
  - Server-rendered pages with EJS templating
  - Bootstrap 5 for styling
  - Client-side JavaScript for interactive features
- **Real-time Communication:** Socket.IO for live rankings
- **Deployment:** Vercel & MongoDB Atlas (planned)
