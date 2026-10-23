# TƯ LIỆU BÁO CÁO ĐỒ ÁN DEVOPS: HỆ THỐNG ĐẶT PHÒNG KHÁCH SẠN (HOTEL BOOKING SYSTEM)

- **Môn học / Chuyên đề:** Thực hành DevOps & Quản trị Hệ thống
- **Tên Đề tài:** Thiết kế, Triển khai và Hardening Bảo mật Hệ thống Đặt phòng Khách sạn trên Nền tảng Docker Microservices
- **Sinh viên thực hiện:** DTC245200342 - Minh Trí
- **Môi trường triển khai:** Ubuntu Server 24.04 LTS (VirtualBox VM, IP: 192.168.1.6)
- **Kho lưu trữ mã nguồn (GitHub):** [https://github.com/MinhTris19/DTC245200342-hotel-devops.git](https://github.com/MinhTris19/DTC245200342-hotel-devops.git)
- **Tổng số Commits:** 3 Commits chuẩn Semantic Versioning

---

## CHƯƠNG 1: GIỚI THIỆU BÀI TOÁN VÀ KIẾN TRÚC TỔNG THỂ HỆ THỐNG

### 1.1. Bối cảnh và Yêu cầu Nghiệp vụ
Hệ thống Đặt phòng Khách sạn là một ứng dụng web phục vụ đa đối tượng người dùng: Khách thuê (Guest), Chủ khách sạn (Hotelier) và Quản trị viên hệ thống (Admin). Hệ thống đòi hỏi:
1. **Tính sẵn sàng và khả năng mở rộng:** Phân tách các thành phần thành 12 microservices/containers độc lập quản lý qua Docker Compose.
2. **Toàn vẹn dữ liệu nghiệp vụ:** Ngăn chặn tuyệt đối tình trạng đặt phòng trùng lịch (double-booking) tại tầng CSDL.
3. **An toàn thông tin đa tầng (Defense in Depth):** Mã hóa toàn bộ đường truyền qua TLS/SSL, phân quyền tối thiểu (Least Privilege), phân vùng mạng cách ly và phòng thủ tấn công Brute-Force.
4. **Khả năng quan sát toàn diện (Observability):** Thu thập metrics, nhật ký tập trung và tự động gửi cảnh báo khi phát hiện bất thường.

### 1.2. Danh mục 12 Microservices trong Hệ thống
Hệ thống gồm 12 dịch vụ được container hóa hoàn toàn:
1. **hotel-nginx (Nginx 1.27-alpine):** Reverse Proxy Gateway, SSL Termination (TLS 1.2/1.3), Routing, Rate Limiting và Security Headers.
2. **hotel-web (Node.js 20-alpine):** Ứng dụng Backend Web MVC (Express.js, EJS, pg driver, bcryptjs, express-session).
3. **hotel-db (PostgreSQL 16-alpine):** Cơ sở dữ liệu quan hệ lưu trữ dữ liệu nghiệp vụ và thông tin xác thực người dùng.
4. **hotel-pgadmin (pgAdmin4 8.14):** Giao diện web quản trị cơ sở dữ liệu PostgreSQL.
5. **hotel-prometheus (Prometheus v2.53.1):** Máy chủ giám sát TSDB, cào dữ liệu đo lường định kỳ từ 4 targets.
6. **hotel-grafana (Grafana 11.1.0):** Nền tảng hiển thị Dashboard trực quan hóa trạng thái hệ thống.
7. **hotel-cadvisor (cAdvisor v0.49.1):** Thu thập thông số hiệu năng tài nguyên container (CPU, RAM, Disk I/O, Network I/O).
8. **hotel-nginx-exporter (Nginx Exporter 1.3.0):** Thu thập metrics lưu lượng truy cập HTTP từ Nginx stub_status.
9. **hotel-postgres-exporter (Postgres Exporter 0.15.0):** Thu thập metrics hoạt động CSDL (kết nối, locks, transactions, cache hit).
10. **hotel-loki (Loki 3.0.0):** Hệ thống lưu trữ và truy vấn nhật ký tập trung (Log Aggregation).
11. **hotel-promtail (Promtail 3.0.0):** Log Collector thu thập log từ container Docker và chuyển tiếp về Loki.
12. **hotel-alert-sink (Python 3.12-alpine):** Dịch vụ Webhook nhận cảnh báo an ninh thời gian thực khi có tấn công Brute-Force.

### 1.3. Mô hình Mạng và Phân vùng Cách ly (Network Isolation)
Hệ thống thiết lập 3 mạng Docker bridge có kiểm soát truy cập nghiêm ngặt:
- **`hotel_frontend` (Bridge):** Kết nối Client -> Nginx Gateway -> Ứng dụng Web / Grafana / pgAdmin.
- **`hotel_backend` (Bridge, `internal: true`):** Mạng nội bộ tuyệt đối không có Gateway ra Internet. Chỉ chứa `hotel-db`, `hotel-web`, `hotel-pgadmin`, `hotel-postgres-exporter`. Dữ liệu CSDL được cô lập hoàn toàn khỏi mạng bên ngoài.
- **`hotel_monitoring` (Bridge):** Mạng giám sát liên kết Prometheus, Grafana, Loki, Promtail, Alert Sink và các Exporter.

### 1.4. Sơ đồ Kiến trúc Tổng thể (Mermaid Architecture)

```mermaid
graph TD
    Client(["🌐 Client (Browser / API)"]) -->|HTTP:80 Redirect 301| Nginx["🛡️ Nginx Reverse Proxy (hotel-nginx:443)"]
    Client -->|HTTPS:443 (TLS 1.2/1.3)| Nginx

    subgraph Frontend_Net ["🌐 Network: hotel_frontend"]
        Nginx -->|Reverse Proxy /| WebApp["💻 Web App (hotel-web:3000)"]
        Nginx -->|Proxy /grafana/| Grafana["📊 Grafana (hotel-grafana:3000)"]
        Nginx -->|Proxy /pgadmin/| pgAdmin["🐘 pgAdmin4 (hotel-pgadmin:80)"]
    end

    subgraph Backend_Net ["🔒 Network: hotel_backend (internal: true)"]
        WebApp -->|SQL Query (hotel_app)| DB[("🗄️ PostgreSQL 16 (hotel-db:5432)")]
        pgAdmin -->|Admin Query (postgres_admin)| DB
        PgExp["📈 Postgres Exporter (9187)"] -->|Scrape Metrics| DB
    end

    subgraph Monitoring_Net ["📡 Network: hotel_monitoring"]
        Prom["⏱️ Prometheus (9090)"] -->|Scrape| WebApp
        Prom -->|Scrape| PgExp
        Prom -->|Scrape| NgxExp["📈 Nginx Exporter (9113)"]
        Prom -->|Scrape| cAdv["📈 cAdvisor (8080)"]
        NgxExp -->|Stub Status| Nginx
        cAdv -->|Cgroup Metrics| HostDocker["🐳 Docker Daemon"]
        Grafana -->|Data Source| Prom
        Grafana -->|Data Source| Loki["📜 Loki Log Engine (3100)"]
        Promtail["🔍 Promtail (Collector)"] -->|Push Logs| Loki
        Loki -->|Webhook Alert| AlertSink["🚨 Alert Sink (Python Server:8080)"]
    end
```

---

## CHƯƠNG 2: CƠ SỞ DỮ LIỆU POSTGRESQL & TÍNH TOÀN VẸN NGHIỆP VỤ

### 2.1. Cấu trúc Schema Cơ sở Dữ liệu (7 Bảng)
Cơ sở dữ liệu `hotel` được chuẩn hóa thành 7 bảng quan hệ:
1. **`users`:** Lưu tài khoản, mật khẩu băm bcrypt (10 rounds), vai trò RBAC (`admin`, `hotelier`, `guest`).
2. **`hotels`:** Thông tin khách sạn, địa chỉ, thành phố, chủ sở hữu (`hotelier_id` liên kết `users`).
3. **`room_types`:** Phân loại phòng (Standard, Deluxe, Suite, Executive), giá niêm yết, tiện ích.
4. **`rooms`:** Chi tiết từng phòng thực tế, số phòng, trạng thái sử dụng.
5. **`bookings`:** Lịch đặt phòng, ngày nhận phòng (`check_in`), ngày trả phòng (`check_out`), trạng thái (`pending`, `confirmed`, `cancelled`).
6. **`services` & `booking_services`:** Quản lý dịch vụ gia tăng (bữa sáng, spa, đưa đón sân bay).
7. **`payments`:** Giao dịch thanh toán, số tiền, phương thức, thời gian và người thu ngân.

### 2.2. Cơ chế Phân quyền Người dùng (RBAC)
- **Guest (Khách thuê):** Tìm kiếm phòng theo ngày, tạo yêu cầu đặt phòng cá nhân, xem và hủy lịch đặt của chính mình.
- **Hotelier (Chủ khách sạn):** Quản lý danh mục khách sạn thuộc quyền sở hữu, thêm/sửa loại phòng và số phòng, xác nhận đặt phòng của khách.
- **Admin (Quản trị viên):** Quản lý toàn bộ danh mục tài khoản người dùng, xem báo cáo doanh thu toàn hệ thống, toàn quyền vận hành.

### 2.3. Giải pháp Chống Trùng Lịch (Double-Booking Prevention)
**Vấn đề:** Trong hệ thống đặt phòng đồng thời, việc 2 khách hàng cùng đặt 1 phòng trong cùng khoảng thời gian là lỗi nghiêm trọng nếu chỉ kiểm tra ở tầng ứng dụng (Race Condition).
**Giải pháp:** Áp dụng ràng buộc loại trừ cấp CSDL với extension `btree_gist`:
```sql
CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE bookings
ADD CONSTRAINT no_overlapping_bookings
EXCLUDE USING gist (
    room_id WITH =,
    daterange(check_in, check_out) WITH &&
)
WHERE (status != 'cancelled');
```
Ràng buộc này đảm bảo PostgreSQL tự động từ chối mọi giao dịch chèn hoặc cập nhật có khoảng ngày giao thoa (`&&`) trên cùng một `room_id`, độc lập hoàn toàn với số lượng luồng ứng dụng song song.

### 2.4. Dữ liệu Mẫu (Seed Data)
Hệ thống được khởi tạo sẵn với:
- 6 tài khoản mẫu đủ các vai trò (`admin`, 2 `hotelier`, 3 `guest`).
- 4 khách sạn tiêu biểu tại Hà Nội, Đà Nẵng, TP.HCM, Nha Trang.
- 8 loại phòng và 16 phòng ngủ riêng biệt.
- 12 đơn đặt phòng mẫu kiểm thử toàn vẹn trạng thái.

---

## CHƯƠNG 3: TẦNG REVERSE PROXY VÀ BẢO MẬT GATEWAY VỚI NGINX

### 3.1. Thiết kế Định tuyến Cổng vào (Single Entrypoint)
Nginx làm cổng duy nhất công khai ra môi trường bên ngoài:
- `https://localhost/` -> Chuyển tiếp tới `hotel-web:3000`
- `https://localhost/grafana/` -> Chuyển tiếp tới `hotel-grafana:3000`
- `https://localhost/pgadmin/` -> Chuyển tiếp tới `hotel-pgadmin:80`
- `http://localhost/` -> Chuyển hướng 301 tự động sang `https://localhost/`

### 3.2. Cấu hình Mã hóa TLS 1.2 / TLS 1.3
Chứng chỉ số SSL SAN (Subject Alternative Name) tự ký được tạo tự động với thời hạn 365 ngày qua script `gen-cert.sh`:
- Hỗ trợ các tên miền/IP: `DNS:localhost`, `IP:127.0.0.1`, `IP:192.168.1.6`.
- Cấu hình chỉ chấp nhận các bộ mã hóa an toàn cao:
  `ssl_protocols TLSv1.2 TLSv1.3;`
  `ssl_ciphers HIGH:!aNULL:!MD5;`
  `ssl_prefer_server_ciphers on;`

### 3.3. Bộ Tiêu chuẩn HTTP Security Headers
Nginx chèn tự động bộ HTTP Header chuẩn OWASP vào tất cả phản hồi:
1. **Strict-Transport-Security (HSTS):** `max-age=31536000; includeSubDomains` (bắt buộc trình duyệt chỉ dùng HTTPS).
2. **X-Frame-Options:** `SAMEORIGIN` (chống Clickjacking).
3. **X-Content-Type-Options:** `nosniff` (chống MIME-sniffing).
4. **X-XSS-Protection:** `1; mode=block` (kích hoạt bộ lọc XSS).
5. **Referrer-Policy:** `strict-origin-when-cross-origin` (bảo vệ quyền riêng tư đường dẫn).
6. **Content-Security-Policy (CSP):** Hạn chế nguồn nạp script/style chỉ từ `'self'` và tài nguyên hợp lệ.
7. **Permissions-Policy:** `geolocation=(), microphone=(), camera=()` (vô hiệu hóa các API nhạy cảm của thiết bị).

### 3.4. Cơ chế Rate Limiting Chống Tấn công DoS & Brute-Force
- Vùng giới hạn đăng nhập: `limit_req_zone $binary_remote_addr zone=login_limit:10m rate=5r/m;`
- Vùng tải tĩnh/API: `limit_req_zone $binary_remote_addr zone=general_limit:10m rate=30r/s;`
- Khi vượt ngưỡng tại route đăng nhập (`/login`), Nginx trả về mã lỗi `HTTP 429 Too Many Requests`.

---

## CHƯƠNG 4: HỆ THỐNG GIÁM SÁT HIỆU NĂNG VỚI PROMETHEUS & GRAFANA

### 4.1. Kiến trúc Thu thập Chỉ số (Metrics Collection)
Prometheus được cấu hình thu thập chỉ số định kỳ mỗi 15 giây từ 4 endpoints:
1. `hotel-web:3000/metrics` (prom-client): HTTP request duration, status codes, active sessions.
2. `cadvisor:8080/metrics`: Container CPU usage, Memory working set, Network RX/TX, Container restarts.
3. `nginx-exporter:9113/metrics`: Nginx active connections, requests per second, accepted/handled requests.
4. `postgres-exporter:9187/metrics`: Active connections, transaction commits/rollbacks, buffer cache hit ratio, deadlocks.

Tất cả 4 targets đều đạt trạng thái `UP` (100% khả dụng).

### 4.2. Danh mục 3 Grafana Dashboards Chuyên biệt
1. **Application & System Overview Dashboard:**
   - Chỉ số tổng quan CPU & RAM của toàn bộ 12 containers.
   - Tốc độ yêu cầu HTTP (Requests/sec) và tỷ lệ lỗi HTTP 4xx/5xx của ứng dụng Node.js.
   - Thời gian phản hồi trung bình (Latency p95, p99).
2. **Nginx & Web Traffic Dashboard:**
   - Lưu lượng kết nối đồng thời (Active Connections: Reading, Writing, Waiting).
   - Tốc độ xử lý yêu cầu HTTP của Nginx Gateway.
   - Phân bố mã phản hồi HTTP (2xx, 3xx, 4xx, 5xx) theo thời gian thực.
3. **PostgreSQL Database Deep Dive Dashboard:**
   - Số lượng kết nối đang sử dụng so với `max_connections`.
   - Tỷ lệ Cache Hit Ratio (> 99% đạt chuẩn tối ưu I/O).
   - Tần suất Transaction Commits/Rollbacks và Locks.

---

## CHƯƠNG 5: QUẢN TRỊ LOG TẬP TRUNG VÀ PHÁT HIỆN SỰ CỐ (LOKI & PROMTAIL)

### 5.1. Kiến trúc Pipeline Thu thập Log
1. **Nguồn phát sinh:**
   - Nginx ghi Access Log dưới định dạng JSON có cấu trúc (`time_local`, `remote_addr`, `request_method`, `request_uri`, `status`, `request_time`, `body_bytes_sent`, `http_user_agent`).
   - Node.js ghi application log với timestamp và log level (`INFO`, `WARN`, `ERROR`).
2. **Thu thập (Promtail):** Đọc log từ volume chia sẻ `/var/log/nginx/` và docker container log stream, gắn nhãn (`job=nginx`, `job=hotel-web`).
3. **Lưu trữ & Truy vấn (Loki):** Lưu trữ log theo định dạng chunk có nén, lập chỉ mục dựa trên nhãn, phục vụ truy vấn LogQL nhanh chóng.
4. **Cảnh báo (Alert Sink):** Tích hợp dịch vụ Python server nhận webhook tự động khi phát hiện tấn công.

### 5.2. Các Truy vấn LogQL Tiêu biểu
- **Lọc lỗi máy chủ HTTP 5xx từ Nginx JSON log:**
  ```logql
  {job="nginx"} | json | status >= 500
  ```
- **Phát hiện các lần đăng nhập thất bại (HTTP 401):**
  ```logql
  {job="nginx"} | json | request_uri =~ "/login.*" and status = 401
  ```
- **Đo lường tần suất đăng nhập lỗi theo phút:**
  ```logql
  sum(rate({job="nginx"} | json | request_uri =~ "/login.*" and status = 401 [1m]))
  ```

### 5.3. Mô phỏng Thực nghiệm và Ứng phó Sự cố Tấn công Brute-Force
- **Kịch bản:** Kẻ tấn công sử dụng script tự động gửi 20 yêu cầu đăng nhập sai mật khẩu liên tiếp vào tài khoản `admin@hotel.local`.
- **Phát hiện:** Nginx ghi nhận 20 bản ghi HTTP 401 trong thời gian ngắn. Promtail chuyển log đến Loki.
- **Kích hoạt Cảnh báo:** Loki Rule `BruteForceLoginAlert` phát hiện tần suất lỗi > 5 lần/phút. Cảnh báo được gửi tới webhook của `hotel-alert-sink`.
- **Nhật ký Sự cố (Incident Post-Mortem):**
  - Thời gian: 2026-10-23 18:25 UTC.
  - IP nguồn: `192.168.1.6`.
  - Mục tiêu: POST `/login` với payload `email=admin@hotel.local`.
  - Biện pháp xử lý: Kích hoạt Rate Limiting chặn IP vi phạm với mã lỗi 429, khóa tài khoản tạm thời sau 5 lần sai.

---

## CHƯƠNG 6: CÁC BIỆN PHÁP BẢO MẬT VÀ HARDENING HỆ THỐNG TOÀN DIỆN

### 6.1. Nguyên tắc Đặc quyền Tối thiểu trên Cơ sở Dữ liệu (Least Privilege)
- Phân chia 2 tài khoản riêng biệt:
  - `postgres_admin` (Superuser): Chỉ dùng trong giai đoạn di chuyển cấu trúc CSDL (migration), bảo trì schema và pgAdmin. Sở hữu toàn bộ 7 bảng trong schema `public`.
  - `hotel_app` (Application User): Ứng dụng Node.js chỉ kết nối bằng tài khoản này. Chỉ được cấp quyền `SELECT`, `INSERT`, `UPDATE`, `DELETE` trên dữ liệu. Đã thu hồi quyền `CREATE` trên schema `public` và không thể thực thi lệnh DDL nguy hiểm (`DROP TABLE`, `TRUNCATE`).
- **Thực nghiệm kiểm chứng:** Khi cố ý thực thi `DROP TABLE users;` bằng tài khoản `hotel_app`, hệ thống trả về lỗi từ chối quyền thực thi, bảo vệ an toàn CSDL.

### 6.2. Container Security Hardening
Mỗi container trong `docker-compose.yml` đều được áp dụng bộ chuẩn bảo mật:
1. **Non-root User:**
   - `hotel-web`: Chạy dưới tài khoản `node` (UID/GID 1000).
   - `hotel-alert-sink`: Chạy dưới tài khoản `appuser` (UID/GID 10001).
   - `hotel-loki`: Chạy dưới tài khoản `loki` (UID/GID 10001).
   - `hotel-postgres-exporter`: Chạy dưới tài khoản `nobody` (UID/GID 65534).
2. **Read-only Root Filesystem:** Cấu hình `read_only: true` cho container ứng dụng; chỉ cấp quyền ghi vào thư mục tạm `tmpfs` (`/tmp`) cần thiết.
3. **Drop Capabilities:** Cấu hình `cap_drop: [ALL]`, loại bỏ toàn bộ Linux capabilities nguy hiểm. Riêng Nginx bổ sung tối thiểu `NET_BIND_SERVICE` (để bind port 80/443) và `DAC_OVERRIDE` (để đọc chứng chỉ SSL).
4. **No-New-Privileges:** `security_opt: [no-new-privileges:true]` ngăn chặn tiến trình con leo thang đặc quyền qua setuid/setgid binary.
5. **Giới hạn Tài nguyên (Cgroups Resource Limits):** Đặt `limits: cpus: "0.50", memory: 512M` cho từng dịch vụ để chống DoS tài nguyên hệ thống máy chủ vật lý.

### 6.3. Tường lửa Cấp Máy chủ (Host UFW Firewall)
Hệ thống kích hoạt tường lửa Ubuntu UFW để chặn đứng các kết nối trực tiếp vào các cổng nội bộ:
```bash
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow 22/tcp   # Quản trị SSH từ xa
sudo ufw allow 80/tcp   # Cổng HTTP Nginx Gateway
sudo ufw allow 443/tcp  # Cổng HTTPS Nginx Gateway
sudo ufw enable
```
Toàn bộ các cổng dịch vụ nhạy cảm như PostgreSQL (`5432`), Node.js (`3000`), Prometheus (`9090`), Loki (`3100`) đều bị chặn từ mạng ngoài, chỉ có thể giao tiếp nội bộ thông qua Docker Network.

### 6.4. Quét Lỗ hổng Bảo mật Container với Trivy Scanner
Đã thực hiện quét lỗ hổng trên hình ảnh container `hotel-web:latest` và `nginx:1.27-alpine` bằng công cụ Trivy Scanner:
- Kết quả: Không tồn tại lỗ hổng mức độ Nghiêm trọng (CRITICAL) chưa được khắc phục.
- Toàn bộ thư viện npm đã được kiểm tra tính tương thích và bảo mật.

---

## KẾT LUẬN VÀ ĐÁNH GIÁ DỰ ÁN

### 7.1. Tổng kết Kết quả Thực hiện
1. **Hoàn thành toàn diện 100% mục tiêu:** Triển khai thành công 12/12 microservices hoạt động ổn định, đồng bộ và có giám sát chặt chẽ.
2. **Kỷ luật DevOps chuẩn mực:** Quản lý mã nguồn qua Git với đúng 3 commits chuẩn Semantic Commits, lịch sử trong sạch, không để lộ bí mật hay token.
3. **Khả năng quan sát vượt trội:** 3 Dashboard Grafana hoàn chỉnh, hệ thống Log tập trung Loki và cơ chế cảnh báo tự động hoạt động chính xác.
4. **Bảo mật chuyên sâu:** Đạt chuẩn phân quyền tối thiểu, mã hóa SSL TLS 1.3, chống trùng lịch đặt phòng và bảo vệ hệ thống bằng tường lửa UFW.

### 7.2. Bài học Kinh nghiệm
- **Quản lý phân quyền Docker:** Việc drop capabilities cần được cân nhắc chi tiết với từng dịch vụ (ví dụ: Nginx cần quyền đọc tệp chứng chỉ).
- **Phân tách mạng nội bộ:** Cần phân định rõ mạng nội bộ không có gateway (`internal: true`) để triệt tiêu bề mặt tấn công CSDL.
- **Tối ưu hóa tài nguyên:** Giới hạn tài nguyên bằng cgroups giúp hệ thống chạy mượt mà ngay cả trên máy ảo VirtualBox có cấu hình RAM hạn chế (4GB).

---

## PHỤ LỤC: BẢNG THÔNG SỐ VÀ DANH MỤC THÀNH PHẦN

### Bảng 1: Danh mục Phiên bản Phần mềm Thực tế
| Thành phần | Image / Package | Phiên bản | Vai trò |
|---|---|---|---|
| Hệ điều hành Host | Ubuntu Server | 24.04 LTS | Nền tảng ảo hóa VirtualBox |
| Web Application | hotel-web | Node.js 20-alpine | Backend MVC đặt phòng |
| Database Engine | postgres | 16-alpine | CSDL quan hệ chính |
| Reverse Proxy | nginx | 1.27-alpine | Gateway, SSL, Security Headers |
| DB Management | dpage/pgadmin4 | 8.14 | Web GUI quản trị CSDL |
| Metrics Engine | prom/prometheus | v2.53.1 | Thu thập & lưu trữ metrics |
| Metrics Dashboard | grafana/grafana | 11.1.0 | Trực quan hóa dữ liệu giám sát |
| Container Monitor | gcr.io/cadvisor | v0.49.1 | Đo lường tài nguyên container |
| Nginx Metrics | nginx/nginx-prometheus-exporter | 1.3.0 | Exporter chỉ số Nginx |
| Postgres Metrics | prometheuscommunity/postgres-exporter | v0.15.0 | Exporter chỉ số CSDL |
| Log Aggregator | grafana/loki | 3.0.0 | Công cụ quản lý log tập trung |
| Log Shipper | grafana/promtail | 3.0.0 | Thu thập và đẩy log lên Loki |
| Alert Webhook | hotel-alert-sink | Python 3.12-alpine | Điểm tiếp nhận cảnh báo bảo mật |

### Bảng 2: Thông tin Tài khoản Mặc định Kiểm thử
| Phân hệ / Vai trò | Tài khoản / Email | Mật khẩu | Mục đích |
|---|---|---|---|
| Quản trị Web (Admin) | `admin@hotel.local` | `Admin@123456` | Toàn quyền quản trị hệ thống |
| Chủ khách sạn (Hotelier) | `hotelier1@hotel.local` | `Hotelier@123456` | Quản lý phòng & đặt phòng |
| Khách thuê (Guest) | `guest1@hotel.local` | `Guest@123456` | Đặt phòng và xem đơn đặt |
| Grafana Dashboard | `admin` | `grafana_admin_password_2026` | Xem dashboards giám sát |
| pgAdmin Management | `admin@hotel.local` | `pgadmin_admin_password_2026` | Quản trị CSDL giao diện web |
| CSDL App User | `hotel_app` | `hotel_app_secure_password_2026` | Dành cho Node.js kết nối |
| CSDL Admin User | `postgres_admin` | `admin_secure_vault_2026` | Dành cho bảo trì, di chuyển schema |

---
*Tài liệu được sinh tự động và chuẩn hóa phục vụ công tác báo cáo đồ án.*
