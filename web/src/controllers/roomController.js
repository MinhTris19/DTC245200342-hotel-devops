const db = require('../config/db');

exports.getIndex = async (req, res) => {
  try {
    const roomTypes = await db.query('SELECT * FROM room_types WHERE is_active = true ORDER BY base_price ASC');
    res.render('rooms/index', {
      title: 'Hệ Thống Đặt Phòng Khách Sạn Ánh Dương',
      roomTypes: roomTypes.rows,
      query: {}
    });
  } catch (err) {
    console.error('Error fetching room types:', err);
    res.status(500).render('error', { title: 'Lỗi', status: 500, message: 'Không thể tải danh sách loại phòng' });
  }
};

exports.searchRooms = async (req, res) => {
  const { check_in, check_out, guests, sort, room_type_id } = req.query;

  try {
    let checkInDate = check_in;
    let checkOutDate = check_out;
    const numGuests = parseInt(guests, 10) || 1;

    let availableQuery = `
      SELECT rt.*, 
        COUNT(r.id) AS total_rooms,
        COUNT(r.id) FILTER (
          WHERE r.id NOT IN (
            SELECT b.room_id FROM bookings b
            WHERE b.status IN ('pending', 'confirmed', 'checked_in')
              AND daterange(b.check_in_date, b.check_out_date, '[)') && daterange($1::date, $2::date, '[)')
          )
        ) AS available_rooms
      FROM room_types rt
      JOIN rooms r ON r.room_type_id = rt.id AND r.is_active = true AND r.status != 'maintenance'
      WHERE rt.is_active = true AND rt.capacity >= $3
    `;
    const params = [checkInDate || '2000-01-01', checkOutDate || '2000-01-02', numGuests];

    if (room_type_id) {
      params.push(room_type_id);
      availableQuery += ` AND rt.id = $${params.length}`;
    }

    availableQuery += ` GROUP BY rt.id`;

    if (checkInDate && checkOutDate) {
      availableQuery += ` HAVING COUNT(r.id) FILTER (
        WHERE r.id NOT IN (
          SELECT b.room_id FROM bookings b
          WHERE b.status IN ('pending', 'confirmed', 'checked_in')
            AND daterange(b.check_in_date, b.check_out_date, '[)') && daterange($1::date, $2::date, '[)')
        )
      ) > 0`;
    }

    if (sort === 'price_asc') availableQuery += ` ORDER BY rt.base_price ASC`;
    else if (sort === 'price_desc') availableQuery += ` ORDER BY rt.base_price DESC`;
    else availableQuery += ` ORDER BY rt.name ASC`;

    const results = await db.query(availableQuery, params);

    res.render('rooms/search', {
      title: 'Tìm Kiếm Phòng Trống',
      results: results.rows,
      query: req.query
    });
  } catch (err) {
    console.error('Error during room search:', err);
    res.status(500).render('error', { title: 'Lỗi', status: 500, message: 'Lỗi khi tìm kiếm phòng trống: ' + err.message });
  }
};
