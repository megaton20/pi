const express = require('express');
const path = require('path')
const crypto = require('crypto');
const router = express.Router();
const axios = require('axios');
const nodemailer = require("nodemailer");
const { promisify } = require('util');
const db = require("../model/databaseTable");
const query = promisify(db.query).bind(db);
const passport = require('../config/passport');
const fs = require('fs')


const { ensureAuthenticated, forwardAuthenticated } = require('../config/auth');

const quoteService = require("../utils/dialyQuote");
const {streakCheck} = require('../utils/streak')

const {v4:uuidv4} = require('uuid')


const appInfo = require('../model/appinfo')



const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY ;
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET;



const FOOTBALL_NEWS_API = "https://example-football-news-api.com/news";

router.get('/auth/google/callback',
  passport.authenticate('google', { failureRedirect: '/login' }),
  async (req, res) => {

    try {
      // Parameterized query to prevent SQL injection
      const updateQuery = `UPDATE users SET updated_at = $1 WHERE "id" = $2`;

      // Execute the query with parameters
      await query(updateQuery, [new Date(), req.user.id]);
      streakCheck(req.user.id)
      res.redirect('/');
    } catch (error) {
      console.error('Error during user update:', error);

      // Determine the type of error and respond accordingly
      let errorMessage = 'An unexpected error occurred. Please try again later.';
      
      // Customize the error message based on the error type
      if (error.name === 'QueryFailedError') {
        errorMessage = 'Database error. Please contact support if this continues.';
      } else if (error.message.includes('network')) {
        errorMessage = 'Network error. Please check your connection and try again.';
      }

      return res.redirect('/login');
    }
  }
);



// porter
router.get('/', (req, res) => {
  if (!req.isAuthenticated()) {
      req.flash("error_msg", "Please log in to use our valuable resources");
      return res.redirect('/login');
  }
  
  const { user_role: role, position, fname } = req.user;

  if (req.session.greetings == true) {
    req.flash("success_msg", `Welcome back ${fname}`);
    req.session.greetings = false
    
  }


  switch (role) {
      case "super":
          return res.redirect("/super");
      case "admin":
          if (position === "Entry") return res.redirect("/gatekeeper");
          // if (position === "Attendant") return res.redirect("/employee");
          break;
      case "user":
          return res.redirect("/user");
      case "driver":
          return res.redirect("/drivers");
      case "vendor":
          return res.redirect("/vendor");
      default:
          req.flash("error_msg", "Unauthorized access");
          return res.redirect("/login");
  }
});


router.get('/auth/google/callback',
  passport.authenticate('google', { failureRedirect: '/login' }),
  async (req, res) => {

    try {
      // Parameterized query to prevent SQL injection
      const updateQuery = `
        UPDATE "Users"
        SET "previous_visit" = $1
        WHERE "id" = $2
      `;

      // Execute the query with parameters
      await query(updateQuery, [new Date(), req.user.id]);

      // Flash a success message and redirect
      req.flash("success_msg", `Welcome back ${req.user.First_name}!`);
      res.redirect('/handler');
    } catch (error) {
      console.error('Error during user update:', error);

      // Determine the type of error and respond accordingly
      let errorMessage = 'An unexpected error occurred. Please try again later.';
      
      // Customize the error message based on the error type
      if (error.name === 'QueryFailedError') {
        errorMessage = 'Database error. Please contact support if this continues.';
      } else if (error.message.includes('network')) {
        errorMessage = 'Network error. Please check your connection and try again.';
      }

      return res.render('login', {
        error_msg: errorMessage,
        pageTitle: `Login To continue Using ${appInfo}`,
      });
    }
  }
);




router.get('/success', async (req, res) => {


  try {

    // Render the landing page
    res.render('success', {
      pageTitle: `success to ${appInfo}`,
    });

  } catch (error) {
    console.error(`Error ${error}`);
    return res.redirect('/');
  }
});

router.get('/error', async (req, res) => {


  try {

    // Render the landing page
    res.render('error', {
      pageTitle: `error to ${appInfo}`,
    });

  } catch (error) {
    console.error(`Error ${error}`);
    return res.redirect('/');
  }
});



router.get('/login', forwardAuthenticated, (req, res) => res.render('login',{
  pageTitle:`Login To continue Using  ${appInfo} `,
}));

router.get('/register', forwardAuthenticated, (req, res) =>{

  const referrerCode = req.query.ref || null;

  if (referrerCode) {
    req.session.referrerCode = referrerCode
  }
  
  res.render('register',{
    pageTitle:`Create account with ${appInfo}`,
    referralCode:referrerCode,
  })
} 
);


router.get('/forget', forwardAuthenticated, (req, res) => res.render('forget-password',{
  pageTitle:`enter recovery email for  ${appInfo}`,
}));


router.get('/reset-password/', forwardAuthenticated, (req, res) => {

  req.flash("error_msg", `ENTER EMAIL FIRST`);
   return res.redirect('/forget')
  
});

router.get('/reset-password/:token', forwardAuthenticated, (req, res) => {
  const token = req.params.token
  if(!token){
    req.flash("error_msg", `ENTER EMAIL FIRST`);
   return res.redirect('/forget')
  }
  return res.render('reset-password', {
    token,
    pageTitle: "enter new password",
    appInfo,
  })
});
  
  // Route to fetch LGAs for a selected state
router.get("/getlgas/:state", (req, res) => {

  const { state } = req.params;
  const selectedState = stateData.find((s) => s.state === state);


  if (selectedState) {
    res.json(selectedState.lgas);
  } else {
    res.status(404).json({ error: "State not found" });
  }
});

// Logout route
router.get('/logout',ensureAuthenticated, (req, res) => {
  req.logout(err => {
    if (err) {
      return next(err);
    }
    req.flash('success_msg', 'You have logged out successfully.');
    res.redirect('/login');
  });
});





  module.exports = router;