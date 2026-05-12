from pydantic import BaseModel, Field


class RoomCreateRequest(BaseModel):
    quiz_id: int = Field(..., gt=0)


class RoomResponse(BaseModel):
    id: int
    room_code: str
    status: str

    class Config:
        from_attributes = True


class RoomAccessResponse(BaseModel):
    room_id: int
    room_code: str
    status: str
    is_host: bool
