from pydantic import BaseModel
from typing import Optional


class FounderCreate(BaseModel):
    name: str
    linkedin_url: Optional[str] = None
    linkedin_connection_data: Optional[str] = None
    current_role: Optional[str] = None
    email: Optional[str] = None
    location: Optional[str] = None
    education: Optional[str] = None


class StartupCreate(BaseModel):
    startup_name: str
    website_url: Optional[str] = None
    stage: Optional[str] = None
    industry: Optional[str] = None
    fundraising_preference: Optional[str] = None
    one_sentence_description: Optional[str] = None
    pitch_deck_url: Optional[str] = None


class FounderStartupCreate(BaseModel):
    founder: FounderCreate
    startup: StartupCreate