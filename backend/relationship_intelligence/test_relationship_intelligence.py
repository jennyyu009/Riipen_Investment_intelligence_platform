import tempfile
import os
from backend.relationship_intelligence.relationship_intelligence import run_relationship_intelligence


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
        assert res["results"][0]["paths"][0]["match_type"] == "direct contact match"
        assert res["diagnostics"]["direct_contact_matches"] == 1
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
        assert res["results"][0]["paths"][0]["match_type"] == "firm/company match"
        assert res["diagnostics"]["firm_company_matches"] == 1
        assert res["diagnostics"]["total_graph_edges"] > 0
    finally:
        os.unlink(tmp.name)
