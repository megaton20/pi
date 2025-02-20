const db = require("../model/databaseTable");
const { promisify } = require('util');
const query = promisify(db.query).bind(db);
const cron = require('node-cron');
const fs = require("fs");
const path = require("path");
const axios = require("axios");




const userLevelChecker = async () => {
  try {
    // Fetch all rank data
    const rankResults = await query(`SELECT * FROM "ranks"`);

    if (rankResults.rows.length <= 0) {
      // console.log("no ranks data");
      return 
    }
    const ranks = rankResults.rows;

    // Fetch all user data
    const userResults = await query(`SELECT * FROM "Users"`);
    const userData = userResults.rows;

    // Iterate over each user to determine and update their rank
    for (const user of userData) {
      let newRank = null;

      // Determine the new rank based on spending
      for (let i = 0; i < ranks.length; i++) {
        if (user.spending <= ranks[i].threshold) {
          newRank = ranks[i];
          break;
        }
      }

      // If no rank matched, assign the highest rank
      if (!newRank && ranks.length > 0) {
        newRank = ranks[ranks.length - 1];
      }

      // Update user rank if a new rank is determined
      if (newRank) {
        await query(`UPDATE "Users" SET rank = $1, rank_id = $2 WHERE id = $3`,[newRank.name, newRank.id, user.id]);
      }
    }
  } catch (err) {
    console.error('Error in userLevelChecker:', err.message);
  }
};


 async function streak (){

    const reward = 1.50
    const usersToReward = await query("SELECT user_id FROM streaks WHERE streak_count >= 5 AND status = 'complete'");

    for (let user of usersToReward.rows) {
        await query(`UPDATE users SET balance = balance + ${reward} WHERE id = $1`, [user.user_id]); // Adjust reward amount
        await query('UPDATE streaks SET streak_count = 0, status = $1 WHERE user_id = $2', ['in_progress', user.user_id]);
    }

};



 async function dailyEarning () {

    try {
        // Sum and update balance for all users
        const usersToUpdate = await query('SELECT user_id, SUM(earnings) AS total FROM daily_earnings GROUP BY user_id');

        for (let user of usersToUpdate.rows) {
            await query('UPDATE users SET balance = balance + $1 WHERE id = $2', [user.total, user.user_id]);
            await query('DELETE FROM daily_earnings WHERE user_id = $1', [user.user_id]);
        }

    } catch (error) {
        console.error('Error processing daily earnings:', error);
    }
};

// Function to check all referrals and update referrers' cashback if eligible
async function checkReferrals() {

  const referralBonus = 7.00
    try {
        // 1. Fetch all referral records where has_earned is false
        const {rows: referrals} = await query(`SELECT * FROM "referrals" WHERE "has_earned" = FALSE`);

        for (let referral of referrals) {
            const { referrer_id, referee_id } = referral;

            // const refereeResult = await query(`SELECT "spending" FROM "Users" WHERE id = $1`,[referee_id]);

                await query(`UPDATE users SET balance = balance + ${referralBonus} WHERE id = $1`,[referrer_id]);
                // Mark the referral as "has_earned" to prevent duplicate rewards
                await query(`UPDATE referrals SET "has_earned" = TRUE WHERE "referee_id" = $1`,[referee_id]);
                // await query('INSERT INTO "notifications" ("user_id", "message", "type", "is_read") VALUES ($1, $2, $3, $4)',[referrer_id, `Your have been credited with NGN ${referralBonus}. on your referral bonus`, 'success', false]);
        }

    } catch (err) {
        console.error('Error handling referrals:', err);
    }
}




// Schedule the job to run once every 24 hours
cron.schedule('0 0 * * *', () => {
  dailyEarning()
});


// Schedule the job to run every minute
cron.schedule('* * * * *', () => {
    // userLevelChecker();
    checkReferrals();
    streak()
});




module.exports = streak;
