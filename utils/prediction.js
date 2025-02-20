function generatePrediction(match) {
    const randomProbability = () => Math.floor(Math.random() * 101); // Random percentages
  
    return {
      winner: randomProbability() > 50 ? match.teams.home.name : match.teams.away.name,
      correctScore: `${Math.floor(Math.random() * 4)} - ${Math.floor(Math.random() * 4)}`,
      corners: Math.floor(Math.random() * 20),
      yellowCards: Math.floor(Math.random() * 10),
      redCards: Math.floor(Math.random() * 3),
    };
  }
  
  module.exports = { generatePrediction };
  