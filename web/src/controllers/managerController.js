const db = require('../config/db');
const bcrypt = require('bcryptjs');

exports.getDashboard = async (req, res) => {
  try {
    // 1. KPI Today Revenue
    const revRes = await db.query(`
      SELECT COALESCE(SUM(amount_due), 0) AS revenue_today
      FROM payments
      WHERE DATE(paid_at) = CURRENT_DATE
    `);

    // 2. Occupancy rate today
    const occRes = await db.query(`
      SELECT 
        COUNT(id) FILTER (WHERE status = 'occupied') AS occupied_count,
        COUNT(id) FILTER (WHERE status != 'maintenance' AND is_active = true) AS total_usable_rooms
      FROM rooms
    `);
    const occupied = parseInt(occRes.rows[0].occupied_count, 10);
    const totalUsable = parseInt(occRes.rows[0].total_usable_rooms, 10);
    const occupancyRate = totalUsable > 0 ? Math.round((occupied / totalUsable) * 100) : 0;

    // 3. Check-ins & Check-outs today
    const checkCountRes = await db.query(`
      SELECT 
        COUNT(id) FILTER (WHERE DATE(checked_in_at) = CURRENT_DATE) AS checkin_today,
        COUNT(id) FILTER (WHERE DATE(checked_out_at) = CURRENT_DATE) AS checkout_today,
        COUNT(id) FILTER (WHERE check_in_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '7 days' AND status IN ('pending', 'confirmed')) AS upcoming_7days
      FROM bookings
    `);

    // 4. Top Booked Room Types
    const topRoomsRes = await db.query(`
      SELECT rt.name, COUNT(b.id) AS booking_count
      FROM room_types rt
      JOIN rooms r ON r.room_type_id = rt.id
      JOIN bookings b ON b.room_id = r.id
      GROUP BY rt.id, rt.name
      ORDER BY booking_count DESC
      LIMIT 5
    `);

    // 5. Top Services
    const topServicesRes = await db.query(`
      SELECT s.name, COALESCE(SUM(bs.quantity), 0) AS total_used, COALESCE(SUM(bs.quantity * bs.unit_price), 0) AS total_revenue
      FROM services s
      LEFT JOIN booking_services bs ON bs.service_id = s.id
      GROUP BY s.id, s.name
      ORDER BY total_used DESC
      LIMIT 5
    `);

    // 6. Recent 7 days revenue for chart
    const dailyRevRes = await db.query(`
      SELECT TO_CHAR(d.day, 'DD/MM') AS date_label,
             COALESCE(SUM(p.amount_due), 0) AS total
      FROM generate_series(CURRENT_DATE - INTERVAL '6 days', CURRENT_DATE, '1 day'::interval) d(day)
      LEFT JOIN payments p ON DATE(p.paid_at) = DATE(d.day)
      GROUP BY d.day
      ORDER BY d.day ASC
    `);

    res.render('manager/dashboard', {
      title: 'Báo Cáo & Dashboard Quản Lý',
      revenueToday: revRes.rows[0].revenue_today,
      occupiedRooms: occupied,
      totalUsableRooms: totalUsable,
      occupancyRate,
      checkinToday: checkCountRes.rows[0].checkin_today,
      checkoutToday: checkCountRes.rows[0].checkout_today,
      upcoming7days: checkCountRes.rows[0].upcoming_7days,
      topRooms: topRoomsRes.rows,
      topServices: topServicesRes.rows,
      dailyRevenue: dailyRevRes.rows
    });
  } catch (err) {
    console.error(err);
    res.status(500).render('error', { title: 'Lỗi', status: 500, message: 'Lỗi tải dashboard KPI' });
  }
};

// CRUD Room Types
exports.getRoomTypes = async (req, res) => {
  const result = await db.query('SELECT * FROM room_types ORDER BY id ASC');
  res.render('manager/room_types', {
    title: 'Quản Lý Hạng Phòng',
    roomTypes: result.rows,
    success: req.query.success || null,
    error: req.query.error || null
  });
};

exports.postCreateRoomType = async (req, res) => {
  const { name, description, base_price, capacity, amenities } = req.body;
  let imagePath = '/images/rooms/standard.svg';
  if (req.file) {
    imagePath = '/uploads/' + req.file.filename;
  }

  try {
    await db.query(
      `INSERT INTO room_types (name, description, base_price, capacity, amenities, image_path, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, true)`,
      [name, description, base_price, capacity, amenities, imagePath]
    );
    res.redirect('/manager/room-types?success=Tạo loại phòng mới thành công');
  } catch (err) {
    console.error(err);
    res.redirect('/manager/room-types?error=' + encodeURIComponent('Lỗi tạo loại phòng: ' + err.message));
  }
};

// CRUD Rooms
exports.getRooms = async (req, res) => {
  const rooms = await db.query('SELECT r.*, rt.name as room_type_name FROM rooms r JOIN room_types rt ON r.room_type_id = rt.id ORDER BY r.floor, r.room_number');
  const roomTypes = await db.query('SELECT * FROM room_types WHERE is_active = true');
  res.render('manager/rooms', {
    title: 'Quản Lý Phòng Khách Sạn',
    rooms: rooms.rows,
    roomTypes: roomTypes.rows,
    success: req.query.success || null,
    error: req.query.error || null
  });
};

exports.postCreateRoom = async (req, res) => {
  const { room_number, room_type_id, floor } = req.body;
  try {
    await db.query(
      "INSERT INTO rooms (room_number, room_type_id, floor, status, is_active) VALUES ($1, $2, $3, 'available', true)",
      [room_number, room_type_id, floor]
    );
    res.redirect('/manager/rooms?success=Thêm phòng mới thành công');
  } catch (err) {
    console.error(err);
    res.redirect('/manager/rooms?error=' + encodeURIComponent('Lỗi thêm phòng: ' + err.message));
  }
};

exports.postToggleMaintenance = async (req, res) => {
  const { id } = req.params;
  try {
    const r = await db.query('SELECT status FROM rooms WHERE id = $1', [id]);
    const newStatus = r.rows[0].status === 'maintenance' ? 'available' : 'maintenance';
    await db.query('UPDATE rooms SET status = $1 WHERE id = $2', [newStatus, id]);
    res.redirect('/manager/rooms?success=Đã chuyển đổi trạng thái bảo trì.');
  } catch (err) {
    console.error(err);
    res.redirect('/manager/rooms?error=Lỗi cập nhật trạng thái');
  }
};

// Staff management
exports.getStaff = async (req, res) => {
  const staff = await db.query("SELECT id, username, email, full_name, phone, role, is_active FROM users WHERE role IN ('staff', 'manager') ORDER BY id ASC");
  res.render('manager/staff', {
    title: 'Quản Lý Nhân Viên',
    staffList: staff.rows,
    currentUserId: req.session.user.id,
    success: req.query.success || null,
    error: req.query.error || null
  });
};

exports.postCreateStaff = async (req, res) => {
  const { username, email, password, full_name, phone, role } = req.body;
  try {
    const hash = await bcrypt.hash(password, 10);
    await db.query(
      `INSERT INTO users (username, email, password_hash, full_name, phone, role, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, true)`,
      [username, email, hash, full_name, phone || '', role]
    );
    res.redirect('/manager/staff?success=Tạo tài khoản nhân viên thành công');
  } catch (err) {
    console.error(err);
    res.redirect('/manager/staff?error=' + encodeURIComponent(err.message));
  }
};

exports.postToggleLockStaff = async (req, res) => {
  const { id } = req.params;
  const targetId = parseInt(id, 10);
  if (targetId === req.session.user.id) {
    return res.redirect('/manager/staff?error=Bạn không thể tự khóa tài khoản của chính mình.');
  }
  try {
    await db.query('UPDATE users SET is_active = NOT is_active WHERE id = $1', [targetId]);
    res.redirect('/manager/staff?success=Cập nhật trạng thái tài khoản thành công.');
  } catch (err) {
    console.error(err);
    res.redirect('/manager/staff?error=Lỗi cập nhật tài khoản');
  }
};
