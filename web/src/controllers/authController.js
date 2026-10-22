const bcrypt = require('bcryptjs');
const db = require('../config/db');
const { logAuthEvent, getClientIp } = require('../middleware/auth');

exports.getLogin = (req, res) => {
  if (req.session.user) {
    if (req.session.user.role === 'manager') return res.redirect('/manager/dashboard');
    if (req.session.user.role === 'staff') return res.redirect('/staff/bookings');
    return res.redirect('/rooms');
  }
  res.render('auth/login', { title: 'Đăng Nhập - Khách Sạn Ánh Dương', error: null });
};

exports.postLogin = async (req, res) => {
  const { username, password } = req.body;
  const ip = getClientIp(req);

  try {
    const result = await db.query('SELECT * FROM users WHERE username = $1', [username]);
    if (result.rows.length === 0) {
      logAuthEvent('LOGIN_FAILED', ip, username, 'unknown_user');
      return res.status(401).render('auth/login', {
        title: 'Đăng Nhập',
        error: 'Tên đăng nhập hoặc mật khẩu không chính xác.'
      });
    }

    const user = result.rows[0];
    if (!user.is_active) {
      logAuthEvent('LOGIN_FAILED', ip, username, 'inactive');
      return res.status(403).render('auth/login', {
        title: 'Đăng Nhập',
        error: 'Tài khoản của bạn đã bị khóa hoặc chưa kích hoạt.'
      });
    }

    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) {
      logAuthEvent('LOGIN_FAILED', ip, username, 'wrong_password');
      return res.status(401).render('auth/login', {
        title: 'Đăng Nhập',
        error: 'Tên đăng nhập hoặc mật khẩu không chính xác.'
      });
    }

    // Success
    logAuthEvent('LOGIN_SUCCESS', ip, username);
    req.session.user = {
      id: user.id,
      username: user.username,
      full_name: user.full_name,
      role: user.role,
      email: user.email
    };

    const returnTo = req.session.returnTo;
    delete req.session.returnTo;

    if (returnTo) return res.redirect(returnTo);
    if (user.role === 'manager') return res.redirect('/manager/dashboard');
    if (user.role === 'staff') return res.redirect('/staff/bookings');
    return res.redirect('/rooms');
  } catch (err) {
    console.error('Error during login:', err);
    res.status(500).render('error', { title: 'Lỗi', status: 500, message: 'Lỗi máy chủ nội bộ' });
  }
};

exports.getRegister = (req, res) => {
  res.render('auth/register', { title: 'Đăng Ký Tài Khoản Khách Hàng', error: null });
};

exports.postRegister = async (req, res) => {
  const { username, email, password, full_name, phone } = req.body;
  if (!username || !email || !password || !full_name) {
    return res.status(400).render('auth/register', { title: 'Đăng Ký', error: 'Vui lòng điền đầy đủ các trường bắt buộc.' });
  }

  try {
    const existing = await db.query('SELECT id FROM users WHERE username = $1 OR email = $2', [username, email]);
    if (existing.rows.length > 0) {
      return res.status(400).render('auth/register', { title: 'Đăng Ký', error: 'Tên đăng nhập hoặc Email đã tồn tại trong hệ thống.' });
    }

    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(password, salt);

    await db.query(
      `INSERT INTO users (username, email, password_hash, full_name, phone, role, is_active)
       VALUES ($1, $2, $3, $4, $5, 'customer', true)`,
      [username, email, hash, full_name, phone || '']
    );

    res.redirect('/login?registered=1');
  } catch (err) {
    console.error('Error during registration:', err);
    res.status(500).render('error', { title: 'Lỗi', status: 500, message: 'Đăng ký không thành công' });
  }
};

exports.logout = (req, res) => {
  req.session.destroy(() => {
    res.redirect('/login');
  });
};
