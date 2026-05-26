from database import SessionLocal
from models import Founder, Startup, Investor
from matching import calculate_investor_score
from sqlalchemy import desc

db = SessionLocal()

print("\n===== Latte Investor Matching System =====\n")

# Founder Input
founder_name = input("Founder Name: ")
linkedin_url = input("LinkedIn URL: ")
current_role = input("Current Role: ")
email = input("Email: ")
location = input("Location: ")

# Startup Input
startup_name = input("Startup Name: ")
website_url = input("Website URL: ")
stage = input("Stage (Idea / Pre-seed / Seed / Series A / Growth / Scale): ")
industry = input("Industry: ")
fundraising_preference = input("Fundraising Preference: ")
description = input("One Sentence Startup Description: ")

# Save Founder
founder = Founder(
    name=founder_name,
    linkedin_url=linkedin_url,
    current_role=current_role,
    email=email,
    location=location
)

db.add(founder)
db.commit()
db.refresh(founder)

# Save Startup
startup = Startup(
    founder_id=founder.id,
    startup_name=startup_name,
    website_url=website_url,
    stage=stage,
    industry=industry,
    fundraising_preference=fundraising_preference,
    one_sentence_description=description
)

db.add(startup)
db.commit()
db.refresh(startup)

print("\nMatching investors...\n")

investors = db.query(Investor).all()
print(f"Total investors loaded: {len(investors)}")

results = []

for investor in investors:
    score_result = calculate_investor_score(startup, investor, founder=founder)
    score_raw = score_result.get("final_score_raw", score_result.get("final_score", 0))

    results.append({
        "investor_name": investor.entity_name,
        "investor_type": investor.investor_type,
        "location": investor.location_city,
        "score_raw": score_raw,
        "website": investor.website,
        "contact": investor.contact_1_name
    })

# Sort Results
results = sorted(results, key=lambda x: x["score_raw"], reverse=True)

print("\n===== TOP INVESTOR MATCHES =====\n")

top_results = results[:15]
top_score = top_results[0]["score_raw"] if top_results else 0

for i, result in enumerate(top_results, start=1):
    raw = result["score_raw"]
    scaled = round(100 * raw / top_score) if top_score else 0

    print(f"{i}. {result['investor_name']}")
    print(f"   Type: {result['investor_type']}")
    print(f"   Location: {result['location']}")
    print(f"   Score: {scaled} (raw: {raw})")
    print(f"   Website: {result['website']}")
    print(f"   Contact: {result['contact']}")
    print("")

print("Matching completed.\n")

db.close()