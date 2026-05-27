#!/usr/bin/env bash
# Start a Neo4j Docker container for local development
# Adjust the password after first run if needed.

# Example: change NEO4J_PASSWORD to your desired password
NEO4J_PASSWORD=${NEO4J_PASSWORD:-12345678}

docker run \
  --name latte-neo4j \
  -p 7474:7474 -p 7687:7687 \
  -e NEO4J_AUTH=neo4j/${NEO4J_PASSWORD} \
  -d neo4j:latest

# After starting, set environment variables for the app (example):
# export NEO4J_URI="bolt://localhost:7687"
# export NEO4J_USERNAME="neo4j"
# export NEO4J_PASSWORD="${NEO4J_PASSWORD}"

# To stop and remove:
# docker stop latte-neo4j && docker rm latte-neo4j
