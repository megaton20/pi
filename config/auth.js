

module.exports = {
  ensureAuthenticated: function(req, res, next) {

    if (req.isAuthenticated()) {
      return next();
    }
    req.flash("error_msg", "Please sign in to view our resources")
    res.redirect('/login')
    return
  },
  
  forwardAuthenticated: function(req, res, next) {
    
    if (req.isAuthenticated()) {
      req.flash("warning_msg", `You are already signed in!`)
      return res.redirect('/')
    }
    return next()

     
    }
};


