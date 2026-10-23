# Danh Sách Thành Phần & Phiên Bản Cố Định (Fixed Tags)

Bảng thống kê toàn bộ hình ảnh Docker (Docker Images) và các dịch vụ sử dụng trong hệ thống:

| STT | Dịch vụ (Service) | Container Name | Docker Image & Tag | Mục đích sử dụng | Cố định tag |
| :--- | :--- | :--- | :--- | :--- | :--- |
| 1 | \
ginx\ | hotel-nginx | \
ginx:1.27-alpine\ | Reverse Proxy, SSL Termination, Security Headers | Có (1.27-alpine) |
| 2 | \web\ | hotel-web | \
ode:20-alpine\ (Dockerfile) | Web Application (Express + EJS) | Có (20-alpine) |
| 3 | \db\ | hotel-db | \postgres:16-alpine\ | PostgreSQL 16 Database Server | Có (16-alpine) |
| 4 | \pgadmin\ | hotel-pgadmin | \dpage/pgadmin4:8.14\ | Giao diện quản trị PostgreSQL Web | Có (8.14) |
| 5 | \prometheus\ | hotel-prometheus | \prom/prometheus:v2.53.1\ | Time-series Database & Metrics Collector | Có (v2.53.1) |
| 6 | \grafana\ | hotel-grafana | \grafana/grafana:11.1.0\ | Visualization Dashboard & Alerting System | Có (11.1.0) |
| 7 | \cadvisor\ | hotel-cadvisor | \gcr.io/cadvisor/cadvisor:v0.49.1\ | Container Resource Monitoring (CPU, RAM, Net) | Có (v0.49.1) |
| 8 | \
ginx-exporter\ | hotel-nginx-exporter | \
ginx/nginx-prometheus-exporter:1.3.0\ | Prometheus Exporter for Nginx | Có (1.3.0) |
| 9 | \postgres-exporter\ | hotel-postgres-exporter | \prometheuscommunity/postgres-exporter:v0.15.0\ | Prometheus Exporter for PostgreSQL | Có (v0.15.0) |
| 10 | \loki\ | hotel-loki | \grafana/loki:3.0.0\ | Log Aggregation Engine | Có (3.0.0) |
| 11 | \promtail\ | hotel-promtail | \grafana/promtail:3.0.0\ | Docker Log Shipper to Loki | Có (3.0.0) |
| 12 | \lert-sink\ | hotel-alert-sink | \python:3.11-alpine\ | Webhook Receiver for Alerts | Có (3.11-alpine) |
