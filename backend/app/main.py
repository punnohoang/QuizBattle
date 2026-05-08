from fastapi import FastAPI

app = FastAPI(title="QuizBattle API")


@app.get("/")
async def root():
    return {"message": "QuizBattle API Running"}