const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const roomController = require('../controllers/roomController');
const bookingController = require('../controllers/bookingController');
const staffController = require('../controllers/staffController');
const managerController = require('../controllers/managerController');
const { requireAuth, requireRole } = require('../middleware/auth');
const upload = require('../middleware/upload');

// Public routes
router.get('/', roomController.getIndex);
router.get('/rooms', roomController.getIndex);
router.get('/search', roomController.searchRooms);

// Auth routes
router.get('/login', authController.getLogin);
router.post('/login', authController.postLogin);
router.get('/register', authController.getRegister);
router.post('/register', authController.postRegister);
router.get('/logout', authController.logout);

// Customer bookings
router.get('/bookings', requireAuth, bookingController.getMyBookings);
router.get('/bookings/create', requireAuth, bookingController.getCreateBooking);
router.post('/bookings/create', requireAuth, bookingController.postCreateBooking);
router.post('/bookings/:id/cancel', requireAuth, bookingController.cancelBooking);

// Staff routes
router.get('/staff/bookings', requireRole('staff'), staffController.getBookings);
router.post('/staff/bookings/:id/confirm', requireRole('staff'), staffController.confirmBooking);
router.post('/staff/bookings/:id/checkin', requireRole('staff'), staffController.checkIn);
router.get('/staff/bookings/:id/details', requireRole('staff'), staffController.getBookingDetails);
router.post('/staff/bookings/:id/services', requireRole('staff'), staffController.addService);
router.post('/staff/bookings/:id/services/:serviceId/delete', requireRole('staff'), staffController.removeService);
router.post('/staff/bookings/:id/checkout', requireRole('staff'), staffController.checkOut);
router.get('/staff/bookings/:id/invoice', requireRole('staff'), staffController.getInvoice);
router.post('/staff/rooms/cleaned', requireRole('staff'), staffController.markRoomCleaned);

// Manager routes
router.get('/manager/dashboard', requireRole('manager'), managerController.getDashboard);
router.get('/manager/room-types', requireRole('manager'), managerController.getRoomTypes);
router.post('/manager/room-types', requireRole('manager'), (req, res, next) => {
  upload.single('image')(req, res, (err) => {
    if (err) {
      return res.redirect('/manager/room-types?error=' + encodeURIComponent(err.message));
    }
    next();
  });
}, managerController.postCreateRoomType);

router.get('/manager/rooms', requireRole('manager'), managerController.getRooms);
router.post('/manager/rooms', requireRole('manager'), managerController.postCreateRoom);
router.post('/manager/rooms/:id/toggle-maintenance', requireRole('manager'), managerController.postToggleMaintenance);

router.get('/manager/staff', requireRole('manager'), managerController.getStaff);
router.post('/manager/staff', requireRole('manager'), managerController.postCreateStaff);
router.post('/manager/staff/:id/toggle-lock', requireRole('manager'), managerController.postToggleLockStaff);

module.exports = router;
