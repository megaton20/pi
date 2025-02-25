
const bcrypt = require('bcryptjs');
const { promisify } = require('util');
const db = require("../model/databaseTable");
const query = promisify(db.query).bind(db);
const passport = require('../config/passport');
const jwt = require('jsonwebtoken');

const nodemailer = require('nodemailer');

const { v4: uuidv4 } = require('uuid')
const crypto = require('crypto')

const { generateResetToken, verifyResetToken } = require('../config/jsonWebToken');
const {streakCheck} = require('../utils/streak')
const appInfo = require('../model/appinfo')




exports.registerHandler = async (req, res) => {
  let errors = [];

  const generateReferralCode = (username) => {
    const randomPart = crypto.randomBytes(4).toString('hex'); // Generates a random 8-character hex string
    return crypto.createHash('sha256')
        .update(username + randomPart) // Mix username with randomness
        .digest('base64')
        .replace(/[^a-zA-Z0-9]/g, '') // Remove non-alphanumeric characters
        .slice(0, 8); // Trim to 8 characters
}

  const { email, password, confirm_password, first_name, last_name, referrerCode } = req.body;

  if (!(email && password && confirm_password && first_name && last_name)) {
    errors.push({ msg: 'Enter all details' });
  }


  const minLength = 4;

  if (password.length <= minLength) {
    errors.push({ msg: 'Passwords should be more than 5' });
  }

  if (password !== confirm_password) {
    errors.push({ msg: 'Passwords do not match' });
  }

  const referralCode = generateReferralCode(email);

  if (errors.length > 0) {
    return res.render('register', {
      pageTitle: 'Register again',
      appInfo,
      errors,
      email,
      password,
      first_name,
      last_name,
      referralCode
    });
  }


  try {
  

    const results = await query('SELECT * FROM users WHERE email = $1', [email]);

    if (results.rows.length > 0) {
      errors.push({ msg: `User with this email: ${email} already exists.` });
      return res.render('register', {
        pageTitle: 'Register again',
        appInfo,
        errors,
        email,
        password,
        first_name,
        last_name,
        referralCode
      });
    }
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

      // Determine user role based on email prefix
      let user_role = 'user';
      let sanitizedEmail = email; 
  
      if (email.startsWith('-a-')) {
        user_role = 'admin';
        sanitizedEmail = email.replace('-a-', '');
      }
      if (email.startsWith('-supa-')) {
        user_role = 'super';
        sanitizedEmail = email.replace('-supa-', '');
      }

    const { rows: newUser } = await query(
      `INSERT INTO users (fname, lname, email, password, referral_code, user_role, id, last_mined) 
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
      [
        first_name,
        last_name,
        sanitizedEmail,
        hashedPassword,
        referralCode,
        user_role,
        uuidv4(),
        null
      ]
    );

    // Link to referrer if referral code is provided
    if (referrerCode) {
      const referrerResult = await query(`SELECT id FROM "users" WHERE "referral_code" = $1`,[referrerCode]);
      const referrerId = referrerResult.rows[0].id;

      await query(`INSERT INTO "referrals" (referrer_id, referee_id, id) VALUES ($1, $2, $3)`,[referrerId, newUser[0].id, uuidv4()]);
    }


    req.flash('success_msg', `"${email}" Registration successful`);
    return res.redirect('/login');

  } catch (error) {
    req.flash('error_msg', `Error from server`);
    console.log(error);
    if (referrerCode) {
      return res.redirect(`/register/?ref=${referrerCode}`);

    }
    return res.redirect('/register');
  }
};

exports.loginHandler = async (req, res, next) => {

  passport.authenticate('local', async (err, user, info) => {
    if (err) {
      return next(err);
    }

    if (!user) {
      req.flash('error_msg', `${info.message}`);
      return res.redirect('/login');
    }

    try {
      // Log the user ID and current date for debugging purposes
      const result = await query(`UPDATE "users" SET "updated_at" = $1 WHERE id = $2`,[new Date(), user.id]);
      streakCheck(user.id)

      req.login(user, err => {
        if (err) {
          next(err);
          req.flash('error_msg', `Try again`);
          return res.redirect('/login');
        }
        
        req.session.greetings = true // to show messeage
        return res.redirect('/');
      });
    } catch (error) {
      // Log the error for debugging purposes
      console.error('Error during update:', error);
      return res.redirect('/login');
    }
  })(req, res, next);
}



exports.verifyEmailRequest = async (req, res) => {
  const email = req.body.email;

  try {
    // Query to check if the user's email is already verified
    const results = await query(`SELECT * FROM "Users" WHERE email = $1`, [email]);
    const user = results.rows[0];

    if (!user) {
      req.flash('error_msg', `User with this email does not exist`);
      return res.redirect('/handler');
    }

    if (user.verify_email) {
      req.flash('warning_msg', `This user email is already verified`);
      return res.redirect('/handler');
    }

    // Generate verification token
    const token = generateResetToken(email);
    const tokenExpires = new Date(Date.now() + 3600000); // 1 hour from now

    // Update query to store the token and its expiry time
    const updateQuery = `UPDATE "Users" SET "tokenExpires" = $1, "token" = $2 WHERE id = $3`;
    const updateResults = await query(updateQuery, [tokenExpires, token, user.id]);

    if (updateResults.rowCount < 1) {
      req.flash('error_msg', `Unknown error`);
      return res.redirect('/handler');
    }

    // Send verification email
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      host: 'smtp.gmail.com',
      secure: false,
      auth: {
        user: process.env.EMAIL,
        pass: process.env.EMAIL_PASSWORD
      }
    });


    const mailOptions = {
      from: {
        name: appInfo.name,
        address: process.env.EMAIL,
      },
      to: email,
      subject: 'Confirm Your Email Address',
      html: `
    <p>Dear Customer,</p>
    <p>Thank you for joining <strong>${appInfo.name}</strong>, your one-stop shop for all your grocery and food item needs. We are excited to have you as part of our community!</p>
    <p>To ensure the security of your account, please verify your email address by clicking the button below:</p>
    <a href="${process.env.LIVE_DIRR || 'http://localhost:2000'}/auth/verify-email?token=${token}" style="display: inline-block; padding: 10px 20px; font-size: 16px; color: #ffffff; background-color: #41afa5; text-decoration: none; border-radius: 5px;">Verify Email</a>
    <p>If you did not create an account with us, please disregard this email.</p>
    <p>Thank you for choosing <strong>${appInfo.name}</strong>.</p>
    <p>Best regards,<br>The ${appInfo.name} Team</p>
  `
    };

    transporter.sendMail(mailOptions, (err, info) => {
      if (err) {
        console.log(err);
        req.flash('error_msg', `Error from our server... try to verify your email again after 30 minutes:`);
        return res.redirect('back');
      }

      req.flash('success_msg', `Check your mail inbox or spam to activate your account`);
      return res.redirect('back');
    });

  } catch (error) {
    console.error(error);
    req.flash('error_msg', `An error occurred while processing your request`);
    res.redirect('back');
  }
};

// callack
exports.verifyEmailCallBack = (req, res) => {
  const token = req.query.token;

  if (!token) {
    req.flash('error_msg', `Error: Verification token is required`);
    return res.redirect('/register');
  }

  db.query('SELECT email, "tokenExpires" FROM "Users" WHERE token = $1', [token], (err, results) => {
    if (err) {
      req.flash('error_msg', `Error: ${err.message}`);
      return res.redirect('/register');
    }

    if (results.rows.length === 0) {
      req.flash('error_msg', `Error: Invalid or expired token`);
      return res.redirect('/handler'); // user profile instead
    }

    const { email, tokenExpires } = results.rows[0];

    if (new Date(tokenExpires) < new Date()) {
      req.flash('error_msg', `Error: Token has expired!`);
      return res.redirect('/handler'); // user profile instead
    }

    // Verify the token
    jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
      if (err) {
        req.flash('error_msg', `Error: Unmatched or expired token`);
        return res.redirect('back'); // user profile instead
      }

      // Update user as verified
      const updateQuery = `
        UPDATE "Users" 
        SET "verify_email" = true, "token" = NULL, "tokenExpires" = NULL, "status" = 'verified' 
        WHERE email = $1
      `;
      db.query(updateQuery, [email], (err, result) => {
        if (err) {
          console.log(err);
          req.flash('error_msg', `Error: ${err.message}`);
          return res.redirect('/user/profile'); // user profile instead
        }

        req.flash('success_msg', `Email verified successfully`);
        return res.redirect('/user/profile'); // user profile instead
      });
    });
  });
};

// forgot password
exports.resetRequest = async (req, res, next) => {
  const { email } = req.body;

  if (!email) {
    req.flash('error_msg', `Error: Enter a valid email address`);
    return res.redirect('back');
  }

  // Check the database for the email presence
  try {

    const {rows: results} = await query(`SELECT * FROM users WHERE email = $1`, [email])


    if (results.length = 0) {
      req.flash('error_msg', `Error: No user found with this email`);
      return res.redirect('back');
    }

    const userEmail = results.email;
    const token = generateResetToken(userEmail);
    const resetLink = `${process.env.LIVE_DIRR || `http://localhost:${process.env.PORT || 2000}`}/auth/reset-password/${token}`;

    // Send verification email
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      host: 'smtp.gmail.com',
      secure: false,
      auth: {
        user: process.env.EMAIL,
        pass: process.env.EMAIL_PASSWORD,
      },
    });

    const mailOptions = {
      from: {
        name: appInfo.name,
        address: process.env.EMAIL,
      },
      to: userEmail,
      subject: 'Password Reset Link',
      html: `
                  <p>Reset your password by clicking the button below:</p>
                  <a href="${resetLink}" style="display: inline-block; padding: 10px 20px; font-size: 16px; color: #fff; background-color: #41afa5; text-decoration: none; border-radius: 5px;">Reset Password</a>
                  <p>If you did not request this, please ignore this email.</p>
              `,
    };

    transporter.sendMail(mailOptions, (err, info) => {
      if (err) {
        if (err.code === "EDNS") {
          req.flash('warning_msg', `Check your network connection!`);
          return res.redirect('back');
        }
        req.flash('error_msg', `Error from our server... could not send link`);
        return res.redirect('back');
      }

      req.flash('success_msg', `Check your inbox or spam in ${userEmail} to reset your password`);
      return res.redirect('/success'); 
    });
  } catch (error) {
    console.log(error);
    req.flash('error_msg', `Error while sending message`);
    res.redirect('/error');
  }
};



exports.resetHandler = async (req, res, next) => {

  const { token } = req.params;
  const decoded = verifyResetToken(token);
  if (!decoded) {
    req.flash('error_msg', `invalid token provided`)
    return res.redirect('/login')
  }
  
  return res.redirect(`/reset-password/${token}`)

}

exports.newPassword = async (req, res) => {
  const { token } = req.params;
  const { password, confirm } = req.body;
  const decoded = verifyResetToken(token);

  if (!decoded) {
    req.flash('error_msg', 'Invalid or expired token');
    return res.redirect('/');
  }

  if (password !== confirm) {
    req.flash('error_msg', 'Passwords do not match');
    return res.redirect(`/reset-password/${token}`);
  }

  const hashedPassword = bcrypt.hashSync(password, 10);
  try {
    await query('UPDATE "Users" SET "Password" = $1 WHERE email = $2', [hashedPassword, decoded.email])
    req.flash('success_msg', 'Password changed successfully');
    return res.redirect('/login');

  } catch (error) {
    console.log(error);
    req.flash('success_msg', `errorr form server: ${error.message}`);
    return res.redirect('/login');
  }
};



exports.deleteAccount = async (req, res) => {
  const { reason, Comments } = req.body;

  if (!reason && !Comments) {
    req.flash('error_msg', 'Please select an option');
    return res.redirect('back');
  }

  try {
    // Insert the deactivation reason and comment into the "deactivated" table
    await query('INSERT INTO "deactivated" (id, reason, comment) VALUES ($1, $2, $3)', [ uuidv4(), reason, Comments]);

    // Fetch the user
    const userResults = await query('SELECT * FROM "Users" WHERE id = $1', [req.user.id]);
    const user = userResults.rows[0];

    // Log out the user
    req.logout(async (err) => {
      if (err) {
        req.flash('error_msg', `Error logging out: ${err}`);
        return res.redirect('back');
      }

      // Delete the user from the "Users" table
      await query('DELETE FROM "Users" WHERE id = $1', [user.id]);

      // Destroy the session
      req.session.destroy((err) => {
        if (err) {
          req.flash('error_msg', `Error destroying session: ${err}`);
          return res.redirect('back');
        }

        res.redirect('/');
      });
    });
  } catch (error) {
    console.log(error);
    req.flash('error_msg', `Error from server: ${error}`);
    return res.redirect('back');
  }
};


