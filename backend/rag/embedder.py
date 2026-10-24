"""
STEP 3: GENERATE EMBEDDINGS
---------------------------
Converts text into vectors (lists of numbers) that capture its meaning.
Texts with similar meaning end up with vectors that point in a similar direction.

We are using Sentence Transformers ("all-MiniLM-L6-v2") beacuse:
1. Free, runs locally, no API key needed
2. Small (~90 MB) and fast
"""

from typing import List
import numpy as np
from sentence_transformers import SentenceTransformer

MODEL_NAME = "all-MiniLM-L6-v2"


class Embedder:
    def __init__(self, model_name: str = MODEL_NAME):
        # Downloads the model the first time, then loads it from cache
        print(f"[Embedder] Loading embedding model: {model_name}")
        self.model = SentenceTransformer(model_name)

    def embed(self, texts: List[str]) -> np.ndarray:
        """Turn a list of texts into a 2D array of shape."""
        vectors = self.model.encode(
            texts,
            # Normalize each vector to length 1, so that the inner product
            # between two vectors equals their cosine similarity
            normalize_embeddings=True,
            show_progress_bar=False,
        )
        # FAISS requires float32
        return np.asarray(vectors, dtype="float32")
