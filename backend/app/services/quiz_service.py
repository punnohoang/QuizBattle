from fastapi import HTTPException
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models import Option, Question, Quiz
from app.schemas.quiz import (
    PublicQuizResponse,
    QuestionCreate,
    QuestionUpdate,
    QuizCreate,
    QuizUpdate,
)


class QuizService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def create_quiz(self, user_id: int, payload: QuizCreate) -> Quiz:
        quiz = Quiz(
            user_id=user_id,
            title=payload.title,
            description=payload.description,
            category=payload.category,
            is_public=payload.is_public,
        )
        self.db.add(quiz)
        await self.db.commit()
        await self.db.refresh(quiz)
        return quiz

    async def get_quizzes(
        self,
        user_id: int,
        skip: int,
        limit: int,
        category: str | None = None,
    ) -> list[Quiz]:
        query = select(Quiz).where(
            Quiz.user_id == user_id,
            Quiz.is_deleted == False,
        )

        if category:
            query = query.where(Quiz.category == category)

        query = query.offset(skip).limit(limit)
        result = await self.db.execute(query)
        return result.scalars().all()

    async def get_public_quizzes(
        self,
        skip: int,
        limit: int,
        category: str | None = None,
    ) -> list[Quiz]:
        query = select(Quiz).options(selectinload(Quiz.user)).where(
            Quiz.is_public == True,
            Quiz.is_deleted == False,
        )

        if category:
            query = query.where(Quiz.category == category)

        query = query.order_by(Quiz.created_at.desc()).offset(skip).limit(limit)
        result = await self.db.execute(query)
        return result.scalars().all()

    async def get_quiz(self, user_id: int, quiz_id: int) -> Quiz:
        result = await self.db.execute(
            select(Quiz)
            .options(selectinload(Quiz.questions).selectinload(Question.options))
            .where(
                Quiz.id == quiz_id,
                Quiz.user_id == user_id,
                Quiz.is_deleted == False,
            )
        )
        quiz = result.scalar_one_or_none()

        if not quiz:
            raise HTTPException(status_code=404, detail="Quiz not found")

        return quiz

    async def clone_public_quiz(self, user_id: int, quiz_id: int) -> Quiz:
        result = await self.db.execute(
            select(Quiz)
            .options(selectinload(Quiz.questions).selectinload(Question.options))
            .where(
                Quiz.id == quiz_id,
                Quiz.is_deleted == False,
                or_(Quiz.user_id == user_id, Quiz.is_public == True),
            )
        )
        source_quiz = result.scalar_one_or_none()

        if not source_quiz:
            raise HTTPException(status_code=404, detail="Quiz not found")

        cloned_quiz = Quiz(
            user_id=user_id,
            title=source_quiz.title,
            description=source_quiz.description,
            category=source_quiz.category,
            question_count=source_quiz.question_count,
            is_deleted=False,
            is_public=False,
        )

        for source_question in source_quiz.questions:
            cloned_question = Question(
                content=source_question.content,
                type=source_question.type,
                score_type=source_question.score_type,
                time_limit=source_question.time_limit,
                order_index=source_question.order_index,
            )

            for source_option in source_question.options:
                cloned_question.options.append(
                    Option(
                        content=source_option.content,
                        is_correct=source_option.is_correct,
                        order_index=source_option.order_index,
                    )
                )

            cloned_quiz.questions.append(cloned_question)

        self.db.add(cloned_quiz)
        await self.db.commit()
        await self.db.refresh(cloned_quiz)
        return cloned_quiz

    async def update_quiz(self, user_id: int, quiz_id: int, payload: QuizUpdate) -> Quiz:
        quiz = await self.get_quiz(user_id, quiz_id)

        if payload.title is not None:
            quiz.title = payload.title
        if payload.description is not None:
            quiz.description = payload.description
        if payload.category is not None:
            quiz.category = payload.category
        if payload.is_public is not None:
            quiz.is_public = payload.is_public

        await self.db.commit()
        await self.db.refresh(quiz)
        return quiz

    async def delete_quiz(self, user_id: int, quiz_id: int) -> None:
        result = await self.db.execute(
            select(Quiz).where(
                Quiz.id == quiz_id,
                Quiz.user_id == user_id,
            )
        )
        quiz = result.scalar_one_or_none()

        if not quiz:
            raise HTTPException(status_code=404, detail="Quiz not found")

        quiz.is_deleted = True
        await self.db.commit()

    async def create_question(
        self,
        user_id: int,
        quiz_id: int,
        payload: QuestionCreate,
    ) -> Question:
        quiz = await self.get_quiz(user_id, quiz_id)

        question = Question(
            quiz_id=quiz_id,
            content=payload.content,
            type=payload.type,
            score_type=payload.score_type,
            time_limit=payload.time_limit,
            order_index=payload.order_index,
        )

        for option_data in payload.options:
            question.options.append(
                Option(
                    content=option_data.content,
                    is_correct=option_data.is_correct,
                    order_index=option_data.order_index,
                )
            )

        self.db.add(question)
        quiz.question_count += 1
        await self.db.commit()
        await self.db.refresh(question)
        return question

    async def get_questions(self, user_id: int, quiz_id: int) -> list[Question]:
        await self.get_quiz(user_id, quiz_id)

        result = await self.db.execute(
            select(Question)
            .options(selectinload(Question.options))
            .where(Question.quiz_id == quiz_id)
            .order_by(Question.order_index)
        )
        return result.scalars().all()

    async def update_question(
        self,
        user_id: int,
        quiz_id: int,
        question_id: int,
        payload: QuestionUpdate,
    ) -> Question:
        await self.get_quiz(user_id, quiz_id)

        result = await self.db.execute(
            select(Question)
            .options(selectinload(Question.options))
            .where(
                Question.id == question_id,
                Question.quiz_id == quiz_id,
            )
        )
        question = result.scalar_one_or_none()

        if not question:
            raise HTTPException(status_code=404, detail="Question not found")

        if payload.content is not None:
            question.content = payload.content
        if payload.type is not None:
            question.type = payload.type
        if payload.score_type is not None:
            question.score_type = payload.score_type
        if payload.time_limit is not None:
            question.time_limit = payload.time_limit
        if payload.order_index is not None:
            question.order_index = payload.order_index

        if payload.options is not None:
            question.options.clear()
            for option_data in payload.options:
                question.options.append(
                    Option(
                        content=option_data.content,
                        is_correct=option_data.is_correct,
                        order_index=option_data.order_index,
                    )
                )

        await self.db.commit()
        await self.db.refresh(question)
        return question

    async def delete_question(self, user_id: int, quiz_id: int, question_id: int) -> None:
        quiz = await self.get_quiz(user_id, quiz_id)

        result = await self.db.execute(
            select(Question).where(
                Question.id == question_id,
                Question.quiz_id == quiz_id,
            )
        )
        question = result.scalar_one_or_none()

        if not question:
            raise HTTPException(status_code=404, detail="Question not found")

        await self.db.delete(question)
        quiz.question_count = max(0, quiz.question_count - 1)
        await self.db.commit()