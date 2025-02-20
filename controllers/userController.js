const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const axios = require("axios");
const nodemailer = require("nodemailer");
const { promisify } = require("util");
const db = require("../model/databaseTable");
const query = promisify(db.query).bind(db);
const {v4:uuidv4} = require('uuid')

const quoteService = require("../utils/dialyQuote");
const getRecentCustomers = require("../model/recentCustomers");
const addRecentlyViewedItem = require("../utils/recentlyViewed");
const appInfo = require('../model/appinfo')
const calculateShippingFee = require("../utils/shippingFee");
const calculateCashback = require("../utils/cashback");



exports.mine =  async (req, res) => {
  const userId = req.user.id;
  const currentTime = Math.floor(Date.now() / 1000); // Current timestamp in seconds

  try {
      const { rows:user } = await query('SELECT last_mined, mining_level, balance  FROM users WHERE id = $1', [userId]);
      if (!user.length) return res.status(404).json({ error: "User not found" });

      let lastMineTime = Number(user[0].last_mined);
      if (lastMineTime > 9999999999) lastMineTime = Math.floor(lastMineTime / 1000);

      const remainingTime = 1800 - (currentTime - lastMineTime);
      if (remainingTime > 0) {
          return res.status(400).json({ error: "Mining cooldown active", remainingTime });
      }

      // Mining rates based on level
      const miningRates = { 1: 0.10, 2: 0.50, 3: 1.00, 4: 1.50, 5: 2.00 };
      
      const earnings = miningRates[user[0].mining_level] || 0.1;


      await query('INSERT INTO daily_earnings (id, user_id, earnings) VALUES ($1, $2,$3)', [ uuidv4(), userId, earnings]);
      const currentTimestamp = new Date(currentTime * 1000); // Convert to valid Date format
      await query('UPDATE users SET last_mined = $1 WHERE id = $2', [currentTimestamp, userId]);
      
      await query('INSERT INTO mining_logs (id, user_id, mined_amount, mining_time) VALUES ($1, $2,$3, $4)', [ uuidv4(), userId, earnings,currentTimestamp]);


      res.json({ earnings, timeLeft: 1800 });
  } catch (error) {
      console.error("Mining error:", error);
      res.status(500).json({ error: "Mining failed" });
  }
}

exports.feed = async (req, res) => {

  const id = req.user.id
  const { rows: user } = await query('SELECT * FROM users WHERE id = $1', [id]);
  const { rows: dailyEarningsResult } = await query('SELECT * FROM daily_earnings WHERE user_id = $1', [id]);
  const activeDailyEarnings = dailyEarningsResult.reduce(
    (acc, profit) => acc + parseFloat(profit.earnings),
    0
    );
    const pushes = dailyEarningsResult.length
    const { rows: userTask } = await query('SELECT * FROM user_tasks WHERE user_id = $1 AND status = $2 ', [id, 'completed']);
    
    const { rows: streak } = await query('SELECT streak_count FROM streaks WHERE user_id = $1', [id]);
   // Check if the "blackFridayShown" session variable is set
 const showModal = !req.session.blackFridayShown;

 let lastMineTime = Number(user[0].last_mined); 
  const currentTime = Math.floor(Date.now() / 1000); // Convert current time to seconds

  // Ensure lastMineTime is in seconds (convert from milliseconds if needed)
  if (lastMineTime > 9999999999) { 
      lastMineTime = Math.floor(lastMineTime / 1000);
  }
  const remainingTime = Math.max(1800 - (currentTime - lastMineTime), 0); // 30 minutes cooldown

  try {
    // Render the landing page
    res.render('./user/feed', {
      pageTitle: `Welcome to ${appInfo.name}`,
      currentPage: 'feed',
      remainingTime,
      user:user[0],
      dailyEarn:activeDailyEarnings,
      dailyEarningsResult,
      pushes,
      userTask:userTask || [],
      streak: streak || []
    });

  } catch (error) {
    console.error(`Error fetching user shop data: ${error}`);
    req.flash('error_msg', 'An error occurred while loading the shop items');
    return res.redirect('/');
  }
}
exports.leaderboard = async (req, res) => {

  const id = req.user.id
  const { rows: user } = await query('SELECT * FROM users WHERE id = $1', [id]);

  let { rows: leaderboard } = await query(
    `SELECT u.id, u.fname, u.lname, u.email, SUM(d.earnings) AS total_earnings 
     FROM daily_earnings d 
     JOIN users u ON d.user_id = u.id
     GROUP BY u.id, u.fname, u.lname, u.email
     ORDER BY total_earnings DESC 
     LIMIT 10`
  );
  


  try {
    // Render the landing page
    res.render('./user/leaderboard', {
      pageTitle: `Welcome to ${appInfo.name}`,
      currentPage: 'leaderboard',
      leaderboard: leaderboard || [],
      user:user[0],
    });

  } catch (error) {
    console.error(`Error fetching user shop data: ${error}`);
    req.flash('error_msg', 'An error occurred while loading the shop items');
    return res.redirect('/');
  }
}

exports.task =  async (req, res) => {
  
  const id = req.user.id
  const { rows: user } = await query('SELECT * FROM users WHERE id = $1', [id]);

  const tasksQuery = `
        SELECT tasks.*, 
              COALESCE(user_tasks.status, 'not_started') AS user_status
        FROM tasks
        LEFT JOIN user_tasks ON tasks.id = user_tasks.task_id AND user_tasks.user_id = $1
        WHERE COALESCE(user_tasks.status, 'not_started') != 'completed'
        ORDER BY tasks.created_at DESC;
      `;

      
    const { rows: tasks } = await query(tasksQuery, [id]);
    // const referrals = await query("SELECT * FROM referral WHERE user_id = $1", [userId]);
    let referrals = []

  try {

    // Render the landing page
    res.render('./user/tasks', {
      pageTitle: `Welcome to ${appInfo}`,
      currentPage: 'tasks',
      user:user[0],
      tasks,
      referrals
    });

  } catch (error) {
    console.error(`Error fetching user shop data: ${error}`);
    req.flash('error_msg', 'An error occurred while loading the shop items');
    return res.redirect('/');
  }
}
exports.performTask =  async (req, res) => {
  try {
    const userId = req.user.id;
    const { taskId } = req.body;

    const { rows: task } = await query('SELECT * FROM tasks WHERE id = $1', [taskId]);
    
    const insertQuery = `
    INSERT INTO user_tasks (user_id, task_id, status, id) 
    VALUES ($1, $2, $3, $4)
    `;
    
    await query(insertQuery, [userId, taskId, "in_progress", uuidv4()]);
    res.json({ success: true, link: task[0].reference_id });

  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Task start failed." });
  }
}
exports.completeTask = async (req, res) => {
  try {
    const userId = req.user.id;
    const { taskId } = req.body;

    const { rows: task } = await query('SELECT * FROM user_tasks WHERE user_id = $1 AND task_id = $2', [userId, taskId]);
    const { rows: user } = await query('SELECT * FROM users WHERE id = $1', [userId]);
    const { rows: mainTask } = await query('SELECT * FROM tasks WHERE id = $1', [taskId]);
  
    
    if (user.rowCount === 0) {
      return res.status(400).json({success: false, message: "Invalid ad session." });
    }
    if (task.rowCount === 0) {
      return res.status(400).json({success: false, message: "Invalid ad session." });
    }
    if (mainTask.rowCount === 0) {
      return res.status(400).json({success: false, message: "task  not found..." });
    }
    const newBalance = Number(user[0].balance) + Number(mainTask[0].earnings)

  const startTime = new Date(task[0].started_at);
  const currentTime = new Date();
  const timeDifference = (currentTime - startTime) / 1000

  // Check if the ad duration was actually completed
  if (timeDifference >= 30) {
        // Ensure the task is in progress before marking complete
      const updateTsk = `
      UPDATE user_tasks 
      SET status = 'completed', completed_at = NOW() 
      WHERE user_id = $1 AND task_id = $2 AND status = 'in_progress';
    `;

    const updateBalance = `UPDATE users SET balance = $1 WHERE id = $2;`;
      await query(updateTsk, [userId, taskId]);
      await query(updateBalance, [newBalance, userId]);

      return res.json({ success: true, message: `Task completed!.... $ ${mainTask[0].earnings} Rewarded!` });
      
    } else {
      res.json({ success: false, link: task[0].reference_id, message: 'watch video till the end! Rewards not added.' });

    }
  

  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Task completion failed." });
  }
}

exports.settings =  async (req, res) => {

   const id = req.user.id
  const { rows: user } = await query('SELECT * FROM users WHERE id = $1', [id]);


  try {

    // Render the landing page
    res.render('./user/settings', {
      pageTitle: `Welcome to ${appInfo}`,
      currentPage: 'profile',
      returnPage:'/user/profile',
      user:user[0]
    });

  } catch (error) {
    console.error(`Error fetching user shop data: ${error}`);
    req.flash('error_msg', 'An error occurred while loading the shop items');
    return res.redirect('/');
  }
}

exports.profile =  async (req, res) => {
  const id = req.user.id




  try {
  const { rows: user } = await query('SELECT * FROM users WHERE id = $1', [id]);
  const {rows:miningData} = await query(`
  SELECT DATE(mining_time) AS date, SUM(mined_amount) AS total_mined
  FROM mining_logs 
  WHERE user_id = $1 
  GROUP BY date 
  ORDER BY date ASC
`, [id]);

const { rows: userTask } = await query('SELECT * FROM user_tasks WHERE user_id = $1 AND status = $2 ', [id, 'completed']);

      const usersQuery = `
      SELECT u.id, u.fname, u.lname, u.balance, u.email, r.has_earned
      FROM users u
      JOIN "referrals" r ON u.id = r.referee_id
      WHERE r.referrer_id = $1
      `;
      const { rows: referees } = await query(usersQuery, [id]);
      const referalCode = user[0].referral_code || "21xdrd";

      const referLink = `${process.env.LIVE_DIRR || process.env.NGROK_URL ||  `localhost:${process.env.PORT}`}/register/?ref=${referalCode}`;


    // Render the landing page
    res.render('./user/profile', {
      pageTitle: `Welcome to ${appInfo}`,
      currentPage: 'profile',
      returnPage:'/user/profile',
      user:user[0],
      miningData:miningData|| [],
      userTask:userTask || [],
      referees,
      referLink
    });

  } catch (error) {
    console.error(`Error fetching user shop data: ${error}`);
    req.flash('error_msg', 'An error occurred while loading the shop items');
    return res.redirect('/');
  }
}


exports.settingsPassword = async (req, res) => {
  
  try {

    // Render the landing page
    res.render('./user/settings-password', {
      pageTitle: `Welcome to ${appInfo}`,
      currentPage: 'profile',
      returnPage:'/user/settings'
    });

  } catch (error) {
    console.error(`Error fetching user shop data: ${error}`);
    req.flash('error_msg', 'An error occurred while loading the shop items');
    return res.redirect('/');
  }
}
exports.settingsPrivacy = async (req, res) => {
  
  try {
    // Render the landing page
    res.render('./user/settings-privacy', {
      pageTitle: `Welcome to ${appInfo}`,
      currentPage: 'profile',
      returnPage:'/user/settings'
    });

  } catch (error) {
    console.error(`Error fetching user shop data: ${error}`);
    req.flash('error_msg', 'An error occurred while loading the shop items');
    return res.redirect('/');
  }
}




//profile for user
exports.profilePage = async (req, res) => {
  const userId = req.user.id;
  const userActive = true

  try {
    // Fetch ranks
    const ranksQuery = `SELECT name, threshold FROM "ranks"`;
    const ranksResult = await query(ranksQuery);
    const ranks = ranksResult.rows.map((rank) => ({
      name: rank.name,
      threshold: rank.threshold,
    }));

    // Fetch user data
    const userDataQuery = `SELECT * FROM "Users" WHERE "id" = $1`;
    const userDataResult = await query(userDataQuery, [userId]);
    const userData = userDataResult.rows[0];

    // Extract spending and cashback
    const spending = userData.spending;
    const cashBack = userData.cashback;

    const {
      rows: [result],
    } = await query(
      'SELECT COUNT(*) AS totalunread FROM "notifications" WHERE "user_id" = $1 AND "is_read" = $2',
      [req.user.id, false]
    );

    let totalUnreadNotification = parseInt(result.totalunread, 10);

    const referalCode = userData.referral_code || "21xdrd";

    const referLink = `https://${process.env.LIVE_DIRR || process.env.NGROK_URL ||  `http://localhost:${process.env.PORT}`}/register/?ref=${referalCode}`;
    const usersQuery = `
    SELECT u.id, u.cashback, u."First_name", u."Last_name", r.has_earned
    FROM "Users" u
    JOIN "referrals" r ON u.id = r.referee_id
    WHERE r.referrer_id = $1
`;
    const { rows: referees } = await query(usersQuery, [req.user.id]);
    const { rows: allCategory } = await query('SELECT * FROM "Category"');
    const dailyQuote = quoteService.getCurrentDailyQuote()
    const recentCustomers = getRecentCustomers()
    // Render the profile page
    return res.render("./user/userSingleView", {
      pageTitle: "User Profile",
      appInfo: appInfo,
      
      userData,
      spending,
      ranks,
      cashBack,
      totalUnreadNotification,
      referLink,
      referralResult: referees,
      allCategory,
      recentCustomers,
      recentlyViewed: req.session.recentlyViewed || [],
      dailyQuote,
      userActive
    });
  } catch (error) {
    req.flash("error_msg", `Error from server: ${error.message}`);
    return res.redirect("/user");
  }
};

exports.changePasswordPage = async (req, res) => {
  // Render the profile page

  const {
    rows: [result],
  } = await query(
    'SELECT COUNT(*) AS totalunread FROM "notifications" WHERE "user_id" = $1 AND "is_read" = $2',
    [req.user.id, false]
  );

  let totalUnreadNotification = parseInt(result.totalunread, 10);
  const { rows: allCategory } = await query('SELECT * FROM "Category"');
  return res.render("./user/change-password", {
    pageTitle: "Change Password",
    appInfo: appInfo,
    
    totalUnreadNotification,
    allCategory,
    recentlyViewed: req.session.recentlyViewed || [],
  });
};

exports.newPassword = async (req, res) => {
  const userId = req.user.id;

  const { oldPassword, newPasswordA, newPasswordB } = req.body;

  if (!(oldPassword && newPasswordA && newPasswordB)) {
    req.flash("error_msg", "Enter all Fields");
    return res.redirect(`back`);
  }

  if (newPasswordA !== newPasswordB) {
    req.flash("error_msg", "Passwords do not match");
    return res.redirect(`back`);
  }

  try {
    // Fetch user data
    const userDataQuery = `SELECT * FROM "Users" WHERE "id" = $1`;
    const { rows: userDataResult } = await query(userDataQuery, [userId]);
    const userData = userDataResult[0];

    const isMatch = await bcrypt.compare(oldPassword, userData.Password);

    if (!isMatch) {
      req.flash("error_msg", "Old Password is not correct");
      return res.redirect("back");
    }
  } catch (error) {
    console.log(error);
    req.flash("success_msg", `errorr form server`);
    return res.redirect("/");
  }

  const hashedPassword = bcrypt.hashSync(newPasswordA, 10);

  try {
    const newuuid = uuidv4()
    await query(
      'INSERT INTO "notifications" ("user_id", "message", "type", "is_read","id") VALUES ($1, $2, $3, $4,$5)',
      [req.user.id, `Your Password was changed.`, "security", false, newuuid]
    );

    await query('UPDATE "Users" SET "Password" = $1 WHERE email = $2', [
      hashedPassword,
      req.user.email,
    ]);
    req.flash("success_msg", "Password changed successfully");
    return res.redirect("/user/profile");
  } catch (error) {
    console.log(error);
    req.flash("success_msg", `errorr form server: ${error.message}`);
    return res.redirect("/login");
  }
};

exports.editProfilePage = async (req, res) => {
  const updateId = req.params.id;

  try {
    // Fetch user data
    const userQuery = `SELECT * FROM "Users" WHERE "id" = $1`;
    const userResult = await query(userQuery, [updateId]);
    const userData = userResult.rows[0];

    const {
      rows: [result],
    } = await query(
      'SELECT COUNT(*) AS totalunread FROM "notifications" WHERE "user_id" = $1 AND "is_read" = $2',
      [req.user.id, false]
    );

    let totalUnreadNotification = parseInt(result.totalunread, 10);
    const { rows: allCategory } = await query('SELECT * FROM "Category"');
    // Render the edit profile page
    return res.render("./user/userEditPage", {
      pageTitle: "Edit Profile",
      appInfo: appInfo,
      
      userData,
      stateData,
      totalUnreadNotification,
      allCategory,
      recentlyViewed: req.session.recentlyViewed || [],
    });
  } catch (error) {
    req.flash("error_msg", `Error from server: ${error.message}`);
    return res.redirect("/user");
  }
};

exports.updateImage = async (req, res) => {
  const uploadId = req.params.id;
  let filename;

  // Set the image name from the uploaded file or use a default image
  if (req.file) {
    filename = req.file.filename;
  } else {
    filename = "default.jpg";
  }

  const postData = { image: filename };

  try {
    // Update the user profile with the new image
    const updateQuery = `UPDATE "Users" SET "image" = $1 WHERE "id" = $2`;
    await query(updateQuery, [postData.image, uploadId]);

    req.flash("success_msg", "Image uploaded successfully!");
    return res.redirect(`/user/user-details`);
  } catch (error) {
    // Delete the uploaded file if there was an error
    if (req.file) {
      fs.unlinkSync(path.join(__dirname, "../uploads", req.file.filename));
    }
    req.flash("error_msg", `Error from server: ${error.message}`);
    return res.redirect("/user/user-details");
  }
};

exports.updateUserInfo = async (req, res) => {
  const userId = req.params.id;
  let errors = [];

  try {
    const { First_name, Last_name, gender, Address, land_mark, state, lga } =
      req.body;

    // Check for missing fields
    if (
      !(
        state &&
        lga &&
        land_mark &&
        Address &&
        gender &&
        First_name &&
        Last_name
      )
    ) {
      errors.push({ msg: "Please enter all details" });
    }

    // Check if user exists
    const userResult = await query(`SELECT * FROM "Users" WHERE "id" = $1`, [
      userId,
    ]);

    if (userResult.length <= 0) {
      errors.push({ msg: "User does not exist" });
    }

    const {
      rows: [result],
    } = await query(
      'SELECT COUNT(*) AS totalunread FROM "notifications" WHERE "user_id" = $1 AND "is_read" = $2',
      [req.user.id, false]
    );

    let totalUnreadNotification = parseInt(result.totalunread, 10);
    const { rows: allCategory } = await query('SELECT * FROM "Category"');
    if (errors.length > 0) {
      return res.render("./user/userEditPage", {
        pageTitle: "Edit Profile",
        appInfo: appInfo,
        
        totalUnreadNotification,
        userData: { ...req.body, id: req.user.id }, // Pass current user data for the form
        stateData, // Ensure `stateData` is defined or fetched properly
        errors,
        allCategory,
        recentlyViewed: req.session.recentlyViewed || [],
      });
    }

    // Update user information
    const updateQuery = `
      UPDATE "Users"
      SET "First_name" = $1, "Last_name" = $2, "gender" = $3, "Address" = $4, "land_mark" = $5, "state" = $6, "lga" = $7
      WHERE "id" = $8`;

    await query(updateQuery, [
      First_name,
      Last_name,
      gender,
      Address,
      land_mark,
      state,
      lga,
      userId,
    ]);


    await query(
      'INSERT INTO "notifications" (id, "user_id", "message", "type", "is_read") VALUES ($1, $2, $3, $4, $5)',
      [uuidv4(), req.user.id, `Your Info was updated.`, "security", false]
    );
    req.flash("success_msg", "User updated successfully!");
    return res.redirect(`/user/user-details`);
  } catch (error) {
    req.flash("error_msg", `Error from server: ${error.message}`);
    return res.redirect("/user");
  }
};


exports.notificationScreen = async (req, res) => {
  
  try {

    // Render the landing page
    res.render('./user/notifications', {
      pageTitle: `Welcome to ${appInfo}`,
      currentPage: 'notifications',
      notifications:[]
    });

  } catch (error) {
    console.error(`Error fetching user shop data: ${error}`);
    req.flash('error_msg', 'An error occurred while loading the shop items');
    return res.redirect('/');
  }
}

exports.settingsHelp =  async (req, res) => {
  
  
  try {

    // Render the landing page
    res.render('./user/settings-help', {
      pageTitle: `Welcome to ${appInfo}`,
      currentPage: 'profile',
      returnPage:'/user/settings'
    });

  } catch (error) {
    console.error(`Error fetching user shop data: ${error}`);
    req.flash('error_msg', 'An error occurred while loading the shop items');
    return res.redirect('/');
  }
}

exports.settingsPolicy = async (req, res) => {
  
  
  try {

    // Render the landing page
    res.render('./user/settings-policy', {
      pageTitle: `Welcome to ${appInfo}`,
      currentPage: 'profile',
      returnPage:'/user/settings'
    });

  } catch (error) {
    console.error(`Error fetching user shop data: ${error}`);
    req.flash('error_msg', 'An error occurred while loading the shop items');
    return res.redirect('/');
  }
}



exports.withdrawals = async (req, res) => {

  
  try {

    // Render the landing page
    res.render('./user/withdrawals', {
      pageTitle: `Welcome to ${appInfo}`,
      currentPage: 'withdrawals',
      recentlyViewed: req.session.recentlyViewed || [],
  });

  } catch (error) {
    console.error(`Error fetching user shop data: ${error}`);
    req.flash('error_msg', 'An error occurred while loading the shop items');
    return res.redirect('/');
  }
}


exports.readNotification = async (req, res) => {
  const id = req.params.id;

  try {
    // Fetch user data
    const { rows: userNotifications } = await query(
      'SELECT * FROM "notifications" WHERE "id" = $1',
      [id]
    );

    await query('UPDATE "notifications" SET  "is_read" = $1 WHERE "id" = $2', [
      true,
      id,
    ]);

    // Fetch user data
    const {
      rows: [result],
    } = await query(
      'SELECT COUNT(*) AS totalunread FROM "notifications" WHERE "user_id" = $1 AND "is_read" = $2',
      [req.user.id, false]
    );

    let totalUnreadNotification = parseInt(result.totalunread, 10);
    const { rows: allCategory } = await query('SELECT * FROM "Category"');
    // Render the checkout page
    res.render("./user/notifications-details", {
      pageTitle: "notifications details ",
      appInfo: appInfo,
      
      userNotifications,
      totalUnreadNotification,
      allCategory,
      recentlyViewed: req.session.recentlyViewed || [],
    });
  } catch (error) {
    console.error(`Error during checkout: ${error}`);
    req.flash("error_msg", "An error occurred ");
    return res.redirect("/user");
  }
};

exports.readAllNotification = async (req, res) => {
  const id = req.user.id;

  try {
    await query(
      'UPDATE "notifications" SET  "is_read" = $1 WHERE "user_id" = $2',
      [true, id]
    );

    // Render the checkout page
    req.flash("warning_msg", "All rrreaddd! ");
    res.redirect("back");
  } catch (error) {
    console.error(`Error during checkout: ${error}`);
    req.flash("error_msg", "An error occurred ");
    return res.redirect("/user");
  }
};

exports.deleteNotification = async (req, res) => {
  const editID = req.params.id;

  try {
    // Use a parameterized query with $1 for PostgreSQL
    await query(`DELETE FROM "notifications" WHERE "id" = $1`, [editID]);
    return res.redirect("back");
  } catch (error) {
    req.flash("error_msg", `Error from server: ${error.message}`);
    return res.redirect("/user");
  }
};




exports.deleteAccount = async (req, res) => {


  try {
    const {rows: [user]} = await query('SELECT COUNT(*) AS totalunread FROM "notifications" WHERE "user_id" = $1 AND "is_read" = $2',[req.user.id, false]);


     return res.render('./user/delete-account', {
        pageTitle: `Welcome to ${appInfo}`,
        currentPage: 'profile',
        returnPage:'/user/settings',
        user
    });
  } catch (err) {
    console.error(err);
    req.flash("warning_msg", "Server Error!");
    return res.redirect("back");
  }
};
