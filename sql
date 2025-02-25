CREATE TABLE daily_earnings (
    id VARCHAR(255) PRIMARY KEY,
    user_id VARCHAR(255) REFERENCES users(id) ON DELETE CASCADE,
    earnings DECIMAL(10,2) NOT NULL,
    recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);


CREATE TABLE users (
    id VARCHAR(255) PRIMARY KEY,
    fname VARCHAR(255) NOT NULL,
	lname VARCHAR(255) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password TEXT NOT NULL,
    balance DECIMAL(10, 2) DEFAULT 0.00, -- User's earnings
    mining_level INT DEFAULT 1, -- Level system for mining
    mining_rate DECIMAL(5,4) DEFAULT 0.10, -- Earnings per mining session
    last_mined TIMESTAMP DEFAULT NOW(), -- Last mining action
    referral_code VARCHAR(20) UNIQUE, -- User's unique referral code
    ad_watched INT DEFAULT 0, -- Number of ads watched
    boost_active BOOLEAN DEFAULT FALSE, -- Whether user has a boost active
    boost_expires TIMESTAMP, -- When boost expires
	daily_earnings DECIMAL(10,2) DEFAULT 0.00,
    premium_user BOOLEAN DEFAULT FALSE, -- VIP status
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
	user_role VARCHAR(20),
	image TEXT DEFAULT 'avatar.png',
    verified BOOLEAN DEFAULT FALSE
);



CREATE TABLE mining_logs (
    id VARCHAR(255) PRIMARY KEY,
    user_id VARCHAR(255) REFERENCES users(id) ON DELETE CASCADE,
    mined_amount DECIMAL(10,4) NOT NULL,
    mining_time TIMESTAMP DEFAULT NOW()
);


CREATE TABLE tasks (
    id VARCHAR(255) PRIMARY KEY,
    task_type VARCHAR(50) NOT NULL, -- e.g., 'watch_video', 'play_game', 'listen_music'
    source VARCHAR(255) NOT NULL,   -- e.g., 'YouTube', 'Spotify', 'GameApp'
    reference_id TEXT NOT NULL,     -- e.g., YouTube video ID, Game URL, Music link
    earnings DECIMAL(10,4) NOT NULL, -- Amount user earns
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE user_tasks (
    id VARCHAR(255) PRIMARY KEY,
    user_id VARCHAR (255) REFERENCES users(id) ON DELETE CASCADE,
    task_id VARCHAR(255) REFERENCES tasks(id) ON DELETE CASCADE,
    status VARCHAR(20) DEFAULT 'in_progress', -- 'in_progress', 'completed'
    started_at TIMESTAMP DEFAULT NOW(),
    completed_at TIMESTAMP
);


CREATE TABLE streaks (
    id VARCHAR(255) PRIMARY KEY,
    user_id VARCHAR (255) REFERENCES users(id) ON DELETE CASCADE,
    streak_count INT DEFAULT 0,
    last_login DATE,
    status TEXT DEFAULT 'in_progress' -- 'in_progress' or 'complete'
);

--  3️⃣ Sample Data (Insert Example Tasks)

-- INSERT INTO tasks (task_type, source, reference_id, earnings)
-- VALUES
--     ('watch_video', 'YouTube', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', 0.10),
--     ('play_game', 'GameApp', 'https://examplegame.com/play', 0.20),
--     ('listen_music', 'Spotify', 'https://open.spotify.com/track/xyz', 0.05);


-- 5️⃣ Get Leaderboard (Top Earners from Tasks)

-- SELECT users.id, users.fname, users.lname, SUM(tasks.earnings) AS total_earned
-- FROM user_tasks
-- JOIN users ON users.id = user_tasks.user_id
-- JOIN tasks ON tasks.id = user_tasks.task_id
-- WHERE user_tasks.status = 'completed'
-- GROUP BY users.id, users.fname, users.lname
-- ORDER BY total_earned DESC
-- LIMIT 10;

-- 📌 6️⃣ Track User’s Total Earnings
-- sql
-- Copy
-- Edit
-- SELECT SUM(tasks.earnings) AS total_earned
-- FROM user_tasks
-- JOIN tasks ON tasks.id = user_tasks.task_id
-- WHERE user_tasks.user_id = $1 AND user_tasks.status = 'completed';


CREATE TABLE public.referrals (
    id character varying(255) PRIMARY KEY,
    referrer_id character varying(255) NOT NULL,
    referee_id character varying(255) NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    has_earned boolean DEFAULT false
);


CREATE TABLE withdrawals (
    id character varying(255) PRIMARY KEY,
    user_id VARCHAR (255) REFERENCES users(id) ON DELETE CASCADE,
    bank VARCHAR (255),
    account_number VARCHAR (255) ,
    amount DECIMAL(10, 2) NOT NULL,
    status VARCHAR(20) DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT NOW()
);


