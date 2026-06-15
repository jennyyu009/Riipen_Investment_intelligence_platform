from sqlalchemy import Column, Integer, String, Text, Float, DateTime, ForeignKey
from sqlalchemy.sql import func

try:
    from .database import Base
except ImportError:
    from database import Base


class Founder(Base):
    __tablename__ = "founders"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    linkedin_url = Column(Text)
    linkedin_connection_data = Column(Text)
    current_role = Column(String)
    email = Column(String)
    location = Column(String)
    education = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class Startup(Base):
    __tablename__ = "startups"

    id = Column(Integer, primary_key=True, index=True)
    founder_id = Column(Integer, ForeignKey("founders.id"))
    startup_name = Column(String, nullable=False)
    website_url = Column(Text)
    stage = Column(String)
    industry = Column(String)
    fundraising_preference = Column(Text)
    one_sentence_description = Column(Text)
    pitch_deck_url = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class Investor(Base):
    __tablename__ = "investors"

    id = Column(Integer, primary_key=True, index=True)

    entity_name = Column(String)
    description = Column(Text)
    investor_type = Column(String)
    hq_country = Column(String)
    location_city = Column(String)
    focus_industries = Column(Text)
    focus_stages = Column(Text)
    focus_geographies = Column(Text)
    company_linkedin = Column(Text)
    website = Column(Text)
    twitter_url = Column(Text)
    crunchbase_url = Column(Text)
    region = Column(String)
    enrichment_status = Column(String)
    enriched_at = Column(DateTime(timezone=True))

    contact_1_name = Column(String)
    contact_1_designation = Column(String)
    contact_1_email = Column(String)
    contact_1_linkedin = Column(Text)

    contact_2_name = Column(String)
    contact_2_designation = Column(String)
    contact_2_email = Column(String)
    contact_2_linkedin = Column(Text)

    created_at = Column(DateTime(timezone=True), server_default=func.now())


class InvestorMatch(Base):
    __tablename__ = "investor_matches"

    id = Column(Integer, primary_key=True, index=True)

    founder_id = Column(Integer, ForeignKey("founders.id"))
    startup_id = Column(Integer, ForeignKey("startups.id"))
    investor_id = Column(Integer, ForeignKey("investors.id"))

    final_score = Column(Float)
    industry_score = Column(Float)
    location_score = Column(Float)
    fundraising_score = Column(Float)
    stage_score = Column(Float)
    linkedin_score = Column(Float)
    linkedin_matched_count = Column(Integer)
    linkedin_contribution = Column(Float)
    linkedin_matches = Column(Text)
    team_score = Column(Float)

    match_reason = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
