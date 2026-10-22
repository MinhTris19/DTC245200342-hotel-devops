const db = require('../config/db');

exports.getBookings = async (req, res) => {
  try {
    const { status, date } = req.query;
    let sql = `
      SELECT b.*, u.full_name AS customer_name, u.phone AS customer_phone,
             r.room_number, rt.name AS room_type_name
      FROM bookings b
      JOIN users u ON b.user_id = u.id
      JOIN rooms r ON b.room_id = r.id
      JOIN room_types rt ON r.room_type_id = rt.id
      WHERE 1=1
    `;
    const params = [];
    if (status) {
      params.push(status);
      sql += ` AND b.status = $${params.length}`;
    }
    if (date) {
      params.push(date);
      sql += ` AND $${params.length} BETWEEN b.check_in_date AND b.check_out_date`;
    }
    sql += ` ORDER BY b.created_at DESC`;

    const result = await db.query(sql, params);
    const rooms = await db.query('SELECT r.*, rt.name as room_type_name FROM rooms r JOIN room_types rt ON r.room_type_id = rt.id ORDER BY r.floor, r.room_number');

    res.render('staff/bookings', {
      title: 'Quản Lý Đặt Phòng - Lễ Tân',
      bookings: result.rows,
      rooms: rooms.rows,
      filters: { status: status || '', date: date || '' },
      success: req.query.success || null,
      error: req.query.error || null
    });
  } catch (err) {
    console.error(err);
    res.status(500).render('error', { title: 'Lỗi', status: 500, message: 'Lỗi tải danh sách lễ tân' });
  }
};

exports.confirmBooking = async (req, res) => {
  const { id } = req.params;
  try {
    await db.query("UPDATE bookings SET status = 'confirmed' WHERE id = $1 AND status = 'pending'", [id]);
    res.redirect('/staff/bookings?success=' + encodeURIComponent('Đã xác nhận đặt phòng.'));
  } catch (err) {
    console.error(err);
    res.redirect('/staff/bookings?error=' + encodeURIComponent('Lỗi xác nhận đặt phòng.'));
  }
};

exports.checkIn = async (req, res) => {
  const { id } = req.params;
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    const bRes = await client.query('SELECT * FROM bookings WHERE id = $1 FOR UPDATE', [id]);
    if (bRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).render('error', { title: '404', status: 404, message: 'Đơn không tồn tại' });
    }
    const booking = bRes.rows[0];

    if (booking.status !== 'confirmed' && booking.status !== 'pending') {
      await client.query('ROLLBACK');
      return res.redirect('/staff/bookings?error=' + encodeURIComponent('Chỉ có thể check-in đơn ở trạng thái Pending hoặc Confirmed.'));
    }

    await client.query("UPDATE bookings SET status = 'checked_in', checked_in_at = CURRENT_TIMESTAMP WHERE id = $1", [id]);
    await client.query("UPDATE rooms SET status = 'occupied' WHERE id = $1", [booking.room_id]);

    await client.query('COMMIT');
    res.redirect('/staff/bookings/' + id + '/details?success=' + encodeURIComponent('Check-in thành công! Phòng đã chuyển sang trạng thái Occupied.'));
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.redirect('/staff/bookings?error=' + encodeURIComponent('Lỗi check-in: ' + err.message));
  } finally {
    client.release();
  }
};

exports.getBookingDetails = async (req, res) => {
  const { id } = req.params;
  try {
    const bRes = await db.query(`
      SELECT b.*, u.full_name, u.phone, u.email,
             r.room_number, r.status AS room_current_status,
             rt.name AS room_type_name,
             (b.check_out_date - b.check_in_date) AS nights
      FROM bookings b
      JOIN users u ON b.user_id = u.id
      JOIN rooms r ON b.room_id = r.id
      JOIN room_types rt ON r.room_type_id = rt.id
      WHERE b.id = $1
    `, [id]);

    if (bRes.rows.length === 0) {
      return res.status(404).render('error', { title: '404', status: 404, message: 'Không tìm thấy đơn' });
    }

    const servicesRes = await db.query(`
      SELECT bs.*, s.name
      FROM booking_services bs
      JOIN services s ON bs.service_id = s.id
      WHERE bs.booking_id = $1
    `, [id]);

    const allServicesRes = await db.query('SELECT * FROM services WHERE is_available = true ORDER BY name');
    const paymentRes = await db.query('SELECT * FROM payments WHERE booking_id = $1', [id]);

    res.render('staff/booking_details', {
      title: `Chi Tiết Đơn Đặt Phòng #${bRes.rows[0].booking_code}`,
      booking: bRes.rows[0],
      bookingServices: servicesRes.rows,
      availableServices: allServicesRes.rows,
      payment: paymentRes.rows[0] || null,
      success: req.query.success || null,
      error: req.query.error || null
    });
  } catch (err) {
    console.error(err);
    res.status(500).render('error', { title: 'Lỗi', status: 500, message: 'Lỗi tải chi tiết đơn' });
  }
};

exports.addService = async (req, res) => {
  const { id } = req.params;
  const { service_id, quantity } = req.body;
  const qty = parseInt(quantity, 10) || 1;

  try {
    const sRes = await db.query('SELECT * FROM services WHERE id = $1', [service_id]);
    if (sRes.rows.length === 0) return res.redirect(`/staff/bookings/${id}/details?error=Dịch vụ không tồn tại`);

    await db.query(
      `INSERT INTO booking_services (booking_id, service_id, quantity, unit_price)
       VALUES ($1, $2, $3, $4)`,
      [id, service_id, qty, sRes.rows[0].price]
    );

    res.redirect(`/staff/bookings/${id}/details?success=Đã thêm dịch vụ phát sinh.`);
  } catch (err) {
    console.error(err);
    res.redirect(`/staff/bookings/${id}/details?error=Lỗi thêm dịch vụ`);
  }
};

exports.removeService = async (req, res) => {
  const { id, serviceId } = req.params;
  try {
    await db.query('DELETE FROM booking_services WHERE id = $1 AND booking_id = $2', [serviceId, id]);
    res.redirect(`/staff/bookings/${id}/details?success=Đã hủy dịch vụ phát sinh.`);
  } catch (err) {
    console.error(err);
    res.redirect(`/staff/bookings/${id}/details?error=Lỗi xóa dịch vụ`);
  }
};

exports.checkOut = async (req, res) => {
  const { id } = req.params;
  const { method, amount_paid } = req.body;
  const staffId = req.session.user.id;

  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    const bRes = await client.query('SELECT * FROM bookings WHERE id = $1 FOR UPDATE', [id]);
    if (bRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).render('error', { title: '404', status: 404, message: 'Không tìm thấy đơn' });
    }
    const booking = bRes.rows[0];

    // Calculate total services
    const sRes = await client.query('SELECT COALESCE(SUM(quantity * unit_price), 0) AS total_services FROM booking_services WHERE booking_id = $1', [id]);
    const totalServices = parseFloat(sRes.rows[0].total_services);
    const roomCost = parseFloat(booking.total_amount); // room price * nights
    const totalDue = roomCost + totalServices;

    const paid = parseFloat(amount_paid);
    if (isNaN(paid) || paid < totalDue) {
      await client.query('ROLLBACK');
      return res.redirect(`/staff/bookings/${id}/details?error=` + encodeURIComponent(`Số tiền khách đưa không đủ. Tổng cần thanh toán: ${totalDue.toLocaleString('vi-VN')} VND.`));
    }

    const change = paid - totalDue;

    // Insert payment record
    await client.query(
      `INSERT INTO payments (booking_id, method, amount_due, amount_paid, change_amount, received_by)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [id, method, totalDue, paid, change, staffId]
    );

    // Update booking to checked_out and set room to cleaning
    await client.query("UPDATE bookings SET status = 'checked_out', checked_out_at = CURRENT_TIMESTAMP WHERE id = $1", [id]);
    await client.query("UPDATE rooms SET status = 'cleaning' WHERE id = $1", [booking.room_id]);

    await client.query('COMMIT');
    res.redirect(`/staff/bookings/${id}/invoice`);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.redirect(`/staff/bookings/${id}/details?error=` + encodeURIComponent('Lỗi thanh toán: ' + err.message));
  } finally {
    client.release();
  }
};

exports.getInvoice = async (req, res) => {
  const { id } = req.params;
  try {
    const bRes = await db.query(`
      SELECT b.*, u.full_name, u.phone, u.email,
             r.room_number, rt.name AS room_type_name,
             (b.check_out_date - b.check_in_date) AS nights
      FROM bookings b
      JOIN users u ON b.user_id = u.id
      JOIN rooms r ON b.room_id = r.id
      JOIN room_types rt ON r.room_type_id = rt.id
      WHERE b.id = $1
    `, [id]);

    const sRes = await db.query(`
      SELECT bs.*, s.name
      FROM booking_services bs
      JOIN services s ON bs.service_id = s.id
      WHERE bs.booking_id = $1
    `, [id]);

    const pRes = await db.query('SELECT * FROM payments WHERE booking_id = $1', [id]);

    res.render('staff/invoice', {
      title: 'Hóa Đơn Thanh Toán Khách Sạn',
      booking: bRes.rows[0],
      services: sRes.rows,
      payment: pRes.rows[0]
    });
  } catch (err) {
    console.error(err);
    res.status(500).render('error', { title: 'Lỗi', status: 500, message: 'Lỗi tải hóa đơn' });
  }
};

exports.markRoomCleaned = async (req, res) => {
  const { roomId } = req.body;
  try {
    await db.query("UPDATE rooms SET status = 'available' WHERE id = $1 AND status = 'cleaning'", [roomId]);
    res.redirect('/staff/bookings?success=' + encodeURIComponent('Phòng đã được dọn xong và sẵn sàng đón khách mới!'));
  } catch (err) {
    console.error(err);
    res.redirect('/staff/bookings?error=Lỗi cập nhật trạng thái phòng');
  }
};
