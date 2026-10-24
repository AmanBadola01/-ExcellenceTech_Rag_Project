"""
RAG PIPELINE
Connects all 6 steps:

    Load -> Chunk -> Embed -> Store (FAISS) -> Retrieve top 3 -> Generate answer
"""

from typing import Dict, List

from rag.loader import load_document
from rag.chunker import chunk_text
from rag.embedder import Embedder
from rag.vector_store import VectorStore
from rag.generator import Generator, NOT_FOUND_MESSAGE

# Settings in one place so they're easy to tweak
CHUNK_SIZE = 200        # words per chunk (assignment asks for 200-500)
CHUNK_OVERLAP = 40      # words shared between neighbouring chunks
TOP_K = 3               # number of chunks to retrieve (assignment asks for 3)
MIN_SIMILARITY = 0.05   # if even the best chunk scores below this, the question
                        # is probably unrelated to the document -> skip the LLM


class RAGPipeline:
    def __init__(self):
        # Load the models once; they are reused for every question
        self.embedder = Embedder()
        self.generator = Generator()
        self.store = None

    def index_document(self, file_path: str) -> int:
        """Run Steps 1-4 on a document. Returns how many chunks were created."""

        # STEP 1: Load the raw text
        text = load_document(file_path)

        # STEP 2: Split it into overlapping chunks
        chunks = chunk_text(text, chunk_size=CHUNK_SIZE, overlap=CHUNK_OVERLAP)

        # STEP 3: Turn each chunk into an embedding vector
        embeddings = self.embedder.embed(chunks)

        # STEP 4: Put the vectors (and chunk text) into a fresh FAISS index
        self.store = VectorStore(dimension=embeddings.shape[1])
        self.store.add(embeddings, chunks)

        return len(chunks)

    def ask(self, question: str) -> Dict:
        """Run Steps 5-6 for one question. Returns the answer and the sources used."""

        if self.store is None:
            raise RuntimeError("No document indexed yet. Call index_document() first.")

        # STEP 5a: Embed the question with the SAME model used for the chunks
        query_embedding = self.embedder.embed([question])[0]

        # STEP 5b: Find the top 3 most similar chunks
        results = self.store.search(query_embedding, top_k=TOP_K)

        # Guardrail: if nothing is similar enough, answer "not found"
        # without calling the LLM at all (saves cost and avoids hallucination)
        if not results or results[0][1] < MIN_SIMILARITY:
            return {"answer": NOT_FOUND_MESSAGE, "sources": results}

        # STEP 6: Send the retrieved chunks + question to the LLM
        chunks: List[str] = [chunk for chunk, _score in results]
        answer = self.generator.generate(question, chunks)

        return {"answer": answer, "sources": results}
