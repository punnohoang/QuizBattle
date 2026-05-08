# QuizBattle Platform

Realtime multiplayer quiz platform built with:

- FastAPI
- Next.js 14
- PostgreSQL
- Redis
- WebSocket

## Project Structure

- backend/
- frontend/
- docs/

## Prerequisites

- Miniconda/Conda
- Node.js 18+
- Docker + docker-compose (optional, for full stack)

## Quick Start (Local, no Docker)

### Backend (FastAPI)

1) Create and activate Conda env:

- conda create -n quizbattle python=3.11 -y
- conda activate quizbattle

2) Install dependencies:

- cd backend
- pip install -r requirements.txt

3) Run API:

- uvicorn app.main:app --reload

API will be at http://localhost:8000

### Frontend (Next.js)

1) Install dependencies:

- cd frontend
- npm install

2) Run dev server:

- npm run dev

App will be at http://localhost:3000

## Run

```bash
docker-compose up --build
