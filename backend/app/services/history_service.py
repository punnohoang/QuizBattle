from fastapi import HTTPException
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models import GameSession, Participant, PlayerAnswer, Question


class HistoryService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_user_history(self, user_id: int, limit: int = 5, played_page: int = 1, hosted_page: int = 1) -> dict:
        played_sessions, played_total = await self._get_played_sessions(user_id, limit, played_page)
        hosted_sessions, hosted_total = await self._get_hosted_sessions(user_id, limit, hosted_page)
        
        played_total_pages = (played_total + limit - 1) // limit if played_total > 0 else 1
        hosted_total_pages = (hosted_total + limit - 1) // limit if hosted_total > 0 else 1
        
        return {
            "played_sessions": played_sessions,
            "hosted_sessions": hosted_sessions,
            "played_pagination": {
                "total": played_total,
                "page": played_page,
                "limit": limit,
                "total_pages": played_total_pages,
            },
            "hosted_pagination": {
                "total": hosted_total,
                "page": hosted_page,
                "limit": limit,
                "total_pages": hosted_total_pages,
            },
        }

    async def get_played_session_detail(self, user_id: int, session_id: int) -> dict:
        result = await self.db.execute(
            select(Participant)
            .join(Participant.session)
            .options(
                selectinload(Participant.session).selectinload(GameSession.quiz),
                selectinload(Participant.session).selectinload(GameSession.host),
                selectinload(Participant.session).selectinload(GameSession.participants).selectinload(Participant.user),
                selectinload(Participant.answers).selectinload(PlayerAnswer.question).selectinload(Question.options),
                selectinload(Participant.answers).selectinload(PlayerAnswer.option),
            )
            .where(
                Participant.user_id == user_id,
                GameSession.id == session_id,
                GameSession.ended_at.is_not(None),
            )
        )
        participant = result.scalars().first()
        if not participant or not participant.session or not participant.session.quiz:
            raise HTTPException(status_code=404, detail="Played session not found")

        return self._build_played_session_detail(participant)

    async def _get_played_sessions(self, user_id: int, limit: int, page: int) -> tuple[list[dict], int]:
        # Get total count
        count_result = await self.db.execute(
            select(func.count(Participant.id))
            .join(Participant.session)
            .where(
                Participant.user_id == user_id,
                GameSession.ended_at.is_not(None),
            )
        )
        total = count_result.scalar() or 0
        
        # Calculate offset
        offset = (page - 1) * limit
        
        result = await self.db.execute(
            select(Participant)
            .join(Participant.session)
            .options(
                selectinload(Participant.session).selectinload(GameSession.quiz),
                selectinload(Participant.session).selectinload(GameSession.host),
                selectinload(Participant.session).selectinload(GameSession.participants).selectinload(Participant.user),
                selectinload(Participant.answers),
            )
            .where(
                Participant.user_id == user_id,
                GameSession.ended_at.is_not(None),
            )
            .order_by(GameSession.ended_at.desc())
            .offset(offset)
            .limit(limit)
        )
        participants = result.scalars().all()

        history: list[dict] = []
        for participant in participants:
            session = participant.session
            if not session or not session.quiz:
                continue

            ordered_answers = list(participant.answers)
            correct_count = sum(1 for answer in ordered_answers if answer.is_correct)
            answered_questions = len(ordered_answers)
            wrong_count = answered_questions - correct_count
            total_questions = int(session.quiz.question_count or 0)
            total_response_time = sum(int(answer.response_time or 0) for answer in ordered_answers)
            accuracy = (correct_count / answered_questions * 100) if answered_questions else 0.0
            avg_response_time_ms = (total_response_time / answered_questions) if answered_questions else 0.0

            history.append({
                "session_id": session.id,
                "room_code": session.room_code,
                "quiz_id": session.quiz.id,
                "quiz_title": session.quiz.title,
                "host_username": getattr(session.host, "username", ""),
                "started_at": session.started_at,
                "ended_at": session.ended_at,
                "total_questions": total_questions,
                "answered_questions": answered_questions,
                "correct_answers": correct_count,
                "wrong_answers": wrong_count,
                "accuracy_percentage": round(accuracy, 2),
                "average_response_time_ms": round(avg_response_time_ms, 2),
                "average_response_time_seconds": round(avg_response_time_ms / 1000.0, 2),
                "top_players": self._build_leaderboard_for_session(session),
            })

        return history, total

    def _build_played_session_detail(self, participant: Participant) -> dict:
        session = participant.session
        assert session and session.quiz

        questions = []
        ordered_answers = sorted(
            participant.answers,
            key=lambda answer: getattr(answer.question, "order_index", 0),
        )

        correct_count = 0
        total_response_time = 0

        for answer in ordered_answers:
            question = answer.question
            if not question:
                continue

            selected_options = []
            if answer.option:
                selected_options = [{"id": answer.option.id, "content": answer.option.content}]

            correct_options = [
                {"id": option.id, "content": option.content}
                for option in question.options
                if option.is_correct
            ]

            if answer.is_correct:
                correct_count += 1

            total_response_time += answer.response_time

            questions.append({
                "question_id": question.id,
                "question_order_index": question.order_index,
                "question_content": question.content,
                "question_type": str(question.type.value if hasattr(question.type, "value") else question.type),
                "selected_option_ids": [answer.option.id] if answer.option else [],
                "selected_options": selected_options,
                "correct_option_ids": [option.id for option in question.options if option.is_correct],
                "correct_options": correct_options,
                "is_correct": bool(answer.is_correct),
                "score_earned": int(answer.score_earned or 0),
                "response_time_ms": int(answer.response_time or 0),
                "response_time_seconds": round((answer.response_time or 0) / 1000.0, 2),
            })

        answered_questions = len(questions)
        wrong_count = answered_questions - correct_count
        total_questions = int(session.quiz.question_count or 0)
        accuracy = (correct_count / answered_questions * 100) if answered_questions else 0.0
        avg_response_time_ms = (total_response_time / answered_questions) if answered_questions else 0.0

        return {
            "session_id": session.id,
            "room_code": session.room_code,
            "quiz_id": session.quiz.id,
            "quiz_title": session.quiz.title,
            "host_username": getattr(session.host, "username", ""),
            "started_at": session.started_at,
            "ended_at": session.ended_at,
            "total_questions": total_questions,
            "answered_questions": answered_questions,
            "correct_answers": correct_count,
            "wrong_answers": wrong_count,
            "accuracy_percentage": round(accuracy, 2),
            "average_response_time_ms": round(avg_response_time_ms, 2),
            "average_response_time_seconds": round(avg_response_time_ms / 1000.0, 2),
            "top_players": self._build_leaderboard_for_session(session),
            "questions": questions,
        }

    async def _get_hosted_sessions(self, user_id: int, limit: int, page: int) -> tuple[list[dict], int]:
        # Get total count
        count_result = await self.db.execute(
            select(func.count(GameSession.id))
            .where(
                GameSession.host_id == user_id,
                GameSession.ended_at.is_not(None),
            )
        )
        total = count_result.scalar() or 0
        
        # Calculate offset
        offset = (page - 1) * limit
        
        result = await self.db.execute(
            select(GameSession)
            .options(
                selectinload(GameSession.quiz),
                selectinload(GameSession.participants).selectinload(Participant.answers),
                selectinload(GameSession.participants).selectinload(Participant.user),
            )
            .where(
                GameSession.host_id == user_id,
                GameSession.ended_at.is_not(None),
            )
            .order_by(GameSession.ended_at.desc())
            .offset(offset)
            .limit(limit)
        )
        sessions = result.scalars().all()

        history: list[dict] = []
        for session in sessions:
            if not session.quiz:
                continue

            total_answers = 0
            correct_answers = 0
            total_response_time = 0
            participants_summary: list[dict] = []

            for participant in session.participants:
                participant_answers = list(participant.answers)
                participant_total = len(participant_answers)
                participant_correct = sum(1 for answer in participant_answers if answer.is_correct)
                participant_wrong = participant_total - participant_correct
                participant_accuracy = (participant_correct / participant_total * 100) if participant_total else 0.0

                participants_summary.append({
                    "user_id": participant.user_id,
                    "username": getattr(participant.user, "username", participant.nickname),
                    "total_score": int(participant.total_score or 0),
                    "correct_answers": participant_correct,
                    "wrong_answers": participant_wrong,
                    "accuracy_percentage": round(participant_accuracy, 2),
                })

                total_answers += participant_total
                correct_answers += participant_correct
                total_response_time += sum(int(answer.response_time or 0) for answer in participant_answers)

            wrong_answers = total_answers - correct_answers
            correct_rate = (correct_answers / total_answers * 100) if total_answers else 0.0
            wrong_rate = (wrong_answers / total_answers * 100) if total_answers else 0.0
            avg_response_time_ms = (total_response_time / total_answers) if total_answers else 0.0

            history.append({
                "session_id": session.id,
                "room_code": session.room_code,
                "quiz_id": session.quiz.id,
                "quiz_title": session.quiz.title,
                "started_at": session.started_at,
                "ended_at": session.ended_at,
                "participant_count": len(session.participants),
                "total_answers": total_answers,
                "correct_answers": correct_answers,
                "wrong_answers": wrong_answers,
                "correct_rate": round(correct_rate, 2),
                "wrong_rate": round(wrong_rate, 2),
                "average_response_time_ms": round(avg_response_time_ms, 2),
                "average_response_time_seconds": round(avg_response_time_ms / 1000.0, 2),
                "top_players": sorted(
                    participants_summary,
                    key=lambda item: item["total_score"],
                    reverse=True,
                )[:3],
            })

        return history, total

    @staticmethod
    def _build_leaderboard_for_session(session: GameSession) -> list[dict]:
        leaderboard: list[dict] = []
        for participant in session.participants:
            leaderboard.append({
                "user_id": participant.user_id,
                "username": getattr(participant.user, "username", participant.nickname),
                "score": int(participant.total_score or 0),
            })

        leaderboard.sort(key=lambda entry: entry["score"], reverse=True)
        return leaderboard[:3]
