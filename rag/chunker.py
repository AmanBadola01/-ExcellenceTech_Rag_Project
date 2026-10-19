"""
STEP 2: TEXT CHUNKING
---------------------
Splits the long document text into smaller overlapping chunks.

Why chunk?
- Embedding models work best when short passages are provided.
- We only want to send the most relevant pieces to the LLM, not the whole file.

Why overlap?
- If an important sentence falls on the border between two chunks,
  the overlap makes sure it appears complete in at least one of them.
"""

from typing import List


def chunk_text(text: str, chunk_size: int = 200, overlap: int = 40) -> List[str]: #using chunk = 200 and overlapping chunk =40
    """
    Split text into chunks of `chunk_size` words,
    where each chunk shares `overlap` words with the previous one.
    """

    if overlap >= chunk_size:
        raise ValueError("overlap must be smaller than chunk_size")

    # Break the text into individual words (this also cleans up extra spaces/newlines)
    words = text.split()

    chunks = []
    # Move forward by words each time
    step = chunk_size - overlap

    for start in range(0, len(words), step):
        # Take a window of `chunk_size` words starting from `start`
        chunk_words = words[start : start + chunk_size]
        chunks.append(" ".join(chunk_words))

        # If this window already reached the end of the document, stop
        if start + chunk_size >= len(words):
            break

    return chunks
