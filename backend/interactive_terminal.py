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

    if os.path.exists(relationship_csv_path):
        founder_data = {
            "name": founder_name,
            "linkedin": linkedin_url,
            "title": current_role,
            "email": email,
            "location": location,
        }

        top_investor_profiles = [
            {
                "investor_name": r["investor_name"],
                "contact_1_name": r["contact_1_name"],
                "contact_1_title": r["contact_1_title"],
                "contact_1_linkedin": r["contact_1_linkedin"],
                "contact_2_name": r["contact_2_name"],
                "contact_2_title": r["contact_2_title"],
                "contact_2_linkedin": r["contact_2_linkedin"],
            }
            for r in top_results
        ]

        relationship_result = run_relationship_intelligence(
            founder_data,
            top_investor_profiles,
            connections_csv_path=relationship_csv_path,
        )

        print("\n===== RELATIONSHIP INTELLIGENCE =====\n")

        relationship_matches = [
            entry for entry in relationship_result.get("results", [])
            if entry.get("paths")
        ]

        if relationship_matches:
            for entry in relationship_matches:
                best_path = entry["paths"][0]
                path_text = " -> ".join(best_path["path"])
                print(f"{entry['investor_name']}")
                print(f"   Path: {path_text}")
                print(f"   Relationship Score: {best_path['relationship_score']}")
                print(f"   Match Type: {best_path.get('match_type', 'relationship path')}")
                if best_path.get("contact_title"):
                    print(f"   Contact Title: {best_path['contact_title']}")
                if best_path.get("connected_on"):
                    print(f"   Connected On: {best_path['connected_on']}")
                print("")
        else:
            print("No verified warm intro path found.\n")
            diagnostics = relationship_result.get("diagnostics", {})
            print(
                "Checked "
                f"{diagnostics.get('contacts_checked', 0)} investor contacts, "
                f"{diagnostics.get('investor_firms_checked', 0)} investor firm names, "
                f"{diagnostics.get('connection_companies_checked', 0)} LinkedIn connection companies, "
                f"and {diagnostics.get('total_graph_edges', 0)} verified graph edges.\n"
            )
            print(
                "Debug counts: "
                f"direct contact matches={diagnostics.get('direct_contact_matches', 0)}, "
                f"firm/company matches={diagnostics.get('firm_company_matches', 0)}, "
                f"total graph edges={diagnostics.get('total_graph_edges', 0)}.\n"
            )

        if relationship_result.get("errors"):
            print("Relationship Intelligence diagnostics:")
            for error in relationship_result["errors"]:
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
