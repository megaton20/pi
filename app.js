const express = require('express');
const app = express();
const path = require('path');
const bodyParser = require('body-parser');
const session = require('express-session');
const flash = require('connect-flash');
const passport = require('./config/passport');
const methodOverride = require('method-override');
const ejsLayouts = require('express-ejs-layouts');
const updateWatch = require('./utils/updateAction');
const cors = require('cors');
const RedisStore = require('connect-redis').default;
const { createClient } = require('redis');

// Create and connect Redis client only in production
let redisClient = null;
if (process.env.NODE_ENV === 'esr') {
  redisClient = createClient();
  redisClient.on('error', (err) => console.log('Redis Client Error', err));

  // Connect Redis client asynchronously
  (async () => {
    await redisClient.connect();
    console.log('Connected to Redis');
  })();
}

const appName = "True Essentials Mart";

if (process.env.NODE_ENV !== 'production') {
  require('dotenv').config();
  console.log('using local env...');
}

const { ensureAuthenticatedEmail, ensureAuthenticatedPhone,ensureBasicInformation } = require('./config/userAccessCheck');
const { ensureAuthenticated } = require("./config/auth");


const openRoutes = require('./router/index');
const authRouter = require('./router/auth');
const userRouter = require('./router/userRouter');
// const superRouter = require('./router/superRouter');

// Middleware
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(cors());

// Set up EJS view engine and public folder
app.set('view engine', 'ejs');
app.use(ejsLayouts);
app.use(express.static(path.join(__dirname, './', 'public')));


// Configure session middleware with Redis store (only in production)
if (redisClient) {
  app.use(session({
    store: new RedisStore({ client: redisClient }),
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: true,
    cookie: { maxAge: 24 * 60 * 60 * 1000 }
  }));
} else {
  app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: true,
    cookie: { maxAge: 24 * 60 * 60 * 1000 },
    secure: false,
  }));
}

// Initialize passport after session middleware
app.use(passport.initialize());
app.use(passport.session());

// Flash messages setup
app.use(flash());
app.use((req, res, next) => {
  res.locals.success_msg = req.flash('success_msg');
  res.locals.warning_msg = req.flash('warning_msg');
  res.locals.error_msg = req.flash('error_msg');
  res.locals.error = req.flash('error');
  // res.locals.msg = req.flash('msg');
  next();
});


app.use(methodOverride((req, res) => {
  if (req.body && typeof req.body === 'object' && '_method' in req.body) {
      let method = req.body._method;
      delete req.body._method;
      return method;
  }
}));


// Routes
app.use('/', openRoutes); // open less secure routes
app.use('/auth', authRouter); // authentication
app.use('/user',ensureAuthenticated, userRouter); // customer platform
// app.use('/super', superRouter); // general overseers


// Handle when the user clicks "Later" or visits the Black Friday page
app.post('/dismiss-modal', (req, res) => {
  req.session.blackFridayShown = true;
  res.redirect('/');
});



// 404 Error handler for undefined routes
app.use((req, res) => {
  let userActive = req.user ? true : false;
  res.render('404', {
    pageTitle: `${appName} 404`,
    appName,
    userActive
  });
});

// General error handling middleware
app.use((err, req, res, next) => {
  console.log(err);
  let userActive = req.user ? true : false;
  res.redirect('/error')
});

// Start server

if (process.env.NODE_ENV === 'production2') {
  app.listen();
  console.log(`app is public`);
}else{
  const PORT = process.env.PORT;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

}