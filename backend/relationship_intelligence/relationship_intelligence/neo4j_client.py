from threading import Lock
from neo4j import GraphDatabase
from neo4j.exceptions import ServiceUnavailable

_driver = None
_lock = Lock()

def get_driver(uri: str = None, user: str = "neo4j", password: str = ""):
    """
    Return a singleton Neo4j driver. Safe to call concurrently.
    """
    global _driver
    if not uri:
        raise ServiceUnavailable("NEO4J_URI is not configured")
    if _driver is None:
        with _lock:
            if _driver is None:
                try:
                    _driver = GraphDatabase.driver(uri, auth=(user, password))
                except Exception as exc:
                    raise ServiceUnavailable(f"Could not create Neo4j driver: {exc}")
    return _driver

def close_driver():
    global _driver
    if _driver is not None:
        try:
            _driver.close()
        finally:
            _driver = None
