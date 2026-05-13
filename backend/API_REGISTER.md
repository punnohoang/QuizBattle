# API Register - THVP-28

## Tổng quan
API POST `/api/v1/auth/register` cho phép người dùng tạo tài khoản mới bằng email, username và password.

## Cấu trúc Code

### 1. **db.py** - Database Configuration
```python
- DATABASE_URL: Kết nối PostgreSQL async (asyncpg)
- engine: SQLAlchemy async engine
- AsyncSessionLocal: Session factory
- get_db(): Dependency injection cho database session
- init_db(): Khởi tạo bảng khi startup
```

### 2. **models.py** - User Model
```python
class User(Base):
    id: Primary key (int)
    email: Unique, indexed
    username: Unique, indexed  
    password_hash: Bcrypt hash (không lưu password plaintext)
    created_at: Timestamp tự động
```

### 3. **schemas.py** - Pydantic Validators
```python
RegisterRequest: Input validation
  - email: EmailStr (validate email format)
  - username: 3-50 ký tự
  - password: 6-128 ký tự

UserResponse: Output format
  - id, email, username (không include password_hash)
```

### 4. **auth.py** - Register Endpoint
```python
@router.post("/register", status_code=201)
1. Validate input qua RegisterRequest schema
2. Kiểm tra email/username tồn tại trong DB
   - Query với OR: email hoặc username có trùng không
   - Nếu có trùng → raise HTTPException 400
3. Hash password bằng bcrypt
   - bcrypt.hashpw(password.encode(), bcrypt.gensalt())
   - Lưu hash, không lưu password nguyên bản
4. Tạo User mới, lưu DB, commit
5. Trả về UserResponse (status 201 Created)
```

### 5. **main.py** - FastAPI Setup
```python
@app.on_event("startup"):
  - Chạy init_db() khi server start
  - Tạo tất cả bảng nếu chưa tồn tại

app.include_router(auth_router):
  - Đăng ký router auth (/api/v1/auth/register)
```

## Quy trình Request

```
POST /api/v1/auth/register
{
  "email": "user@example.com",
  "username": "johndoe",
  "password": "password123"
}
     ↓
1. Pydantic validate (email format, username/password length)
     ↓
2. Query DB: User.email hoặc User.username đã tồn tại?
     ↓
3. Nếu trùng → 400 Bad Request
     ↓
4. Hash password với bcrypt
     ↓
5. INSERT User vào PostgreSQL
     ↓
6. Response 201 Created
{
  "id": 1,
  "email": "user@example.com",
  "username": "johndoe"
}
```

## Test API

### Cách 1: Swagger UI
- Mở: http://localhost:8000/docs
- Tìm endpoint `/api/v1/auth/register`
- Click "Try it out" → nhập dữ liệu → Execute

### Cách 2: cURL
```bash
curl -X POST "http://localhost:8000/api/v1/auth/register" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "username": "testuser",
    "password": "password123"
  }'
```

### Cách 3: Python requests
```python
import requests

response = requests.post(
    "http://localhost:8000/api/v1/auth/register",
    json={
        "email": "test@example.com",
        "username": "testuser",
        "password": "password123"
    }
)
print(response.status_code)  # 201
print(response.json())
```

## Error Handling

| Lỗi | Status | Nguyên nhân |
|-----|--------|-----------|
| Invalid email | 422 | Email không hợp lệ |
| Username < 3 ký tự | 422 | Validator Pydantic |
| Password < 6 ký tự | 422 | Validator Pydantic |
| Email đã đăng ký | 400 | Email trong DB |
| Username đã tồn tại | 400 | Username trong DB |
| Database error | 500 | Lỗi kết nối/truy vấn |

## Bảo mật

✅ **Đã implement:**
- Password hash bằng bcrypt (không lưu plaintext)
- Email/username unique constraint
- Input validation (Pydantic)
- Email format validation

⚠️ **Nên thêm:**
- Rate limiting (ngăn brute force)
- Email verification
- Password strength rules
- CORS configuration
