const db = require("../model/databaseTable");
const { promisify } = require("util");
const query = promisify(db.query).bind(db);


module.exports = {
    isUser: function(req, res, next){
  
      const userPosition = req.user.position;
      const userRole = req.user.userRole;
  
      if (userPosition === "Logistics") {
        req.flash('warning_msg', 'That is not your role stick to logistics');
        return res.redirect('/logistics');

      } else if (userPosition === "Attendant") {
        req.flash('warning_msg', 'That is not your role stick to attendant');
        return res.redirect('/employee');

      } else if (userRole === "user") {
        return next();
      } else if (userRole === "super") {
        req.flash('warning_msg', 'That is not your role stick to admin');
        return res.redirect('/super');
        
      }else if (userRole === "driver") {
        req.flash('warning_msg', `remember you're a driver ${req.user.First_name}`);
        // return res.redirect('/drivers');
        return next();
      }
    },

    userIsExclusive: async function(req, res, next){
  
        // Fetch user data
      const {rows: userData} = await query('SELECT * FROM "Users" WHERE "id" = $1', [req.user.id]);
      const exclusive = userData[0].is_exclusive;
  
      if (exclusive === true) {
        return next();
      }else {
        req.flash('warning_msg', `Access denied!... get new code`);
        return res.redirect('/users/exclusive-code-page');
      }
    },

    userIsAlreadyExclusive: async function(req, res, next){
  
      // Fetch user data
      const {rows: userData} = await query('SELECT * FROM "Users" WHERE "id" = $1', [req.user.id]);

    const exclusive = userData[0].is_exclusive;

    if (exclusive === false) {
      return next();
    }else {
      req.flash('warning_msg', `Already Exlusive!... see items`);
      return res.redirect('/user/exclusive/products');
    }
  }
      
  }