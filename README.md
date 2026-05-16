# ⚡ QuizBattle Platform

**QuizBattle** là một nền tảng trò chơi đố vui trực tuyến thời gian thực (real-time), được thiết kế theo phong cách hiện đại (Glassmorphism), cho phép hàng trăm người chơi tham gia thi đấu cùng lúc. Dự án được xây dựng với kiến trúc hướng hiệu năng cao, bảo mật và khả năng mở rộng tốt.

![Demo](https://res.cloudinary.com/desjarcbz/image/upload/v1/samples/animals/reindeer) <!-- Bạn có thể thay bằng screenshot thực tế -->

## ✨ Các tính năng chính

### 🎮 Game Engine & Real-time
- **WebSocket Communication**: Đồng bộ hóa trạng thái game tức thời giữa Host và tất cả người chơi.
- **Game Loop**: Hệ thống tự động quản lý vòng đời câu hỏi, thời gian đếm ngược và bảng xếp hạng.
- **Anti-F5 (State Recovery)**: Cho phép người chơi khôi phục trạng thái trận đấu ngay lập tức nếu lỡ tay tải lại trang hoặc mất kết nối.
- **Leaderboard**: Cập nhật điểm số và thứ hạng thời gian thực sau mỗi câu hỏi.

### 🔐 Xác thực & Bảo mật
- **Hybrid Auth**: Hỗ trợ đăng ký thành viên chính thức và chế độ **Khách (Guest)** tham gia nhanh không cần tài khoản.
- **Secure Storage**: Sử dụng **JWT (JSON Web Tokens)** kết hợp với **HttpOnly Cookies** để chống tấn công XSS.
- **Distributed Rate Limiting**: Hệ thống chặn spam và bảo mật đăng nhập dựa trên **Redis**, ngăn chặn tấn công brute-force.

### 👤 Cá nhân hóa
- **Profile Management**: Người dùng có thể cập nhật thông tin cá nhân và tiểu sử.
- **Avatar Upload**: Tích hợp **Cloudinary API** để tải và lưu trữ ảnh đại diện trên đám mây.

---

## 🛠 Công nghệ sử dụng

| Thành phần | Công nghệ |
|---|---|
| **Backend** | Python 3.11, FastAPI, SQLAlchemy (Async), Pydantic v2 |
| **Frontend** | Next.js 14, TypeScript, Tailwind CSS, Zustand |
| **Database** | PostgreSQL (Lưu trữ dữ liệu bền vững) |
| **Cache & Real-time** | Redis (Lưu trạng thái game & Rate limiting) |
| **Media** | Cloudinary SDK |
| **DevOps** | Docker, Docker Compose |

---

## 🚀 Hướng dẫn cài đặt nhanh (Docker)

Cách nhanh nhất để khởi chạy toàn bộ hệ thống là sử dụng Docker:

1. **Clone dự án:**
   ```bash
   git clone https://github.com/punnohoang/QuizBattle.git
   cd QuizBattle
   ```

2. **Cấu hình môi trường:**
   - Di chuyển vào thư mục backend: `cd backend`
   - Tạo file `.env` từ mẫu: `cp .env.example .env`
   - **Lưu ý:** Bạn cần điền thông tin Cloudinary trong file `.env` để tính năng upload ảnh hoạt động.

3. **Chạy hệ thống bằng Docker:**
   ```bash
   # Quay lại thư mục gốc
   cd ..
   # Khởi chạy toàn bộ dịch vụ
   docker compose up --build -d
   ```

4. **Khởi tạo dữ liệu (Database Migration & Seed):**
   Sau khi các container đã chạy ổn định, hãy chạy lệnh sau để tạo bảng và nạp dữ liệu mẫu:
   ```bash
   docker compose exec backend python migrate_data.py
   ```

---

## 🌐 Địa chỉ truy cập
- **Frontend:** [http://localhost:3000](http://localhost:3000)
- **Backend API:** [http://localhost:8000](http://localhost:8000)
- **API Documentation:** [http://localhost:8000/docs](http://localhost:8000/docs)

---

## 📂 Cấu trúc thư mục

- `backend/`: Mã nguồn FastAPI, bao gồm core logic, services và api routes.
- `frontend/`: Ứng dụng Next.js với kiến trúc App Router và các component giao diện.
- `docker-compose.yml`: Cấu hình cho toàn bộ stack (App, DB, Redis).

---

## 🛡 Bảo mật hệ thống

Dự án đã được cấu hình sẵn các lớp bảo mật:
- **CORS Configuration**: Giới hạn domain truy cập API.
- **Password Hashing**: Sử dụng Bcrypt để mã hóa mật khẩu.
- **Rate Limit**:
  - Login: 5 yêu cầu / phút.
  - Register: 3 yêu cầu / phút.
  - Guest Join: 5 yêu cầu / 60 giây.

---

**QuizBattle** - Mang đến trải nghiệm thi đấu kiến thức đỉnh cao! ⚡🏆
