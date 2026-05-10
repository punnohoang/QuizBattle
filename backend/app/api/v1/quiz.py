from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import CurrentUser
from app.db import get_db
from app.schemas.quiz import (
    QuizCreate,
    QuizUpdate,
    QuizResponse,
    QuizDetailResponse,
    QuestionCreate,
    QuestionUpdate,
    QuestionResponse,
)
from app.services.quiz_service import QuizService

router = APIRouter(prefix="/quizzes", tags=["quiz"])


@router.post("", response_model=QuizResponse, status_code=status.HTTP_201_CREATED)
async def create_quiz(
    payload: QuizCreate,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
) -> QuizResponse:
    """Create a new quiz."""
    service = QuizService(db)
    return await service.create_quiz(current_user.id, payload)


@router.get("", response_model=list[QuizResponse])
async def get_quizzes(
    current_user: CurrentUser,
    skip: int = Query(0, ge=0),
    limit: int = Query(10, ge=1, le=100),
    category: str | None = None,
    db: AsyncSession = Depends(get_db),
) -> list[QuizResponse]:
    """Get user's quizzes with pagination."""
    service = QuizService(db)
    return await service.get_quizzes(current_user.id, skip, limit, category)


@router.get("/{quiz_id}", response_model=QuizDetailResponse)
async def get_quiz(
    quiz_id: int,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
) -> QuizDetailResponse:
    """Get a specific quiz with all questions and options."""
    service = QuizService(db)
    return await service.get_quiz(current_user.id, quiz_id)


@router.put("/{quiz_id}", response_model=QuizResponse)
async def update_quiz(
    quiz_id: int,
    payload: QuizUpdate,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
) -> QuizResponse:
    """Update quiz information."""
    service = QuizService(db)
    return await service.update_quiz(current_user.id, quiz_id, payload)


@router.delete("/{quiz_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_quiz(
    quiz_id: int,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
) -> None:
    """Soft delete a quiz."""
    service = QuizService(db)
    await service.delete_quiz(current_user.id, quiz_id)


# Question CRUD operations
@router.post("/{quiz_id}/questions", response_model=QuestionResponse, status_code=status.HTTP_201_CREATED)
async def create_question(
    quiz_id: int,
    payload: QuestionCreate,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
) -> QuestionResponse:
    """Add a question to a quiz."""
    service = QuizService(db)
    return await service.create_question(current_user.id, quiz_id, payload)


@router.get("/{quiz_id}/questions", response_model=list[QuestionResponse])
async def get_questions(
    quiz_id: int,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
) -> list[QuestionResponse]:
    """Get all questions for a quiz."""
    service = QuizService(db)
    return await service.get_questions(current_user.id, quiz_id)


@router.put("/{quiz_id}/questions/{question_id}", response_model=QuestionResponse)
async def update_question(
    quiz_id: int,
    question_id: int,
    payload: QuestionUpdate,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
) -> QuestionResponse:
    """Update a question."""
    service = QuizService(db)
    return await service.update_question(current_user.id, quiz_id, question_id, payload)


@router.delete("/{quiz_id}/questions/{question_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_question(
    quiz_id: int,
    question_id: int,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
) -> None:
    """Delete a question from a quiz."""
    service = QuizService(db)
    await service.delete_question(current_user.id, quiz_id, question_id)
