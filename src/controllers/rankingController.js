class RankingController {
  constructor(rankingService) {
    this.rankingService = rankingService;
  }

  async getRankings(req, res) {
    try {
      const rankings = await this.rankingService.getRankings();
      res.status(200).json(rankings);
    } catch (error) {
      res.status(500).json({ message: "Error retrieving rankings", error });
    }
  }

  async displayRankings(req, res) {
    try {
      const rankings = await this.rankingService.getRankings();
      res.render("rankings", { title: "Card Art Rankings", rankings });
    } catch (error) {
      res.status(500).send("Error displaying rankings");
    }
  }
}

// Create rankingService if it doesn't exist
const rankingService = require("../services/rankingService");

// Export controller using CommonJS format
module.exports = new RankingController(rankingService);
