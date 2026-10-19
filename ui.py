"""
SIMPLE WEB UI (Streamlit)
-------------------------
Run with:
    streamlit run ui.py

Upload a TXT/PDF (or use the sample), type a question, get an answer.
"""

import os
import tempfile

import streamlit as st
from dotenv import load_dotenv

from rag.pipeline import RAGPipeline

load_dotenv()

# ---------- Header: photo + title ----------
# Put your image at assets/logo.png (or change this path to your file).
LOGO_PATH = "assets/logo.png"

# Browser tab title + tab icon
st.set_page_config(
    page_title="Excellence Q&A RAG",
    page_icon=LOGO_PATH if os.path.exists(LOGO_PATH) else "📘",
)

if os.path.exists(LOGO_PATH):
    # Two columns: small photo on the left, title on the right
    img_col, title_col = st.columns([1, 5], vertical_alignment="center")
    img_col.image(LOGO_PATH, width=90)
    title_col.title("Excellence Q&A RAG")
else:
    # No photo found -> show just the title, so the app never crashes
    st.title("Excellence Q&A RAG")


# Load the models only once and reuse them across page refreshes
@st.cache_resource
def get_pipeline():
    return RAGPipeline()


pipeline = get_pipeline()

# 1) Pick a document: an uploaded file, or the sample document by default
uploaded = st.file_uploader("Upload a TXT or PDF (optional)", type=["txt", "pdf"])

if uploaded:
    # Save the upload to a temporary file so the loader can read it from disk
    suffix = os.path.splitext(uploaded.name)[1]
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        tmp.write(uploaded.getvalue())
        doc_path, doc_name = tmp.name, uploaded.name
else:
    doc_path = doc_name = "data/company_policy.txt"

# 2) Index the document only when it changes (not on every question)
if st.session_state.get("indexed_doc") != doc_name:
    with st.spinner("Indexing document..."):
        num_chunks = pipeline.index_document(doc_path)
    st.session_state["indexed_doc"] = doc_name
    st.session_state["num_chunks"] = num_chunks

st.caption(f"Using: {doc_name} ({st.session_state['num_chunks']} chunks)")

# 3) Ask a question and show the answer + the chunks it came from
question = st.text_input("Ask a question about the document")

if question:
    with st.spinner("Thinking..."):
        result = pipeline.ask(question)

    st.write("**Answer:**", result["answer"])

    with st.expander("Retrieved chunks"):
        for i, (chunk, score) in enumerate(result["sources"], start=1):
            st.markdown(f"**Chunk {i}** (similarity {score:.2f})")
            st.write(chunk)