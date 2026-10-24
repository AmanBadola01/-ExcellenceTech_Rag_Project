"""
STEP 4: STORE IN VECTOR DATABASE  +  STEP 5: RETRIEVAL
------------------------------------------------------
Stores chunk embeddings in a FAISS index and finds the chunks
most similar to a user's question.
"""

from typing import List, Tuple
import faiss
import numpy as np


class VectorStore:
    def __init__(self, dimension: int):
        # IndexFlatIP = exact search using Inner Product.
        # inner product = cosine similarity
        # (1.0 = same meaning, 0 = unrelated).
        self.index = faiss.IndexFlatIP(dimension)
        # FAISS only stores vectors, so we keep the original chunk text in a list.
        # The position in this list matches the vector's ID inside FAISS.
        self.chunks: List[str] = []

    def add(self, embeddings: np.ndarray, chunks: List[str]) -> None:
        """STEP 4: Add chunk vectors and their text to the store."""
        self.index.add(embeddings)
        self.chunks.extend(chunks)

    def search(self, query_embedding: np.ndarray, top_k: int = 3) -> List[Tuple[str, float]]:
        """
        STEP 5: Return the `top_k` most similar chunks as (chunk_text, score) pairs,
        sorted from most to least similar.
        """
        # Can't return more chunks than we have
        top_k = min(top_k, len(self.chunks))

        # FAISS is expecting a 2D array: one row per query
        scores, ids = self.index.search(query_embedding.reshape(1, -1), top_k)

        results = []
        for chunk_id, score in zip(ids[0], scores[0]):
            if chunk_id == -1:  # FAISS uses -1 when there is no result
                continue
            results.append((self.chunks[chunk_id], float(score)))
        return results
