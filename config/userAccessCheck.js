const db = require("../model/databaseTable");
const { promisify } = require('util');
const query = promisify(db.query).bind(db);

const fetchUserQuery = 'SELECT * FROM "Users" WHERE id = $1'; 
const fetchDriverQuery = 'SELECT * FROM "drivers" WHERE "user_id" = $1'; 

module.exports = {
  ensureBasicInformation: async (req, res, next) => {
    const userId = req.user.id;
    try {
      const { rows } = await query(fetchUserQuery, [userId]);
      const userData = rows[0];
      
      if (!(userData.Address && userData.state && userData.lga && userData.land_mark)) {
        req.flash("error_msg", "Complete your form registration");
        return res.redirect(`/user/edit-user/${userId}`);
      }
      return next();
    } catch (error) {
      req.flash('error_msg', `Error: ${error.message}`);
      return res.redirect('/');
    }
  },

  ensureAuthenticatedEmail: async (req, res, next) => {
    const userId = req.user.id;
    try {
      const { rows } = await query(fetchUserQuery, [userId]);
      const userData = rows[0];

      if (userData.verify_email == 0) {
        req.flash("error_msg", "Please verify your email to complete request!");
        return res.redirect('/user/user-details');
      }
      return next();
    } catch (error) {
      req.flash('error_msg', `Error: ${error.message}`);
      return res.redirect('/');
    }
  },

  ensureAuthenticatedPhone: async (req, res, next) => {
    const userId = req.user.id;
    try {
      const { rows } = await query(fetchUserQuery, [userId]);
      const userData = rows[0];


      if (userData.Phone == null) {
        req.flash("error_msg", "Please Enter a contact phone to checkout!");
        return res.redirect('/user/add-phone');
      }
      // if (userData.verify_phone == 0) {
      //   req.flash("error_msg", "Please verify your phone number to complete request!");
      //   return res.redirect('back');
      // }
      return next();
    } catch (error) {
      req.flash('error_msg', `Error: ${error.message}`);
      return res.redirect('/');
    }
  },

  ensureDriverKYC: async (req, res, next) => {
    const userId = req.user.id;
    try {
      // Fetch user data
      const { rows: user } = await query(fetchDriverQuery, [userId]);
  
      // Check if user exists
      if (!user || user.length === 0) {
        req.flash("warning_msg", "User not a yet a driver. Please register to proceed.");
        return res.redirect('/user'); 
      }
  
      const userData = user[0];
  
      // Check if CAC is provided and complete
      const hasCAC = userData.CAC_number && userData.CAC_image;
  
      // Check if at least one of the personal IDs is provided and complete
      const hasNIN = userData.nation_id_number && userData.NIN_image;
      const hasPassport = userData.passport_number && userData.passport_image;
      const hasVoter = userData.voter_number && userData.voter_image;
  
      // If CAC is not complete or none of the personal IDs is complete, redirect to KYC
      if (!(hasCAC && (hasNIN || hasPassport || hasVoter))) {
        req.flash("warning_msg", "Please complete your KYC registration (CAC is mandatory)!");
        return res.redirect('/drivers/KYC');
      }
  
      // If CAC is complete and at least one personal ID is provided, proceed
      return next();
  
    } catch (error) {
      console.log("middleware error: " + error);
      req.flash('error_msg', `Error: ${error.message}`);
      return res.redirect('/');
    }
  }
  
};

