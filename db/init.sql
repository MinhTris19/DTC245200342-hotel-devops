-- Database initialization for Hotel Booking System
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- 1. USERS TABLE
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(100) NOT NULL,
    phone VARCHAR(20),
    role VARCHAR(20) NOT NULL CHECK (role IN ('customer', 'staff', 'manager')),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 2. ROOM_TYPES TABLE
CREATE TABLE IF NOT EXISTS room_types (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    base_price NUMERIC(12, 0) NOT NULL CHECK (base_price >= 0),
    capacity INT NOT NULL CHECK (capacity > 0),
    amenities TEXT,
    image_path VARCHAR(255),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 3. ROOMS TABLE
CREATE TABLE IF NOT EXISTS rooms (
    id SERIAL PRIMARY KEY,
    room_number VARCHAR(20) UNIQUE NOT NULL,
    room_type_id INT NOT NULL REFERENCES room_types(id) ON DELETE RESTRICT,
    floor INT NOT NULL,
    status VARCHAR(20) NOT NULL CHECK (status IN ('available', 'occupied', 'cleaning', 'maintenance')) DEFAULT 'available',
    is_active BOOLEAN DEFAULT true
);

-- 4. SERVICES TABLE
CREATE TABLE IF NOT EXISTS services (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) UNIQUE NOT NULL,
    price NUMERIC(12, 0) NOT NULL CHECK (price >= 0),
    is_available BOOLEAN DEFAULT true
);

-- 5. BOOKINGS TABLE
CREATE TABLE IF NOT EXISTS bookings (
    id SERIAL PRIMARY KEY,
    booking_code VARCHAR(30) UNIQUE NOT NULL,
    user_id INT NOT NULL REFERENCES users(id),
    room_id INT NOT NULL REFERENCES rooms(id),
    check_in_date DATE NOT NULL,
    check_out_date DATE NOT NULL,
    guests INT NOT NULL CHECK (guests > 0),
    note TEXT,
    status VARCHAR(20) NOT NULL CHECK (status IN ('pending', 'confirmed', 'checked_in', 'checked_out', 'cancelled')) DEFAULT 'pending',
    price_per_night NUMERIC(12, 0) NOT NULL,
    total_amount NUMERIC(12, 0) NOT NULL,
    created_by INT REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    checked_in_at TIMESTAMPTZ,
    checked_out_at TIMESTAMPTZ,
    CHECK (check_out_date > check_in_date)
);

-- Anti-double booking constraint using btree_gist
ALTER TABLE bookings DROP CONSTRAINT IF EXISTS no_overlapping_bookings;
ALTER TABLE bookings ADD CONSTRAINT no_overlapping_bookings 
    EXCLUDE USING gist (
        room_id WITH =, 
        daterange(check_in_date, check_out_date, '[)') WITH &&
    ) 
    WHERE (status IN ('pending', 'confirmed', 'checked_in'));

-- 6. BOOKING_SERVICES TABLE
CREATE TABLE IF NOT EXISTS booking_services (
    id SERIAL PRIMARY KEY,
    booking_id INT NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
    service_id INT NOT NULL REFERENCES services(id),
    quantity INT NOT NULL CHECK (quantity > 0),
    unit_price NUMERIC(12, 0) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 7. PAYMENTS TABLE
CREATE TABLE IF NOT EXISTS payments (
    id SERIAL PRIMARY KEY,
    booking_id INT UNIQUE NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
    method VARCHAR(20) NOT NULL CHECK (method IN ('cash', 'card', 'qr')),
    amount_due NUMERIC(12, 0) NOT NULL,
    amount_paid NUMERIC(12, 0) NOT NULL,
    change_amount NUMERIC(12, 0) NOT NULL,
    received_by INT REFERENCES users(id),
    paid_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for high performance
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_rooms_status ON rooms(status);
CREATE INDEX IF NOT EXISTS idx_bookings_dates ON bookings(check_in_date, check_out_date);
CREATE INDEX IF NOT EXISTS idx_bookings_user ON bookings(user_id);
CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings(status);

-- SEED DATA
-- Passwords: All default accounts use their respective passwords:
-- admin -> Admin@Hotel2026!
-- letan01, letan02 -> Staff@Hotel2026!
-- khach01, khach02 -> Customer@Hotel2026!
-- Note: A real bcrypt hash is injected during container startup or init.

INSERT INTO users (username, email, password_hash, full_name, phone, role, is_active) VALUES
('admin', 'admin@hotel.local', '$2a$10$wE99j80q8uO.lYdCszNqZ.y61n0qK8e1b3o9y5g1m2j3k4l5p6q7r', 'Quản Trị Viên', '0901234567', 'manager', true),
('letan01', 'letan01@hotel.local', '$2a$10$wE99j80q8uO.lYdCszNqZ.y61n0qK8e1b3o9y5g1m2j3k4l5p6q7r', 'Lễ Tân Nguyễn Văn A', '0912345678', 'staff', true),
('letan02', 'letan02@hotel.local', '$2a$10$wE99j80q8uO.lYdCszNqZ.y61n0qK8e1b3o9y5g1m2j3k4l5p6q7r', 'Lễ Tân Trần Thị B', '0923456789', 'staff', true),
('khach01', 'khach01@gmail.com', '$2a$10$wE99j80q8uO.lYdCszNqZ.y61n0qK8e1b3o9y5g1m2j3k4l5p6q7r', 'Khách Hàng Lê Văn C', '0934567890', 'customer', true),
('khach02', 'khach02@gmail.com', '$2a$10$wE99j80q8uO.lYdCszNqZ.y61n0qK8e1b3o9y5g1m2j3k4l5p6q7r', 'Khách Hàng Phạm Thị D', '0945678901', 'customer', true)
ON CONFLICT (username) DO NOTHING;

INSERT INTO room_types (name, description, base_price, capacity, amenities, image_path, is_active) VALUES
('Standard Room', 'Phòng Tiêu Chuẩn 1 Giường Đôi - Ban công thoáng mát, view sân vườn', 500000, 2, 'WiFi tốc độ cao, Điều hòa 2 chiều, Tivi Smart 43 inch, Nước nóng lạnh', '/images/rooms/standard.svg', true),
('Superior Room', 'Phòng Cao Cấp Hướng Thành Phố - Đầy đủ tiện nghi hiện đại', 800000, 2, 'WiFi tốc độ cao, Điều hòa, Smart TV 50 inch, Minibar, Bàn làm việc', '/images/rooms/superior.svg', true),
('Deluxe Room', 'Phòng Sang Trọng Hướng Biển - Bồn tắm nằm ngắm hoàng hôn', 1200000, 3, 'WiFi, Điều hòa, Smart TV 55 inch, Bồn tắm nằm, Máy pha cà phê, Két an toàn', '/images/rooms/deluxe.svg', true),
('Family Suite', 'Căn Hộ Gia Đình 2 Phòng Ngủ - Bếp & Phòng khách riêng biệt', 1800000, 4, '2 Phòng ngủ, Bếp nấu ăn, Tủ lạnh lớn, Smart TV 65 inch, Sofa cao cấp, 2 WC', '/images/rooms/family.svg', true),
('President Suite', 'Phòng Tổng Thống Đẳng Cấp 5 Sao - View Panorama toàn cảnh thành phố', 3500000, 4, 'Phòng khách VIP, Quầy bar riêng, Bồn sục Jacuzzi, Quản gia phục vụ 24/7', '/images/rooms/suite.svg', true)
ON CONFLICT (name) DO NOTHING;

-- 20 Rooms distributed across 4 floors
INSERT INTO rooms (room_number, room_type_id, floor, status, is_active) VALUES
('101', 1, 1, 'available', true),
('102', 1, 1, 'available', true),
('103', 1, 1, 'available', true),
('104', 1, 1, 'available', true),
('105', 2, 1, 'available', true),
('201', 2, 2, 'available', true),
('202', 2, 2, 'available', true),
('203', 2, 2, 'occupied', true),
('204', 2, 2, 'available', true),
('205', 3, 2, 'available', true),
('301', 3, 3, 'available', true),
('302', 3, 3, 'available', true),
('303', 3, 3, 'available', true),
('304', 4, 3, 'available', true),
('305', 4, 3, 'maintenance', true),
('401', 4, 4, 'available', true),
('402', 4, 4, 'available', true),
('403', 5, 4, 'available', true),
('404', 5, 4, 'occupied', true),
('405', 5, 4, 'available', true)
ON CONFLICT (room_number) DO NOTHING;

-- 8 Additional Services
INSERT INTO services (name, price, is_available) VALUES
('Buffet Sáng Cao Cấp', 150000, true),
('Giặt Ủi Lấy Ngay', 80000, true),
('Đưa Đón Sân Bay 2 Chiều', 350000, true),
('Thuê Xe Máy Tay Ga (24h)', 150000, true),
('Dịch Vụ Spa & Massage Trị Liệu (60p)', 500000, true),
('Set Trà Chiều & Bánh Ngọt Hoàng Gia', 120000, true),
('Combo Minibar & Snack Đêm', 60000, true),
('Tour Tham Quan Di Sản Thành Phố', 600000, true)
ON CONFLICT (name) DO NOTHING;

-- Sample Bookings for Dashboard KPI
INSERT INTO bookings (booking_code, user_id, room_id, check_in_date, check_out_date, guests, note, status, price_per_night, total_amount, created_by, checked_in_at) VALUES
('BK-TODAY-01', 4, 8, CURRENT_DATE - INTERVAL '1 day', CURRENT_DATE + INTERVAL '2 days', 2, 'Khách thích tầng cao yên tĩnh', 'checked_in', 800000, 2400000, 4, CURRENT_TIMESTAMP - INTERVAL '1 day'),
('BK-TODAY-02', 5, 19, CURRENT_DATE, CURRENT_DATE + INTERVAL '3 days', 4, 'VIP President đón tiếp chu đáo', 'checked_in', 3500000, 10500000, 2, CURRENT_TIMESTAMP),
('BK-UPCOMING-01', 4, 11, CURRENT_DATE + INTERVAL '1 day', CURRENT_DATE + INTERVAL '4 days', 2, 'Kỷ niệm ngày cưới', 'confirmed', 1200000, 3600000, 4, NULL),
('BK-PENDING-01', 5, 14, CURRENT_DATE + INTERVAL '2 days', CURRENT_DATE + INTERVAL '5 days', 3, 'Cần thêm cũi trẻ em', 'pending', 1800000, 5400000, 5, NULL)
ON CONFLICT (booking_code) DO NOTHING;

-- Sample booking services
INSERT INTO booking_services (booking_id, service_id, quantity, unit_price)
SELECT b.id, s.id, 2, s.price
FROM bookings b, services s
WHERE b.booking_code = 'BK-TODAY-01' AND s.name = 'Buffet Sáng Cao Cấp'
ON CONFLICT DO NOTHING;

INSERT INTO booking_services (booking_id, service_id, quantity, unit_price)
SELECT b.id, s.id, 1, s.price
FROM bookings b, services s
WHERE b.booking_code = 'BK-TODAY-02' AND s.name = 'Đưa Đón Sân Bay 2 Chiều'
ON CONFLICT DO NOTHING;
