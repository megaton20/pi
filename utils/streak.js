
const db = require("../model/databaseTable");
const { promisify } = require('util');
const query = promisify(db.query).bind(db);
const { v4: uuidv4 } = require('uuid')


module.exports = {
    streakCheck: async function (userId) {
        const now = new Date();
        const today = new Date(Date.UTC(
            now.getUTCFullYear(),
            now.getUTCMonth(),
            now.getUTCDate()
        )).toISOString().split('T')[0]; // Ensure today is in UTC

        const userStreak = await query('SELECT streak_count, last_login FROM streaks WHERE user_id = $1', [userId]);

        if (userStreak.rowCount === 0) {
            // First-time login, initialize streak
            await query('INSERT INTO streaks (user_id, streak_count, last_login, id) VALUES ($1, 1, $2, $3)', 
                        [userId, today, uuidv4()]);
            return;
        }

        const { streak_count, last_login } = userStreak.rows[0];


        let lastLoginDate = new Date(last_login);
        let lastLoginStr 
        let yesterday = new Date();
        yesterday.setUTCDate(yesterday.getUTCDate()-1);
        const  honestYesterdayStr = yesterday.toISOString().split('T')[0];
        
        // Adjust last_login based on environment
        if (process.env.NODE_ENV == 'production') {
            lastLoginDate.setUTCDate(lastLoginDate.getUTCDate()); 
        }else{
            console.log("Running on local, adjusting date offset");
            lastLoginDate.setUTCDate(lastLoginDate.getUTCDate() +1); // Adjust for local testing
        }
        
         lastLoginStr = lastLoginDate.toISOString().split('T')[0];
        
        if (lastLoginStr === today) {
            console.log("Already logged in today, no update needed");
            return;
        }
        

        
        // console.log("last login: " + lastLoginStr);
        // console.log("yest: " + honestYesterdayStr);
        // console.log("today: " + today);

        // Update streak count correctly
        let newStreakCount = lastLoginStr === honestYesterdayStr ? streak_count + 1 : 1;
        let newStatus = newStreakCount >= 5 ? 'complete' : 'in_progress';

        await query('UPDATE streaks SET streak_count = $1, last_login = $2, status = $3 WHERE user_id = $4', 
                    [newStreakCount, today, newStatus, userId]);

        console.log(`Streak updated: New count = ${newStreakCount}`);
    }
};