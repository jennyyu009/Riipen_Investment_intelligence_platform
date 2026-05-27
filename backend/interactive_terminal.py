import os
import sys

from backend.database import SessionLocal
from backend.models import Founder, Startup, Investor
from backend.matching import calculate_investor_score
from sqlalchemy import desc
from backend.relationship_intelligence.relationship_intelligence import run_relationship_intelligence

db = SessionLocal()

try:
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
            "contact": investor.contact_1_name,

            "city": investor.location_city,
            "country": investor.hq_country,

            "contact_1_name": investor.contact_1_name,
            "contact_1_title": investor.contact_1_designation,
            "contact_1_linkedin": investor.contact_1_linkedin,

            "contact_2_name": investor.contact_2_name,
            "contact_2_title": investor.contact_2_designation,
            "contact_2_linkedin": investor.contact_2_linkedin,
        })

    # Sort Results
    results = sorted(results, key=lambda x: x["score_raw"], reverse=True)

    print("\n===== TOP INVESTOR MATCHES =====\n")

    top_results = results[:15]
    top_score = top_results[0]["score_raw"] if top_results else 0

    for i, result in enumerate(top_results, start=1):
        raw = result["score_raw"]
        scaled = round(100 * raw / top_score) if top_score else 0
        result["matching_score"] = scaled

        print(f"{i}. {result['investor_name']}")
        print(f"   Type: {result['investor_type']}")
        print(f"   Location: {result['location']}")
        print(f"   Score: {scaled} (raw: {raw})")
        print(f"   Website: {result['website']}")
        print(f"   Contact: {result['contact']}")
        print("")

    # Relationship Intelligence
    relationship_csv_default = os.path.join(
        os.path.dirname(__file__),
        "relationship_intelligence",
        "relationship_intelligence",
        "Connections.csv",
    )
    relationship_csv_path = input(
        f"Enter LinkedIn Connections CSV path for Relationship Intelligence [default: {relationship_csv_default}] (leave blank to use default): "
    ).strip()
    if not relationship_csv_path:
        relationship_csv_path = relationship_csv_default

    messages_csv_default = os.path.join(
        os.path.dirname(__file__),
        "relationship_intelligence",
        "relationship_intelligence",
        "messages.csv",
    )
    messages_csv_path = input(
        f"Enter messages CSV path for Relationship Intelligence [default: {messages_csv_default}] (leave blank to use default if present): "
    ).strip()
    if not messages_csv_path:
        messages_csv_path = messages_csv_default if os.path.exists(messages_csv_default) else None
    elif not os.path.exists(messages_csv_path):
        print(f"Messages CSV not found at: {messages_csv_path}. Continuing without messages.csv.\n")
        messages_csv_path = None

    if os.path.exists(relationship_csv_path):
        founder_data = {
            "name": founder_name,
            "linkedin_url": linkedin_url,
            "email": email,
        }

        relationship_results = run_relationship_intelligence(
            founder_data=founder_data,
            top_investors=top_results,
            connections_csv_path=relationship_csv_path,
            messages_csv_path=messages_csv_path,
        )

        print("\n===== RELATIONSHIP INTELLIGENCE PATHS =====\n")

        displayed_entries = [
            entry for entry in relationship_results.get("results", [])
            if entry.get("paths")
        ]

        if not displayed_entries:
            print("No verified warm intro paths found for the current top 15 investors.\n")

        for i, entry in enumerate(displayed_entries, start=1):
            print(f"{i}. {entry['investor_name']}")
            if entry.get("matching_score") is not None:
                print(f"   Matching Score: {entry['matching_score']}")
            else:
                print("   Matching Score: N/A")

            for path_index, path in enumerate(entry["paths"], start=1):
                path_text = " -> ".join(path["path"])
                print(f"\n   Path {path_index}: {path_text}")
                print(f"   Hops: {path['hops']}")
                print(f"   Relationship Score: {path['relationship_score']}")
                print(f"   Match Type: {path.get('match_type', 'relationship path')}")
                print(f"   Confidence: {path.get('confidence', 'verified')}")
                if path.get("evidence"):
                    print("   Evidence:")
                    for evidence in path.get("evidence", []):
                        print(f"   - {evidence}")
            print("")

        diagnostics = relationship_results.get("diagnostics", {})
        print(
            "Checked investors: "
            f"{diagnostics.get('investors_checked', 0)}\n"
            "Checked LinkedIn connections: "
            f"{diagnostics.get('connections_loaded', 0)}\n"
            "Verified direct contact matches: "
            f"{diagnostics.get('verified_direct_contact_matches', 0)}\n"
            "Rejected weak identity matches: "
            f"{diagnostics.get('rejected_weak_identity_matches', 0)}\n"
            "Verified firm relationship matches: "
            f"{diagnostics.get('verified_firm_relationship_matches', 0)}\n"
            "Rejected generic firm matches: "
            f"{diagnostics.get('rejected_firm_matches', 0)}\n"
            "Investors with paths displayed: "
            f"{len(displayed_entries)}\n"
        )

        if relationship_results.get("errors"):
            print("Relationship Intelligence diagnostics:")
            for error in relationship_results["errors"]:
                print(f"   - {error}")
            print("")
    else:
        print(
            f"\nRelationship Intelligence CSV not found at: {relationship_csv_path}\n"
            "Skipping relationship intelligence output.\n"
        )

    print("Matching completed.\n")

except (KeyboardInterrupt, EOFError):
    print("\nInput cancelled or unavailable. Exiting.")
finally:
    db.close()
