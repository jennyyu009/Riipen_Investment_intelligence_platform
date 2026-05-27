import numpy as np
from sentence_transformers import SentenceTransformer
_model = None


def get_embedding_model():
    global _model

    if _model is None:
        _model = SentenceTransformer(
            "BAAI/bge-small-en-v1.5"
        )

    return _model


def cosine_similarity(text_a: str, text_b: str) -> float:
    if not text_a or not text_b:
        return 0.0

    model = get_embedding_model()

    embeddings = model.encode(
        [text_a, text_b],
        normalize_embeddings=True
    )

    return float(np.dot(embeddings[0], embeddings[1]))
