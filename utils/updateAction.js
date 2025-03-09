const db = require("../model/databaseTable");
const { promisify } = require('util');
const query = promisify(db.query).bind(db);
const cron = require('node-cron');
const fs = require("fs");
const path = require("path");
const axios = require("axios");
const miningRatesData = require('../model/miningRates')


// Function to determine user level based on balance
// function getUserLevelByBalance(balance) {
//     if (balance >= 10000) return 10;
//     if (balance >= 9000) return 9;
//     if (balance >= 8000) return 8;
//     if (balance >= 7000) return 7;
//     if (balance >= 6000) return 6;
//     if (balance >= 5000) return 5;
//     if (balance >= 4000) return 4;
//     if (balance >= 3000) return 3;
//     if (balance >= 2000) return 2;
//     return 1; 
// }



const userLevelChecker = async () => {
    function getUserLevelByReferralCount(referralCount) {
        if (referralCount >= 40) return 10;
        if (referralCount >= 35) return 9;
        if (referralCount >= 30) return 8;
        if (referralCount >= 25) return 7;
        if (referralCount >= 20) return 6;
        if (referralCount >= 16) return 5;
        if (referralCount >= 15) return 4;
        if (referralCount >= 10) return 3;
        if (referralCount >= 5) return 2;
        return 1; // Default level if referrals are less than 5
    }

    const MiningRate = miningRatesData

    try {
        // Fetch all users
        const users = await query("SELECT id, mining_level FROM users");

        for (const user of users.rows) {
            // Count referrals for each user
            const referralResult = await query("SELECT COUNT(*) AS referral_count FROM referrals WHERE referrer_id = $1", [user.id]);
            const referralCount = parseInt(referralResult.rows[0].referral_count);

            const newLevel = getUserLevelByReferralCount(referralCount);
            const newMiningRate = MiningRate[newLevel];


            if (newLevel > user.mining_level) {
                // Update the user's level and mining rate
                await query("UPDATE users SET mining_level = $1, mining_rate = $2 WHERE id = $3", [newLevel, newMiningRate, user.id]);
            }
        }
    } catch (error) {
        console.error("Error updating user levels and mining rates:", error);
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

            const result = await query(`UPDATE users SET balance = balance + $1 WHERE id = $2 AND verified = $3 RETURNING *`, [referralBonus, referrer_id, true]);
            
            if (result.rowCount > 0) { // Corrected 'rowcount' to 'rowCount'
                // Mark the referral as "has_earned" to prevent duplicate rewards
                await query(`UPDATE referrals SET has_earned = TRUE WHERE referee_id = $1`, [referee_id]);
            }

                // await query('INSERT INTO "notifications" ("user_id", "message", "type", "is_read") VALUES ($1, $2, $3, $4)',[referrer_id, `Your have been credited with NGN ${referralBonus}. on your referral bonus`, 'success', false]);
        }

    } catch (err) {
        console.error('Error handling referrals:', err);
    }
}




// Schedule the job to run once every 24 hours
cron.schedule('0 0 * * *', () => {
  dailyEarning()
//   userLevelChecker();
});

// cron.schedule('0 8 * * *', () => { 
//     dailyEarning(); 
//   });

// Schedule the job to run every minute
cron.schedule('* * * * *', () => {
    dailyEarning()
    userLevelChecker();
    checkReferrals();
    streak()
});




module.exports = streak;
