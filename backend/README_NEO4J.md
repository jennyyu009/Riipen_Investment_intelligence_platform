Quick Neo4j setup for this project

1. Using Docker (recommended if you don't use Desktop):

   # make script executable once

   chmod +x scripts/start_neo4j_docker.sh
   ./scripts/start_neo4j_docker.sh

   Then export env (example):

   export NEO4J_URI="bolt://localhost:7687"
   export NEO4J_USERNAME="neo4j"
   export NEO4J_PASSWORD="12345678"

2. Using Neo4j Desktop:
   - Open Neo4j Desktop and start the database (ensure it is Running).
   - Use the DB credentials shown in Desktop and export them as above.

3. If your Neo4j is configured without authentication:
   - Do NOT set NEO4J_PASSWORD (leave it unset or empty). The backend will attempt no-auth connection.

4. Run the app:

   python backend/interactive_terminal.py

Notes:

- The app reads `NEO4J_URI`, `NEO4J_USERNAME`, and `NEO4J_PASSWORD` from environment variables.
- You can copy `backend/.env.example` to `backend/.env` and load it with your preferred tool.
