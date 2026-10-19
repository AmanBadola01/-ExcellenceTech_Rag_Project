# Mini RAG Q&A System

A simple **Retrieval-Augmented Generation (RAG)** system that answers questions about a document (TXT or PDF), using **only** the information inside that document.

## How it works

```
                 ┌──────────── Indexing (once per document) ────────────┐
 Document  ──►  1. Load  ──►  2. Chunk  ──►  3. Embed  ──►  4. Store in FAISS
 (.txt/.pdf)     (pypdf)     (200 words,     (MiniLM)
                              40 overlap)

                 ┌──────────── Answering (every question) ──────────────┐
 Question  ──►  Embed  ──►  5. Retrieve top 3 chunks  ──►  6. LLM answers
                                (cosine similarity)         from those chunks only
```

| Step | File | What it does |
|---|---|---|
| 1. Load | `rag/loader.py` | Reads text from a `.txt` or `.pdf` file |
| 2. Chunk | `rag/chunker.py` | Splits text into 200-word chunks with 40-word overlap |
| 3. Embed | `rag/embedder.py` | Converts chunks into vectors with Sentence Transformers (`all-MiniLM-L6-v2`) |
| 4. Store | `rag/vector_store.py` | Saves the vectors in a FAISS index |
| 5. Retrieve | `rag/vector_store.py` | Finds the top 3 chunks most similar to the question |
| 6. Generate | `rag/generator.py` | Sends the chunks + question to an LLM (Gemini or OpenAI) |
| Glue | `rag/pipeline.py` | Connects all the steps |

## Project structure

```
mini-rag-qa/
├── app.py                  # Command-line interface
├── ui.py                   # Simple web UI (Streamlit)
├── rag/
│   ├── loader.py           # Step 1
│   ├── chunker.py          # Step 2
│   ├── embedder.py         # Step 3
│   ├── vector_store.py     # Steps 4 & 5
│   ├── generator.py        # Step 6
│   └── pipeline.py         # Connects everything
├── data/
│   └── company_policy.txt  # Sample document
├── test_queries.md         # Sample questions and expected answers
├── requirements.txt
└── .env
```

## Setup

**1. Clone the repo and create a virtual environment**
```bash
git clone <your-repo-url>
cd mini-rag-qa
python -m venv venv
venv\Scripts\activate
```

**2. Install dependencies**
```bash
pip install -r requirements.txt
```

**3. Add your API key**
```bash
create a .env file            
```

## Usage

**Command line**
```bash
python app.py                                  # uses the sample document
python app.py path/to/your_file.pdf            # uses your own document
python app.py --show-sources                   # also shows the retrieved chunks
```

**Simple web UI**
```bash
streamlit run ui.py
```

### Example

See [`test_queries.md`](test_queries.md) for the full list of test questions.

## How hallucination is prevented

1. **Strict prompt.** The LLM is told to answer only from the given context, and to reply with a fixed "couldn't find" message if the answer isn't there.
2. **Temperature 0.** The model gives deterministic, factual answers instead of creative ones.
3. **Similarity threshold.** If even the best-matching chunk has a similarity below `0.05`, the question is unrelated to the document. The system returns "not found" **without calling the LLM**.
4. **Visible sources.** `--show-sources` (or the "Retrieved chunks" panel in the UI) shows exactly which text the answer came from.

## Design choices

- **Chunk size 200 words, overlap 40.** Small chunks keep each one focused on a single topic, so retrieval is precise. The overlap stops facts that sit on a chunk boundary from being cut in half.
- **`all-MiniLM-L6-v2` embeddings.** Free, local, fast, and good enough for small documents. No API cost for embeddings.
- **`IndexFlatIP` in FAISS.** Exact search on normalized vectors, which equals cosine similarity. For a small document, exact search is instant, so approximate indexes aren't needed.
- **No LangChain.** Every step is written by hand to keep the pipeline easy to read and explain.

All settings (`CHUNK_SIZE`, `CHUNK_OVERLAP`, `TOP_K`, `MIN_SIMILARITY`) are at the top of `rag/pipeline.py`.

## Tech stack

Python · pypdf · Sentence Transformers · FAISS · Google Gemini / OpenAI · Streamlit
