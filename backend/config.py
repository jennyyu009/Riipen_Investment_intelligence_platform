import os
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = PROJECT_ROOT / "data"
ENRICHED_INVESTORS_PATH = DATA_DIR / "enriched_investors.json"
PRECOMPUTED_WARM_PATHS_PATH = DATA_DIR / "precomputed_warm_paths.json"
MAX_PITCH_DECK_BYTES = 10 * 1024 * 1024


def env_flag(name: str, default: bool = False) -> bool:
    return os.getenv(name, str(default)).strip().lower() in {"1", "true", "yes", "on"}


ENABLE_HEAVY_PROCESSING = env_flag("ENABLE_HEAVY_PROCESSING")
ENABLE_CRAWL_ENRICHMENT = env_flag("ENABLE_CRAWL_ENRICHMENT")
ENABLE_EMBEDDING_MODEL = env_flag("ENABLE_EMBEDDING_MODEL")


def require_heavy_processing(task: str) -> None:
    if not ENABLE_HEAVY_PROCESSING:
        raise RuntimeError(
            f"{task} is an offline-only task. Set ENABLE_HEAVY_PROCESSING=true locally."
        )
