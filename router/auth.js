const express = require("express");
const router = express.Router();
const authController = require("../controllers/authcontroller");
const { isUser } = require("../config/isUser");
const { ensureAuthenticated,forwardAuthenticated } = require("../config/auth");

const passport = require('../config/passport');





router.post('/register',forwardAuthenticated, authController.registerHandler)
router.post('/login',forwardAuthenticated, authController.loginHandler)


router.post('/verify-request',ensureAuthenticated,authController.verifyEmailRequest);
router.get('/verify-email',ensureAuthenticated,authController.verifyEmailCallBack);


router.get('/google', (req, res, next) => {
    // If a referral code is present, include it in the state parameter
    const referralCode = req.session.referrerCode ? req.session.referrerCode : '';
    passport.authenticate('google', {
      scope: ['profile', 'email'],
      state: referralCode 
    })(req, res, next);
});




router.post('/forget',forwardAuthenticated, authController.resetRequest)
router.get('/reset-password/:token',forwardAuthenticated,authController.resetHandler)

router.post('/reset-password/:token',forwardAuthenticated,authController.newPassword);



router.post('/delete-account',ensureAuthenticated, authController.deleteAccount)
module.exports = router;
