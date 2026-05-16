from sqlalchemy import inspect, text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from .core.config import settings
from .models import Base

# Create engine using settings
engine = create_async_engine(settings.DATABASE_URL, echo=False, future=True)
AsyncSessionLocal = async_sessionmaker(bind=engine, expire_on_commit=False)

async def get_db() -> AsyncSession:
    async with AsyncSessionLocal() as session:
        yield session

async def init_db() -> None:
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        await conn.run_sync(_ensure_quiz_columns)

def _ensure_quiz_columns(sync_conn) -> None:
    inspector = inspect(sync_conn)
    if "quizzes" not in inspector.get_table_names():
        return

    columns = {column["name"] for column in inspector.get_columns("quizzes")}
    if "is_public" not in columns:
        sync_conn.execute(
            text("ALTER TABLE quizzes ADD COLUMN is_public BOOLEAN NOT NULL DEFAULT FALSE")
        )
