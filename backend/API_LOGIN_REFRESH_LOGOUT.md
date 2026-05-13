# API Login, Refresh, Logout - THVP-31

## Tổng quan
Hệ thống authentication hoàn chỉnh với 3 endpoints:
- POST `/api/v1/auth/login` - Xác thực tài khoản, cấp JWT
- POST `/api/v1/auth/refresh` - Xoay vòng cấp token mới
- POST `/api/v1/auth/logout` - Đăng xuất, thu hồi token

## Cấu trúc Code

### 1. **utils/tokens.py** - JWT Token Management
```python
ACCESS_TOKEN_EXPIRE_MINUTES = 15  # Hạn 15 phút
REFRESH_TOKEN_EXPIRE_DAYS = 7     # Hạn 7 ngày

create_access_token(user_id)       # Tạo JWT access token
create_refresh_token(user_id)      # Tạo JWT refresh token
verify_token(token, type)          # Kiểm tra & decode token
```

**Token Payload:**
```json
{
  "sub": 1,              // user_id
  "type": "access",      // "access" hoặc "refresh"
  "exp": 1715325600,     // Expiration time
  "iat": 1715321200      // Issued at
}
```

### 2. **utils/redis.py** - Brute Force & Blacklist
```python
MAX_LOGIN_ATTEMPTS = 5                    // Tối đa 5 lần sai
LOCKOUT_DURATION_SECONDS = 900            // Khóa 15 phút

get_login_attempt_key(email)              // Key Redis: login_attempts:{email}
get_token_blacklist_key(token)            // Key Redis: token_blacklist:{token}
```

**Brute Force Flow:**
- Mỗi lần đăng nhập sai → increment Redis counter
- Nếu đạt 5 lần → HTTP 429 "Too many attempts"
- Counter tự hết hạn sau 900 giây (15 phút)
- Đăng nhập thành công → xóa counter

### 3. **models.py** - Database Models

**User Model:** (từ THVP-28)
```python
id, email, username, password_hash, created_at
```

**TokenBlacklist Model:** (Mới)
```python
id: Primary key
token: JWT refresh token (unique, indexed)
user_id: Foreign key -> users
blacklisted_at: Timestamp
expires_at: Khi token hết hạn
```

Lưu blacklist vào DB để persistence (Redis chỉ cache)

### 4. **schemas.py** - Request/Response DTOs
```python
LoginRequest:
  email: EmailStr
  password: str (6-128 ký tự)

RefreshRequest:
  refresh_token: str

TokenResponse:
  access_token: str (JWT 15 min)
  refresh_token: str (JWT 7 ngày)
  token_type: "bearer"
```

### 5. **auth.py** - Endpoints Implementation

#### 5.1 POST /login
```
Input: { email, password }
       ↓
1. Check brute force counter (Redis)
   → Nếu >= 5 attempts → 429 Too Many Requests
       ↓
2. Query DB: tìm user by email
       ↓
3. Verify password (bcrypt)
   → Nếu sai → increment attempts counter → 401 Unauthorized
   → Nếu đúng → xóa attempts counter
       ↓
4. Generate tokens:
   - access_token (15 min)
   - refresh_token (7 ngày)
       ↓
5. Set refresh_token as HttpOnly Cookie:
   secure=True (HTTPS only)
   httponly=True (không access via JS)
   samesite="strict" (CSRF protection)
       ↓
Output: 200 OK
{
  "access_token": "eyJ0eXAiOiJKV1QiLC...",
  "refresh_token": "eyJ0eXAiOiJKV1QiLC...",
  "token_type": "bearer"
}
```

#### 5.2 POST /refresh
```
Input: refresh_token (body hoặc cookie)
       ↓
1. Decode & verify refresh token
   → Token type phải là "refresh"
   → Không hết hạn
       ↓
2. Check token không trong blacklist (Redis)
   → Nếu blacklisted → 401 Unauthorized
       ↓
3. Query DB: tìm user by token.sub (user_id)
       ↓
4. Generate tokens mới:
   - access_token mới (15 min)
   - refresh_token mới (7 ngày)
       ↓
5. Set refresh_token mới as HttpOnly Cookie
       ↓
Output: 200 OK
{
  "access_token": "eyJ0eXAiOiJKV1QiLC...",
  "refresh_token": "eyJ0eXAiOiJKV1QiLC...",
  "token_type": "bearer"
}
```

#### 5.3 POST /logout
```
Input: refresh_token (từ Cookie)
       ↓
1. Verify refresh token
   → Phải valid & không hết hạn
       ↓
2. Add to Redis blacklist:
   key: token_blacklist:{token}
   ttl: time until token.exp
       ↓
3. Add to DB TokenBlacklist table:
   token, user_id, expires_at
   (Để persistence sau khi Redis clear)
       ↓
Output: 204 No Content
```

### 6. **main.py** - FastAPI Setup
```python
@app.on_event("startup"):
  - init_db() - Tạo tables
  - RedisClient.get_instance() - Kết nối Redis

@app.on_event("shutdown"):
  - RedisClient.close() - Đóng Redis connection

app.add_middleware(CORSMiddleware):
  - Cho phép frontend gọi API
  - allow_credentials=True (để gửi cookies)
```

## Quy trình Authentication

### Login Flow
```
[Client] → POST /login {email, password}
            ↓
[Backend] → Check brute force (Redis)
            → Query DB: find user
            → Verify password (bcrypt)
            → Generate JWT tokens
            → Set HttpOnly cookie
            → Response 200 với access_token
            ↓
[Client] → Lưu access_token (localStorage/memory)
           Nhận refresh_token (auto HttpOnly cookie)
```

### Protected API Call
```
[Client] → GET /api/v1/protected
           Headers: Authorization: Bearer {access_token}
            ↓
[Backend] → Verify access_token
            → Return data
```

### Token Expiration (15 min)
```
[Client] → access_token hết hạn
            ↓
[Client] → POST /api/v1/auth/refresh
           Body: { refresh_token } (hoặc auto từ cookie)
            ↓
[Backend] → Verify refresh_token
            → Generate access_token mới
            → Response 200
            ↓
[Client] → Update access_token
           Retry protected API
```

### Logout
```
[Client] → POST /api/v1/auth/logout
           Headers: Cookie: refresh_token=...
            ↓
[Backend] → Add refresh_token to blacklist
            → Response 204
            ↓
[Client] → Xóa access_token (localStorage)
           Cookie refresh_token auto xóa
```

## Security Features

✅ **Implemented:**
- Password hash (bcrypt)
- JWT tokens (HS256)
- HttpOnly cookies (CSRF protection)
- Brute force protection (5 attempts → 15 min lockout)
- Token blacklist (Redis + DB)
- Access token short-lived (15 min)
- Refresh token long-lived (7 ngày, HttpOnly)
- CORS with credentials

⚠️ **Recommendations:**
- Add rate limiting (per IP)
- Email verification trước login
- 2FA (Two-Factor Authentication)
- Refresh token rotation (cấp mới sau mỗi refresh)
- Secure password requirements
- Session management (revoke all sessions)

## Test API

### 1. Đăng ký tài khoản (THVP-28)
```bash
curl -X POST "http://localhost:8000/api/v1/auth/register" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "username": "testuser",
    "password": "password123"
  }'
```

### 2. Login
```bash
curl -X POST "http://localhost:8000/api/v1/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "password123"
  }' \
  -v
```

**Response:**
```json
{
  "access_token": "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9...",
  "refresh_token": "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9...",
  "token_type": "bearer"
}
```

### 3. Refresh Token
```bash
curl -X POST "http://localhost:8000/api/v1/auth/refresh" \
  -H "Content-Type: application/json" \
  -d '{
    "refresh_token": "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9..."
  }' \
  -b "refresh_token=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9..." \
  -v
```

### 4. Logout
```bash
curl -X POST "http://localhost:8000/api/v1/auth/logout" \
  -b "refresh_token=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9..." \
  -v
```

### 5. Swagger UI
- Mở: http://localhost:8000/docs
- Test tất cả endpoints

## Brute Force Test

```bash
# Sai 5 lần
for i in {1..5}; do
  curl -X POST "http://localhost:8000/api/v1/auth/login" \
    -H "Content-Type: application/json" \
    -d '{
      "email": "test@example.com",
      "password": "wrongpassword"
    }'
done

# Lần 6 → 429 Too Many Requests
curl -X POST "http://localhost:8000/api/v1/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "password123"
  }'
```

## Database Schema

```sql
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  username VARCHAR(50) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE token_blacklist (
  id SERIAL PRIMARY KEY,
  token TEXT UNIQUE NOT NULL,
  user_id INTEGER NOT NULL,
  blacklisted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP NOT NULL
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_token_blacklist_user_id ON token_blacklist(user_id);
CREATE INDEX idx_token_blacklist_token ON token_blacklist(token);
```

## Redis Keys

```
login_attempts:{email}
  - TTL: 900 giây (15 phút)
  - Value: số lần sai
  - Dùng cho brute force protection

token_blacklist:{token}
  - TTL: tính từ token.exp
  - Value: "1"
  - Dùng cho logout/revocation
```
