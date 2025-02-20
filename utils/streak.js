
const db = require("../model/databaseTable");
const { promisify } = require('util');
const query = promisify(db.query).bind(db);
const { v4: uuidv4 } = require('uuid')

module.exports = {
   streakCheck :async function ( userId) {
        
        const today = new Date().toISOString().split('T')[0];
    
        const userStreak = await query('SELECT streak_count, last_login FROM streaks WHERE user_id = $1',[userId]);
    
        if (userStreak.rowCount === 0) {
            // First-time login, initialize streak
            await query('INSERT INTO streaks (user_id, streak_count, last_login, id) VALUES ($1, 1, $2, $3)',[userId, today, uuidv4()]);
    
        } else {
            const { streak_count, last_login } = userStreak.rows[0];
    
            if (last_login === today) {
                // Already logged in today, no update needed
                return console.log("Already logged in today, no update needed");
            }
    
            const yesterday = new Date();
            yesterday.setDate(yesterday.getDate() - 1);
            const yesterdayStr = yesterday.toISOString().split('T')[0];
    
            let newStreakCount = last_login === yesterdayStr ? streak_count + 1 : 1;
            let newStatus = newStreakCount >= 5 ? 'complete' : 'in_progress';
    
            await query('UPDATE streaks SET streak_count = $1, last_login = $2, status = $3 WHERE user_id = $4',[newStreakCount, today, newStatus, userId]);
        }
    
    }
}