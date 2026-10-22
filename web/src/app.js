const express = require('express');
const session = require('express-session');
const cookieParser = require('cookie-parser');
const path = require('path');
const routes = require('./routes');
const csrfProtection = require('./middleware/csrf');

const app = express();
const PORT = process.env.PORT || 3000;

// View engine
app.set('views', path.join(__dirname, '../views'));
app.set('view engine', 'ejs');

// Trust proxy for secure cookies behind reverse proxy and correct IP extraction
app.set('trust proxy', 1);

// Static files
app.use(express.static(path.join(__dirname, '../public')));
app.use('/uploads', express.static(path.join(__dirname, '../public/uploads')));

// Parsing
app.use(express.urlencoded({ extended: true, limit: '2mb' }));
app.use(express.json({ limit: '2mb' }));
app.use(cookieParser());

// Sessions
app.use(session({
  name: 'hotel_session',
  secret: process.env.SESSION_SECRET || 'hotel_super_secret_session_2026',
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: 'strict',
    secure: process.env.NODE_ENV === 'production' && process.env.COOKIE_SECURE === 'true',
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));

// CSRF Protection & Global locals
app.use(csrfProtection);
app.use((req, res, next) => {
  res.locals.user = req.session.user || null;
  res.locals.currentPath = req.path;
  next();
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).send('OK');
});

// Routes
app.use('/', routes);

// 404 handler
app.use((req, res) => {
  res.status(404).render('error', {
    title: '404 - Không Tìm Thấy Trang',
    status: 404,
    message: 'Trang hoặc tài nguyên bạn yêu cầu không tồn tại trên hệ thống.'
  });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Unhandled Application Error:', err);
  res.status(500).render('error', {
    title: '500 - Lỗi Máy Chủ',
    status: 500,
    message: 'Hệ thống gặp sự cố xử lý yêu cầu. Vui lòng thử lại sau.'
  });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Hotel Booking Web Application is running on port ${PORT}`);
});
