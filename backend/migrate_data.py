#!/usr/bin/env python3
"""
Database migration script to create schema and seed test data.
Run this script to initialize the database with test data.
"""

import asyncio
import os
from datetime import datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

# Import models
import bcrypt
from app.db import AsyncSessionLocal, engine, _ensure_quiz_columns
from app.models import (
    Base, Role, User, RoleUser, Quiz, Question, Option,
    GameSession, Participant, PlayerAnswer
)


def hash_password(password: str) -> str:
    """Hash password using bcrypt."""
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


async def create_tables() -> None:
    """Create all database tables."""
    print("Creating tables...")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        await conn.run_sync(_ensure_quiz_columns)
    print("✓ Tables created successfully")


async def seed_roles(db: AsyncSession) -> dict[str, Role]:
    """Create default roles."""
    print("\nSeeding roles...")
    
    roles_data = [
        {"role": "admin"},
        {"role": "user"},
        {"role": "moderator"},
    ]
    
    roles = {}
    for role_data in roles_data:
        existing = await db.execute(
            select(Role).where(Role.role == role_data["role"])
        )
        role = existing.scalar_one_or_none()
        
        if not role:
            role = Role(**role_data)
            db.add(role)
            print(f"  + Created role: {role_data['role']}")
        else:
            print(f"  ✓ Role already exists: {role_data['role']}")
        
        roles[role_data["role"]] = role
    
    await db.commit()
    return roles


async def seed_users(db: AsyncSession, roles: dict[str, Role]) -> dict[str, User]:
    """Create test users."""
    print("\nSeeding users...")
    
    users_data = [
        {
            "username": "admin",
            "email": "admin@example.com",
            "password": "admin123",
            "roles": ["admin", "user"]
        },
        {
            "username": "testuser1",
            "email": "testuser1@example.com",
            "password": "password123",
            "roles": ["user"]
        },
        {
            "username": "testuser2",
            "email": "testuser2@example.com",
            "password": "password123",
            "roles": ["user"]
        },
        {
            "username": "moderator",
            "email": "moderator@example.com",
            "password": "password123",
            "roles": ["moderator", "user"]
        },
    ]
    
    users = {}
    for user_data in users_data:
        existing = await db.execute(
            select(User).where(User.username == user_data["username"])
        )
        user = existing.scalar_one_or_none()
        
        if not user:
            hashed_pwd = hash_password(user_data["password"])
            user = User(
                username=user_data["username"],
                email=user_data["email"],
                password=hashed_pwd,
                is_active=True,
            )
            db.add(user)
            await db.flush()  # Get the ID
            
            # Assign roles
            for role_name in user_data.get("roles", ["user"]):
                role = roles[role_name]
                role_user = RoleUser(user_id=user.id, role_id=role.id)
                db.add(role_user)
            
            print(f"  + Created user: {user_data['username']}")
        else:
            print(f"  ✓ User already exists: {user_data['username']}")
        
        users[user_data["username"]] = user
    
    await db.commit()
    return users


async def seed_quizzes(db: AsyncSession, users: dict[str, User]) -> dict[str, Quiz]:
    """Create test quizzes."""
    print("\nSeeding quizzes...")
    
    quizzes_data = [
        {
            "user_id": "admin",
            "title": "General Knowledge",
            "description": "Test your knowledge on various topics",
            "category": "General",
            "questions": [
                {
                    "content": "What is the capital of France?",
                    "type": "MTC",
                    "score_type": "normal",
                    "time_limit": 30,
                    "options": [
                        {"content": "Paris", "is_correct": True},
                        {"content": "London", "is_correct": False},
                        {"content": "Berlin", "is_correct": False},
                        {"content": "Madrid", "is_correct": False},
                    ]
                },
                {
                    "content": "What is 2 + 2?",
                    "type": "MTC",
                    "score_type": "normal",
                    "time_limit": 20,
                    "options": [
                        {"content": "3", "is_correct": False},
                        {"content": "4", "is_correct": True},
                        {"content": "5", "is_correct": False},
                        {"content": "6", "is_correct": False},
                    ]
                },
            ]
        },
        {
            "user_id": "testuser1",
            "title": "Science Basics",
            "description": "Basic science questions",
            "category": "Science",
            "questions": [
                {
                    "content": "What is the chemical symbol for Gold?",
                    "type": "MTC",
                    "score_type": "normal",
                    "time_limit": 30,
                    "options": [
                        {"content": "Gd", "is_correct": False},
                        {"content": "Go", "is_correct": False},
                        {"content": "Au", "is_correct": True},
                        {"content": "Ag", "is_correct": False},
                    ]
                },
            ]
        },
        {
            "user_id": "testuser2",
            "title": "History Quiz",
            "description": "Historical events and figures",
            "category": "History",
            "questions": [
                {
                    "content": "In what year did World War II end?",
                    "type": "MTC",
                    "score_type": "normal",
                    "time_limit": 30,
                    "options": [
                        {"content": "1943", "is_correct": False},
                        {"content": "1944", "is_correct": False},
                        {"content": "1945", "is_correct": True},
                        {"content": "1946", "is_correct": False},
                    ]
                },
            ]
        },
    ]
    
    quizzes = {}
    for quiz_data in quizzes_data:
        user = users[quiz_data["user_id"]]
        
        # Check if quiz already exists
        existing = await db.execute(
            select(Quiz).where(
                (Quiz.user_id == user.id) & (Quiz.title == quiz_data["title"])
            )
        )
        quiz = existing.scalar_one_or_none()
        
        if not quiz:
            quiz = Quiz(
                user_id=user.id,
                title=quiz_data["title"],
                description=quiz_data["description"],
                category=quiz_data["category"],
                question_count=len(quiz_data["questions"]),
                is_deleted=False,
                is_public=False,
            )
            db.add(quiz)
            await db.flush()
            
            # Add questions
            for q_idx, question_data in enumerate(quiz_data["questions"]):
                question = Question(
                    quiz_id=quiz.id,
                    content=question_data["content"],
                    type=question_data["type"],
                    score_type=question_data["score_type"],
                    time_limit=question_data["time_limit"],
                    order_index=q_idx,
                )
                db.add(question)
                await db.flush()
                
                # Add options
                for opt_idx, option_data in enumerate(question_data["options"]):
                    option = Option(
                        question_id=question.id,
                        content=option_data["content"],
                        is_correct=option_data["is_correct"],
                        order_index=opt_idx,
                    )
                    db.add(option)
            
            print(f"  + Created quiz: {quiz_data['title']}")
        else:
            print(f"  ✓ Quiz already exists: {quiz_data['title']}")
        
        quizzes[quiz_data["title"]] = quiz
    
    await db.commit()
    return quizzes


async def seed_game_sessions(db: AsyncSession, users: dict[str, User], quizzes: dict[str, Quiz]) -> None:
    """Create test game sessions (optional, for testing)."""
    print("\nSeeding game sessions...")
    
    # Get first quiz
    quiz = list(quizzes.values())[0]
    user = list(users.values())[1]  # testuser1
    
    existing = await db.execute(
        select(GameSession).where(
            (GameSession.quiz_id == quiz.id) & (GameSession.host_id == user.id)
        )
    )
    session = existing.scalar_one_or_none()
    
    if not session:
        session = GameSession(
            host_id=user.id,
            quiz_id=quiz.id,
            room_code="TEST123",
            status="completed",
        )
        db.add(session)
        await db.flush()
        
        # Add participants
        participant = Participant(
            session_id=session.id,
            user_id=users["testuser2"].id,
            nickname="Test Player 2",
        )
        db.add(participant)
        
        print(f"  + Created game session: {session.room_code}")
    else:
        print(f"  ✓ Game session already exists: {session.room_code}")
    
    await db.commit()


async def main() -> None:
    """Run all migrations."""
    print("=" * 60)
    print("QuizBattle Database Migration")
    print("=" * 60)
    
    # Create tables
    await create_tables()
    
    # Create a database session
    async with AsyncSessionLocal() as db:
        try:
            # Seed data
            roles = await seed_roles(db)
            users = await seed_users(db, roles)
            quizzes = await seed_quizzes(db, users)
            await seed_game_sessions(db, users, quizzes)
            
            print("\n" + "=" * 60)
            print("✓ Database migration completed successfully!")
            print("=" * 60)
            
            # Print summary
            print("\nTest Accounts:")
            print("  admin / admin123")
            print("  testuser1 / password123")
            print("  testuser2 / password123")
            print("  moderator / password123")
            
        except Exception as e:
            print(f"\n✗ Error during migration: {e}")
            raise
        finally:
            await db.close()


if __name__ == "__main__":
    asyncio.run(main())
