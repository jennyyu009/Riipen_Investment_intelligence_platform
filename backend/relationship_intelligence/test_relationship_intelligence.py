import tempfile
import os
from backend.relationship_intelligence.relationship_intelligence import (
    is_same_person,
    is_verified_firm_match,
    run_relationship_intelligence,
)


def test_handles_missing_neo4j():
    # Point to an invalid neo4j port to simulate unavailability
    res = run_relationship_intelligence(
        founder_data={"name": "Nonexistent Founder"},
        top_investors=["Some Investor"],
        connections_csv_path=None,
        messages_csv_path=None,
        neo4j_uri="bolt://localhost:9999",
        neo4j_user="neo4j",
        neo4j_password="wrong",
    )
    assert isinstance(res, dict)
    assert "errors" in res


def test_handles_empty_csvs():
    # create empty csv files
    tmp1 = tempfile.NamedTemporaryFile(delete=False, suffix=".csv")
    tmp2 = tempfile.NamedTemporaryFile(delete=False, suffix=".csv")
    tmp1.close(); tmp2.close()
    try:
        res = run_relationship_intelligence(
            founder_data={"name": "Test Founder"},
            top_investors=["Test Investor"],
            connections_csv_path=tmp1.name,
            messages_csv_path=tmp2.name,
        )
        assert isinstance(res, dict)
        assert "results" in res
    finally:
        os.unlink(tmp1.name)
        os.unlink(tmp2.name)


def test_matches_linkedin_export_contact_url():
    csv_body = """Notes:
"LinkedIn export note"

First Name,Last Name,URL,Email Address,Company,Position,Connected On
Robert,Guo,https://www.linkedin.com/in/robert-guo-6a7ba0193,,Sixity Degree Capital,CEO,17 May 2026
"""
    tmp = tempfile.NamedTemporaryFile(delete=False, suffix=".csv", mode="w")
    tmp.write(csv_body)
    tmp.close()
    try:
        res = run_relationship_intelligence(
            founder_data={"name": "Zhixin Yu"},
            top_investors=[{
                "investor_name": "Sixity Degree Capital",
                "contact_1_name": "Robert Guo",
                "contact_1_title": "CEO",
                "contact_1_linkedin": "https://www.linkedin.com/in/robert-guo-6a7ba0193/",
            }],
            connections_csv_path=tmp.name,
            neo4j_uri=None,
        )
        assert res["results"][0]["paths"]
        assert any(path["match_type"] == "direct contact match" for path in res["results"][0]["paths"])
        assert res["diagnostics"]["verified_direct_contact_matches"] == 1
    finally:
        os.unlink(tmp.name)


def test_matches_linkedin_export_company_to_investor_firm():
    csv_body = """Notes:
"LinkedIn export note"

First Name,Last Name,URL,Email Address,Company,Position,Connected On
Jamie,Lee,https://www.linkedin.com/in/jamie-lee,,Sixity Degree Capital,Partner,17 May 2026
"""
    tmp = tempfile.NamedTemporaryFile(delete=False, suffix=".csv", mode="w")
    tmp.write(csv_body)
    tmp.close()
    try:
        res = run_relationship_intelligence(
            founder_data={"name": "Zhixin Yu"},
            top_investors=[{
                "investor_name": "Sixity Degree Capital",
                "contact_1_name": "Robert Guo",
                "contact_1_title": "CEO",
                "contact_1_linkedin": "https://www.linkedin.com/in/robert-guo-6a7ba0193/",
            }],
            connections_csv_path=tmp.name,
            neo4j_uri=None,
        )
        assert res["results"][0]["paths"]
        assert res["results"][0]["paths"][0]["match_type"] == "same investor firm match"
        assert res["results"][0]["paths"][0]["confidence"] == "verified"
        assert res["diagnostics"]["firm_company_matches"] == 1
        assert res["diagnostics"]["same_firm_matches"] == 1
        assert res["diagnostics"]["total_graph_edges"] > 0
    finally:
        os.unlink(tmp.name)


def test_verified_firm_match_rejects_generic_word_matches():
    false_pairs = [
        ("Capital One", "Bryker Capital"),
        ("Capital One", "Round13 Capital"),
        ("Capital One", "Xavaav Capital"),
        ("BDO Canada", "Elevation Capital (Canada)"),
        ("BDO Canada", "Elevation Capital Canada"),
        ("Ares Management", "Westcap Management"),
        ("Amur Capital", "Garage Capital"),
    ]

    for company_name, investor_name in false_pairs:
        assert not is_verified_firm_match(company_name, investor_name)


def test_verified_firm_match_accepts_shared_distinctive_names():
    true_pairs = [
        ("Deloitte", "Deloitte Ventures"),
        ("OMERS", "OMERS Ventures"),
        ("Round13", "Round13 Capital"),
        ("Xavaav", "Xavaav Capital"),
    ]

    for company_name, investor_name in true_pairs:
        assert is_verified_firm_match(company_name, investor_name)


def test_same_person_rejects_partial_and_reversed_names():
    false_pairs = [
        ("Yin Liu", "Liu Yi"),
        ("Michael Wang", "Michael"),
        ("Michael Zhu", "Michael"),
        ("Michael Strusievici", "Michael"),
        ("David Chen", "David"),
        ("John Smith", "John"),
    ]

    for connection_name, contact_name in false_pairs:
        assert not is_same_person({"name": connection_name}, {"name": contact_name})


def test_same_person_accepts_verified_full_identity():
    true_pairs = [
        ("Yin Liu", "Yin Liu"),
        ("Michael Wang", "Michael Wang"),
        ("Ricardo Lu", "Ricardo Lu"),
        ("Shirley Li", "Shirley Li"),
    ]

    for connection_name, contact_name in true_pairs:
        assert is_same_person({"name": connection_name}, {"name": contact_name})

    assert is_same_person(
        {"name": "Yin Liu", "linkedin_key": "yin-liu"},
        {"name": "Liu Yi", "linkedin": "https://www.linkedin.com/in/yin-liu/"},
    )


def test_rejected_firm_match_does_not_create_path():
    csv_body = """Notes:
"LinkedIn export note"

First Name,Last Name,URL,Email Address,Company,Position,Connected On
Martin,Ng,https://www.linkedin.com/in/martin-ng,,Capital One,Director,17 May 2026
Rebecca,Pham,https://www.linkedin.com/in/rebecca-pham,,BDO Canada,Partner,17 May 2026
"""
    tmp = tempfile.NamedTemporaryFile(delete=False, suffix=".csv", mode="w")
    tmp.write(csv_body)
    tmp.close()
    try:
        res = run_relationship_intelligence(
            founder_data={"name": "Zhixin Yu"},
            top_investors=[
                {"investor_name": "Bryker Capital"},
                {"investor_name": "Round13 Capital"},
                {"investor_name": "Elevation Capital (Canada)"},
            ],
            connections_csv_path=tmp.name,
            neo4j_uri=None,
        )
        assert all(not result["paths"] for result in res["results"])
        assert res["diagnostics"]["verified_firm_matches"] == 0
        assert res["diagnostics"]["rejected_firm_matches"] == 6
    finally:
        os.unlink(tmp.name)


def test_weak_identity_match_does_not_create_direct_or_enriched_path():
    csv_body = """Notes:
"LinkedIn export note"

First Name,Last Name,URL,Email Address,Company,Position,Connected On
Yin,Liu,https://www.linkedin.com/in/yin-liu,,Independent,Advisor,17 May 2026
Michael,Wang,https://www.linkedin.com/in/michael-wang,,Independent,Advisor,17 May 2026
Michael,Zhu,https://www.linkedin.com/in/michael-zhu,,Independent,Advisor,17 May 2026
"""
    tmp = tempfile.NamedTemporaryFile(delete=False, suffix=".csv", mode="w")
    tmp.write(csv_body)
    tmp.close()
    try:
        res = run_relationship_intelligence(
            founder_data={"name": "Zhixin Yu"},
            top_investors=[
                {
                    "investor_name": "Xavaav Capital",
                    "contact_1_name": "Liu Yi",
                    "contact_2_name": "Michael",
                }
            ],
            connections_csv_path=tmp.name,
            neo4j_uri=None,
        )
        assert not res["results"][0]["paths"]
        assert res["diagnostics"]["verified_direct_contact_matches"] == 0
        assert res["diagnostics"]["rejected_weak_identity_matches"] == 3
    finally:
        os.unlink(tmp.name)


def test_returns_up_to_three_paths_for_each_investor():
    csv_body = """Notes:
"LinkedIn export note"

First Name,Last Name,URL,Email Address,Company,Position,Connected On
Yin,Liu,https://www.linkedin.com/in/yin-liu,,Xavaav Capital,Partner,17 May 2026
Alex,Kim,https://www.linkedin.com/in/alex-kim,,Xavaav Capital,Principal,17 May 2026
Priya,Shah,https://www.linkedin.com/in/priya-shah,,OMERS Ventures,Partner,17 May 2026
Noah,Chen,https://www.linkedin.com/in/noah-chen,,OMERS Ventures,Principal,17 May 2026
"""
    tmp = tempfile.NamedTemporaryFile(delete=False, suffix=".csv", mode="w")
    tmp.write(csv_body)
    tmp.close()
    try:
        res = run_relationship_intelligence(
            founder_data={"name": "Zhixin Yu"},
            top_investors=[
                {
                    "investor_name": "Xavaav Capital",
                    "matching_score": 97,
                    "contact_1_name": "Yin Liu",
                    "contact_1_linkedin": "https://www.linkedin.com/in/yin-liu/",
                    "contact_2_name": "Alex Kim",
                    "contact_2_linkedin": "https://www.linkedin.com/in/alex-kim/",
                },
                {
                    "investor_name": "OMERS Ventures",
                    "matching_score": 92,
                    "contact_1_name": "Priya Shah",
                    "contact_1_linkedin": "https://www.linkedin.com/in/priya-shah/",
                    "contact_2_name": "Noah Chen",
                    "contact_2_linkedin": "https://www.linkedin.com/in/noah-chen/",
                },
            ],
            connections_csv_path=tmp.name,
            neo4j_uri=None,
        )

        assert len(res["results"]) == 2
        for entry in res["results"]:
            assert entry["matching_score"] in (97, 92)
            assert 1 <= len(entry["paths"]) <= 3
            assert len(entry["paths"]) == 3
            assert all(path["hops"] <= 2 for path in entry["paths"])
            assert all(path["confidence"] == "verified" for path in entry["paths"])
            assert all(path["evidence"] for path in entry["paths"])
    finally:
        os.unlink(tmp.name)
