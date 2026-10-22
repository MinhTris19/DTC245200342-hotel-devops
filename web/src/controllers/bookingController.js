const db = require('../config/db');

exports.getMyBookings = async (req, res) => {
  try {
    const userId = req.session.user.id;
    const query = `
      SELECT b.*, rt.name AS room_type_name, r.room_number,
             (b.check_out_date - b.check_in_date) AS nights
      FROM bookings b
      JOIN rooms r ON b.room_id = r.id
      JOIN room_types rt ON r.room_type_id = rt.id
      WHERE b.user_id = $1
      ORDER BY b.created_at DESC
    `;
    const result = await db.query(query, [userId]);
    res.render('customer/bookings', {
      title: 'Đặt Phòng Của Tôi',
      bookings: result.rows,
      success: req.query.success || null,
      error: req.query.error || null
    });
  } catch (err) {
    console.error('Error fetching bookings:', err);
    res.status(500).render('error', { title: 'Lỗi', status: 500, message: 'Không thể tải danh sách đặt phòng' });
  }
};

exports.getCreateBooking = async (req, res) => {
  const { room_type_id, check_in, check_out, guests } = req.query;
  try {
    const rtResult = await db.query('SELECT * FROM room_types WHERE id = $1 AND is_active = true', [room_type_id]);
    if (rtResult.rows.length === 0) {
      return res.status(404).render('error', { title: 'Không tìm thấy', status: 404, message: 'Loại phòng không tồn tại' });
    }
    res.render('customer/create_booking', {
      title: 'Xác Nhận Đặt Phòng',
      roomType: rtResult.rows[0],
      check_in: check_in || '',
      check_out: check_out || '',
      guests: guests || 1,
      error: null
    });
  } catch (err) {
    console.error(err);
    res.status(500).render('error', { title: 'Lỗi', status: 500, message: 'Lỗi tải trang đặt phòng' });
  }
};

exports.postCreateBooking = async (req, res) => {
  const { room_type_id, check_in, check_out, guests, note } = req.body;
  const userId = req.session.user.id;
  const numGuests = parseInt(guests, 10);

  const client = await db.pool.connect();
  try {
    // 1. Validation
    const inDate = new Date(check_in);
    const outDate = new Date(check_out);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (inDate < today) {
      return res.status(400).render('customer/create_booking', {
        title: 'Đặt Phòng Thất Bại',
        roomType: (await db.query('SELECT * FROM room_types WHERE id = $1', [room_type_id])).rows[0],
        check_in, check_out, guests,
        error: 'Ngày nhận phòng không được ở trong quá khứ.'
      });
    }

    if (outDate <= inDate) {
      return res.status(400).render('customer/create_booking', {
        title: 'Đặt Phòng Thất Bại',
        roomType: (await db.query('SELECT * FROM room_types WHERE id = $1', [room_type_id])).rows[0],
        check_in, check_out, guests,
        error: 'Ngày trả phòng phải sau ngày nhận phòng.'
      });
    }

    const nights = Math.ceil((outDate - inDate) / (1000 * 60 * 60 * 24));
    if (nights > 30) {
      return res.status(400).render('customer/create_booking', {
        title: 'Đặt Phòng Thất Bại',
        roomType: (await db.query('SELECT * FROM room_types WHERE id = $1', [room_type_id])).rows[0],
        check_in, check_out, guests,
        error: 'Thời gian đặt phòng tối đa là 30 đêm.'
      });
    }

    await client.query('BEGIN');

    // Check capacity
    const rtRes = await client.query('SELECT * FROM room_types WHERE id = $1 FOR SHARE', [room_type_id]);
    if (rtRes.rows.length === 0 || !rtRes.rows[0].is_active) {
      await client.query('ROLLBACK');
      return res.status(404).render('error', { title: 'Lỗi', status: 404, message: 'Loại phòng không khả dụng' });
    }
    const roomType = rtRes.rows[0];
    if (numGuests > roomType.capacity) {
      await client.query('ROLLBACK');
      return res.status(400).render('customer/create_booking', {
        title: 'Đặt Phòng Thất Bại',
        roomType, check_in, check_out, guests,
        error: `Số lượng khách (${numGuests}) vượt quá sức chứa tối đa (${roomType.capacity} người).`
      });
    }

    // Find available room with FOR UPDATE lock
    const availableRoomQuery = `
      SELECT r.id, r.room_number
      FROM rooms r
      WHERE r.room_type_id = $1 
        AND r.is_active = true 
        AND r.status != 'maintenance'
        AND r.id NOT IN (
          SELECT b.room_id FROM bookings b
          WHERE b.status IN ('pending', 'confirmed', 'checked_in')
            AND daterange(b.check_in_date, b.check_out_date, '[)') && daterange($2::date, $3::date, '[)')
        )
      FOR UPDATE OF r
      LIMIT 1
    `;
    const roomRes = await client.query(availableRoomQuery, [room_type_id, check_in, check_out]);

    if (roomRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(409).render('customer/create_booking', {
        title: 'Phòng Đã Hết',
        roomType, check_in, check_out, guests,
        error: 'Rất tiếc! Tất cả các phòng thuộc loại này đã được đặt trong khoảng ngày bạn chọn.'
      });
    }

    const room = roomRes.rows[0];
    const bookingCode = 'BK' + Date.now().toString().slice(-6) + Math.floor(100 + Math.random() * 900);
    const totalAmount = nights * parseFloat(roomType.base_price);

    await client.query(
      `INSERT INTO bookings (booking_code, user_id, room_id, check_in_date, check_out_date, guests, note, status, price_per_night, total_amount, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending', $8, $9, $10)`,
      [bookingCode, userId, room.id, check_in, check_out, numGuests, note || '', roomType.base_price, totalAmount, userId]
    );

    await client.query('COMMIT');
    res.redirect('/bookings?success=' + encodeURIComponent(`Đặt phòng thành công! Mã đơn: ${bookingCode}`));
  } catch (err) {
    await client.query('ROLLBACK');
    // Catch Postgres EXCLUDE constraint violation (code 23P01)
    if (err.code === '23P01') {
      return res.status(409).render('customer/create_booking', {
        title: 'Trùng Lịch Đặt Phòng',
        roomType: (await db.query('SELECT * FROM room_types WHERE id = $1', [room_type_id])).rows[0],
        check_in, check_out, guests,
        error: 'Phòng vừa được khách khác đặt trong cùng thời điểm. Vui lòng chọn ngày hoặc loại phòng khác.'
      });
    }
    console.error('Booking creation error:', err);
    res.status(500).render('error', { title: 'Lỗi', status: 500, message: 'Lỗi khi xử lý đặt phòng: ' + err.message });
  } finally {
    client.release();
  }
};

exports.cancelBooking = async (req, res) => {
  const bookingId = req.params.id;
  const userId = req.session.user.id;

  try {
    const bookingRes = await db.query('SELECT * FROM bookings WHERE id = $1', [bookingId]);
    if (bookingRes.rows.length === 0) {
      return res.status(404).render('error', { title: '404', status: 404, message: 'Đơn đặt phòng không tồn tại' });
    }

    const booking = bookingRes.rows[0];
    // Security check: cannot cancel other people's booking
    if (req.session.user.role === 'customer' && booking.user_id !== userId) {
      return res.status(403).render('error', { title: '403', status: 403, message: 'Bạn không có quyền hủy đơn đặt phòng này.' });
    }

    if (!['pending', 'confirmed'].includes(booking.status)) {
      return res.redirect('/bookings?error=' + encodeURIComponent('Không thể hủy đơn đặt phòng đã nhận hoặc đã kết thúc.'));
    }

    await db.query("UPDATE bookings SET status = 'cancelled' WHERE id = $1", [bookingId]);
    res.redirect('/bookings?success=' + encodeURIComponent('Hủy đơn đặt phòng thành công.'));
  } catch (err) {
    console.error(err);
    res.status(500).render('error', { title: 'Lỗi', status: 500, message: 'Lỗi khi hủy đặt phòng' });
  }
};
