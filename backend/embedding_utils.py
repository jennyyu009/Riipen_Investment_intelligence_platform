import os
import numpy as np

USE_LIGHTWEIGHT = os.getenv(
    "LIGHTWEIGHT_DEPLOYMENT",
    "false"
).lower() == "true"

_model = None


if not USE_LIGHTWEIGHT:

    from sentence_transformers import SentenceTransformer

    def get_embedding_model():
        global _model

        if _model is None:
            _model = SentenceTransformer(
                "BAAI/bge-small-en-v1.5"
            )

        return _model

    def cosine_similarity(
        text_a: str,
        text_b: str
    ) -> float:

        if not text_a or not text_b:
            return 0.0

        model = get_embedding_model()

        embeddings = model.encode(
            [text_a, text_b],
            normalize_embeddings=True
        )

        return float(
            np.dot(
                embeddings[0],
                embeddings[1]
            )
        )

else:

    from rapidfuzz import fuzz

    def cosine_similarity(
        text_a: str,
        text_b: str
    ) -> float:

        if not text_a or not text_b:
            return 0.0

        similarity = fuzz.token_sort_ratio(
            text_a,
            text_b
        )

        return similarity / 100