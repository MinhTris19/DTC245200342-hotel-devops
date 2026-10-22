# Hệ Thống Đặt Phòng Khách Sạn (Hotel Booking System)

**Môn học:** Triển khai và Quản trị Hệ thống Phần mềm  
**Học viên thực hiện:** Nông Minh Trí  
**Mã số sinh viên (MSSV):** DTC245200342  
**Repository:** DTC245200342-hotel-devops  

---

## 1. Giới thiệu dự án
Hệ thống Đặt phòng Khách sạn (Hotel Booking System) là ứng dụng web fullstack đa tầng chạy trên kiến trúc microservices/container hóa với 12 dịch vụ, phục vụ 3 nhóm đối tượng:
- **Khách hàng (Customer):** Tìm kiếm phòng theo ngày/sức chứa, đặt phòng, theo dõi và hủy đặt phòng.
- **Lễ tân (Staff):** Xác nhận đặt phòng, check-in, check-out, thêm dịch vụ phát sinh, thanh toán, đặt phòng trực tiếp tại quầy.
- **Quản lý (Manager):** Quản lý loại phòng (upload ảnh), phòng, dịch vụ, tài khoản nhân viên, xem báo cáo doanh thu & KPI công suất phòng.

---

## 2. Kiến trúc 12 Container
1. `nginx`: Nginx reverse proxy (HTTPS, security headers, rate limit).
2. `web`: Node.js (Express + EJS) Web Application.
3. `db`: PostgreSQL 16 (chống trùng lịch bằng extension `btree_gist`).
4. `pgadmin`: pgAdmin4 quản lý cơ sở dữ liệu trực quan.
5. `prometheus`: Thu thập metrics giám sát.
6. `grafana`: Bảng điều khiển giám sát & cảnh báo.
7. `cadvisor`: Giám sát hiệu năng container (CPU, RAM, Network).
8. `nginx-exporter`: Prometheus metrics cho Nginx.
9. `postgres-exporter`: Prometheus metrics cho PostgreSQL.
10. `loki`: Lưu trữ log tập trung.
11. `promtail`: Thu thập log từ Docker containers đẩy về Loki.
12. `alert-sink`: Webhook service nhận và lưu vết cảnh báo an toàn thông tin.

---

## 3. Khởi động hệ thống
```bash
docker compose up -d --build
```

## Hướng dẫn sinh chứng chỉ SSL tự ký
Chạy script sinh chứng chỉ trước khi khởi động Nginx:
```bash
./nginx/gen-cert.sh
```
Chứng chỉ được tạo với RSA 2048 bit, thời hạn 365 ngày, bao gồm SAN: IP:192.168.1.6, IP:127.0.0.1, DNS:localhost.
