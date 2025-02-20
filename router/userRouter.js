// routes/userRoute.js
const express = require('express');
const router = express.Router();
const { isUser,userIsExclusive,userIsAlreadyExclusive } = require('../config/isUser');


const userController = require('../controllers/userController');
const upload = require('../config/multerConfig'); 

// the journey
router.get('/', userController.feed);


// Mining Timer Reset Route
router.post('/reset-timer', userController.mine);

module.exports = router;

  router.get('/tasks',userController.task);
  router.post("/tasks/start", userController.performTask);
  router.post("/tasks/complete", userController.completeTask);
  
  
  router.get('/leaderboard',userController.leaderboard);


  router.get('/settings',userController.settings);
  router.get('/profile',userController.profile);
  
  router.get('/withdrawals', userController.withdrawals);
  router.get('/notifications', userController.notificationScreen);
  
  router.get('/change-password', userController.settingsPassword);


  router.get('/settings-privacy', userController.settingsPrivacy);
  
  router.get('/settings-help', userController.settingsHelp);

  router.get('/settings-policy', userController.settingsPolicy);
  
  
  
  

// notifications
router.get('/notifications/read-all', userController.readAllNotification);
router.get('/notifications/:id', userController.readNotification);
router.delete('/notifications/:id', userController.deleteNotification);



// de
router.get('/delete-account/',userController.deleteAccount)



module.exports = router;