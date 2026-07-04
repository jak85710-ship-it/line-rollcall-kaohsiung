const config = require('../config');

function isCoach(lineUserId) {
  if (!lineUserId) return false;
  if (config.coachLineUserIds.length === 0) return true;
  return config.coachLineUserIds.includes(lineUserId);
}

module.exports = { isCoach };
