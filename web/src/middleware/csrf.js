const crypto = require('crypto');

function csrfProtection(req, res, next) {
  if (!req.session.csrfToken) {
    req.session.csrfToken = crypto.randomBytes(24).toString('hex');
  }
  res.locals.csrfToken = req.session.csrfToken;

  // Protect state-changing HTTP methods
  if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(req.method)) {
    const token = req.body?._csrf || req.query?._csrf || req.headers['x-csrf-token'];
    if (!token || token !== req.session.csrfToken) {
      return res.status(403).render('error', {
        title: '403 - Lỗi Xác Thực Bảo Mật (CSRF)',
        status: 403,
        message: 'Yêu cầu không hợp lệ do thiếu hoặc sai mã bảo mật CSRF token. Vui lòng tải lại trang và thử lại.'
      });
    }
  }
  next();
}

module.exports = csrfProtection;
