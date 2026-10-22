// Authentication & RBAC Middleware + Security Logging
function logAuthEvent(event, ip, user, reason = '') {
  if (event === 'LOGIN_SUCCESS') {
    console.log(`LOGIN_SUCCESS ip=${ip} user=${user}`);
  } else if (event === 'LOGIN_FAILED') {
    console.log(`LOGIN_FAILED ip=${ip} user=${user} reason=${reason}`);
  }
}

function getClientIp(req) {
  const xForwardedFor = req.headers['x-forwarded-for'];
  if (xForwardedFor) {
    return xForwardedFor.split(',')[0].trim();
  }
  return req.socket.remoteAddress || '127.0.0.1';
}

function requireAuth(req, res, next) {
  if (!req.session || !req.session.user) {
    req.session.returnTo = req.originalUrl;
    return res.redirect('/login');
  }
  next();
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.session || !req.session.user) {
      return res.redirect('/login');
    }
    const userRole = req.session.user.role;
    // manager inherits staff permissions
    if (roles.includes(userRole) || (userRole === 'manager' && roles.includes('staff'))) {
      return next();
    }
    return res.status(403).render('error', {
      title: '403 - Cấm Truy Cập',
      status: 403,
      message: 'Bạn không có quyền truy cập vào chức năng hoặc tài nguyên này.'
    });
  };
}

module.exports = {
  logAuthEvent,
  getClientIp,
  requireAuth,
  requireRole
};
