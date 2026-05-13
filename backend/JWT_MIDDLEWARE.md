# JWT Middleware - THVP-34

## Tổng quan
JWT Middleware là dependency của FastAPI dùng để:
- Extract Authorization header chứa JWT access token
- Verify token (signature, expiration, type)
- Query user từ database
- Return user info cho protected endpoints
- Bắn lỗi 401/403/404 nếu không hợp lệ

## Cấu trúc Code

### **dependencies.py** - JWT Dependency

```python
async def get_current_user(
    authorization: str | None = None,
    db: AsyncSession = Depends(get_db),
) -> User
```

**Quy trình:**

```
Request: GET /api/v1/protected
         Headers: Authorization: Bearer eyJ0eXAi...
                  ↓
1. Kiểm tra Authorization header
   → Nếu missing → 401 "Missing Authorization header"
                  ↓
2. Parse header: "Bearer {token}"
   → Nếu format sai → 401 "Invalid Authorization header format"
                  ↓
3. Verify token (signature + expiration)
   → Nếu invalid/expired → 401 "Invalid or expired access token"
                  ↓
4. Query DB: User by token.sub (user_id)
   → Nếu user không tồn tại → 404 "User not found"
                  ↓
5. Check user.is_active
   → Nếu inactive → 403 "User account is inactive"
                  ↓
6. Return user object
   → Endpoint nhận được user info
```

### **Type Alias - CurrentUser**

```python
CurrentUser = Annotated[User, Depends(get_current_user)]
```

- Type hint rõ ràng cho protected endpoints
- Tự động include dependency
- Dễ đọc, dễ maintain

## Error Handling

| Status | Detail | Nguyên nhân |
|--------|--------|-----------|
| **401** | Missing Authorization header | Không có header |
| **401** | Invalid Authorization header format | Format không phải "Bearer {token}" |
| **401** | Invalid or expired access token | Token invalid/hết hạn |
| **404** | User not found | User ID không tồn tại trong DB |
| **403** | User account is inactive | User bị disable |

## Cách Dùng

### 1. Protected Endpoint
```python
from .dependencies import CurrentUser

@app.get("/api/v1/protected")
async def protected_route(current_user: CurrentUser):
    """Endpoint này chỉ accessible khi authenticated."""
    return {
        "message": f"Hello {current_user.username}",
        "user_id": current_user.id
    }
```

### 2. Endpoint access user info
```python
@app.post("/api/v1/quizzes")
async def create_quiz(
    quiz_data: QuizRequest,
    current_user: CurrentUser
):
    """Create quiz - chỉ authenticated users."""
    return await quiz_service.create(
        quiz_data,
        user_id=current_user.id
    )
```

### 3. Optional - Một số endpoint có thể không cần auth
```python
@app.post("/api/v1/auth/register")
async def register(payload: RegisterRequest):
    """Public endpoint - không cần auth."""
    return await auth_service.register(payload)
```

## Test API

### 1. Register & Login (lấy access token)
```bash
# Register
curl -X POST "http://localhost:8000/api/v1/auth/register" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "username": "testuser",
    "password": "password123"
  }'

# Login
curl -X POST "http://localhost:8000/api/v1/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "password123"
  }' | jq '.access_token'
```

Lưu access_token vào biến:
```bash
ACCESS_TOKEN="eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9..."
```

### 2. Call protected endpoint với token
```bash
# Success - 200 OK
curl -X GET "http://localhost:8000/api/v1/me" \
  -H "Authorization: Bearer $ACCESS_TOKEN"

# Response:
# {
#   "id": 1,
#   "username": "testuser",
#   "email": "test@example.com",
#   "avatar_url": null,
#   "is_active": true,
#   "created_at": "2026-05-09T12:34:56Z"
# }
```

### 3. Test error cases

**Missing Authorization header:**
```bash
curl -X GET "http://localhost:8000/api/v1/me"

# Response 401:
# {
#   "detail": "Missing Authorization header"
# }
```

**Invalid token format:**
```bash
curl -X GET "http://localhost:8000/api/v1/me" \
  -H "Authorization: InvalidToken123"

# Response 401:
# {
#   "detail": "Invalid Authorization header format. Use 'Bearer {token}'"
# }
```

**Expired/Invalid token:**
```bash
curl -X GET "http://localhost:8000/api/v1/me" \
  -H "Authorization: Bearer invalid_token_xyz"

# Response 401:
# {
#   "detail": "Invalid or expired access token"
# }
```

**User không tồn tại:**
```bash
# Tạo token cho user ID 999 (không tồn tại)
# Response 404:
# {
#   "detail": "User not found"
# }
```

**User inactive:**
```bash
# Đăng nhập với user bị disable (is_active=false)
# Response 403:
# {
#   "detail": "User account is inactive"
# }
```

### 4. Swagger UI Test
- Mở: http://localhost:8000/docs
- Tìm endpoint `/api/v1/me`
- Click "Try it out"
- Click "Authorize" (nếu có)
- Paste token: `eyJ0eXAi...`
- Execute

## Architecture Flow

```
┌─────────────────────────────────────────────────────────┐
│ Client Request                                          │
│ GET /api/v1/protected                                   │
│ Headers: Authorization: Bearer {access_token}           │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│ FastAPI Route Handler                                   │
│ @app.get("/api/v1/protected")                           │
│ async def protected(current_user: CurrentUser)          │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼ (Dependency injection)
┌─────────────────────────────────────────────────────────┐
│ get_current_user() Dependency                           │
└────────────────────┬────────────────────────────────────┘
                     │
        ┌────────────┴────────────┐
        │                         │
        ▼                         ▼
   ┌─────────────┐         ┌──────────────┐
   │ Extract &   │         │ Query User   │
   │ Verify JWT  │         │ from DB      │
   │             │         │              │
   │ • Parse     │────────▶ │ • Check ID   │
   │ • Verify    │         │ • Check      │
   │ • Decode    │         │   is_active  │
   └─────────────┘         └──────────────┘
        │                         │
        └────────────┬────────────┘
                     │
        ┌────────────▼────────────┐
        │ Return User or Error    │
        │                         │
        │ • 401 Invalid token     │
        │ • 403 Inactive user     │
        │ • 404 User not found    │
        │ • 200 User object       │
        └────────────┬────────────┘
                     │
                     ▼
        ┌────────────────────────────┐
        │ Endpoint Handler           │
        │ current_user = User object │
        │ → Process request...       │
        └────────────────────────────┘
```

## Security Features

✅ **JWT Signature Verification**
- Verify token signature (HS256)
- Detect tampering attempts

✅ **Token Expiration Check**
- Access token hết hạn 15 phút
- Reject expired tokens → 401

✅ **Bearer Scheme**
- Standard "Bearer {token}" format
- Reject malformed headers

✅ **Database Verification**
- Double-check user exists
- Check user active status
- Prevent deleted user access

✅ **WWW-Authenticate Header**
- 401 response include header
- Client biết need bearer token

⚠️ **Recommendations:**

```python
# 1. Add rate limiting
from slowapi import Limiter
limiter = Limiter(key_func=get_remote_address)

@app.get("/api/v1/me")
@limiter.limit("10/minute")
async def get_me(current_user: CurrentUser):
    ...

# 2. Add request ID tracing
from uuid import uuid4

@app.middleware("http")
async def add_request_id(request: Request, call_next):
    request.state.request_id = str(uuid4())
    ...

# 3. Add audit logging
import logging
logger = logging.getLogger(__name__)

async def get_current_user(...):
    logger.info(f"User {user.id} accessed protected resource")
    ...

# 4. Refresh token rotation
# (tự động issue token mới khi refresh)
# → Prevent token reuse attacks
```

## Complete Example - Protected Quiz API

```python
from .dependencies import CurrentUser
from .schemas import QuizCreate, QuizResponse

@app.post("/api/v1/quizzes", response_model=QuizResponse)
async def create_quiz(
    quiz_data: QuizCreate,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db)
):
    """
    Create new quiz (Protected).
    Only authenticated users can create quizzes.
    """
    quiz = Quiz(
        user_id=current_user.id,  # ← Auto set creator
        title=quiz_data.title,
        description=quiz_data.description,
        category=quiz_data.category,
    )
    db.add(quiz)
    await db.commit()
    await db.refresh(quiz)
    return quiz


@app.get("/api/v1/quizzes/{quiz_id}", response_model=QuizResponse)
async def get_quiz(
    quiz_id: int,
    current_user: CurrentUser,  # ← Still require auth
    db: AsyncSession = Depends(get_db)
):
    """Get quiz by ID (Protected)."""
    quiz = await db.get(Quiz, quiz_id)
    if not quiz:
        raise HTTPException(status_code=404, detail="Quiz not found")
    return quiz


@app.get("/api/v1/quizzes")
async def list_my_quizzes(
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db)
):
    """List all quizzes created by current user (Protected)."""
    result = await db.execute(
        select(Quiz).where(Quiz.user_id == current_user.id)
    )
    quizzes = result.scalars().all()
    return quizzes
```

## Integration Checklist

- ✅ Create `dependencies.py` with `get_current_user`
- ✅ Import `CurrentUser` type alias in endpoints
- ✅ Add to protected routes
- ✅ Test with Swagger UI
- ✅ Test error cases
- ✅ Document in API docs
- ⬜ Add to all protected endpoints
- ⬜ Add rate limiting
- ⬜ Add audit logging
