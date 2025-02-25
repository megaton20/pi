
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

        // Convert last_login to UTC and manually add 1 day to fix offset issue
        const lastLoginDate = new Date(last_login);
        lastLoginDate.setUTCDate(lastLoginDate.getUTCDate() + 1); // Manually add 1 day

        const lastLoginStr = lastLoginDate.toISOString().split('T')[0];

        if (lastLoginStr === today) {
            console.log("Already logged in today, no update needed");
            return;
        }

        // Calculate yesterday from the corrected last_login
        const yesterday = new Date(lastLoginDate);
        yesterday.setUTCDate(yesterday.getUTCDate() ); // Subtract 1 day from corrected last login
        const yesterdayStr = yesterday.toISOString().split('T')[0];

        // console.log("Last Login (Corrected):", lastLoginStr);
        // console.log("Today (UTC):", today);
        // console.log("Yesterday (UTC):", yesterdayStr);

        // Update streak count correctly
        let newStreakCount = lastLoginStr === yesterdayStr ? streak_count + 1 : 1;
        let newStatus = newStreakCount >= 5 ? 'complete' : 'in_progress';

        await query('UPDATE streaks SET streak_count = $1, last_login = $2, status = $3 WHERE user_id = $4', 
                    [newStreakCount, today, newStatus, userId]);

        console.log(`Streak updated: New count = ${newStreakCount}`);
    }
};