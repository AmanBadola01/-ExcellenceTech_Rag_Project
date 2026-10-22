import os
import tempfile

import streamlit as st
from dotenv import load_dotenv

import auth
import memory
from rag.pipeline import RAGPipeline

load_dotenv()
memory.init_db()

LOGO_PATH = "assets/logo.png"

st.set_page_config(
    page_title="Excellence Q&A RAG",
    page_icon=LOGO_PATH if os.path.exists(LOGO_PATH) else None,
)

if os.path.exists(LOGO_PATH):
    img_col, title_col = st.columns([1, 5], vertical_alignment="center")
    img_col.image(LOGO_PATH, width=90)
    title_col.title("Excellence Q&A RAG")
else:
    st.title("Excellence Q&A RAG")

# ---------- Login gate: nothing below runs until the user is logged in ----------
if "user_id" not in st.session_state:
    auth.show_login()
    st.stop()

user_id = st.session_state["user_id"]


@st.cache_resource
def get_pipeline():
    return RAGPipeline()


pipeline = get_pipeline()

if "session_id" not in st.session_state:
    st.session_state["session_id"] = memory.new_session_id()

# ---------- Sidebar: account + chat history ----------
with st.sidebar:
    st.caption(f"Logged in as {st.session_state['email']}")
    if st.button("Logout", use_container_width=True):
        st.session_state.clear()
        st.rerun()

    st.divider()
    st.header("Chats")
    if st.button("New chat", use_container_width=True):
        st.session_state["session_id"] = memory.new_session_id()
        st.rerun()

    for s in memory.list_sessions(user_id):
        title = (s["title"] or "Untitled")[:35]
        is_current = s["session_id"] == st.session_state["session_id"]
        if st.button(
            title,
            key=s["session_id"],
            use_container_width=True,
            type="primary" if is_current else "secondary",
        ):
            st.session_state["session_id"] = s["session_id"]
            st.rerun()

session_id = st.session_state["session_id"]

# ---------- Document ----------
uploaded = st.file_uploader("Upload a TXT or PDF (optional)", type=["txt", "pdf"])

if uploaded:
    suffix = os.path.splitext(uploaded.name)[1]
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        tmp.write(uploaded.getvalue())
        doc_path, doc_name = tmp.name, uploaded.name
else:
    doc_path = doc_name = "data/company_policy.txt"

if st.session_state.get("indexed_doc") != doc_name:
    with st.spinner("Indexing document..."):
        num_chunks = pipeline.index_document(doc_path)
    st.session_state["indexed_doc"] = doc_name
    st.session_state["num_chunks"] = num_chunks

st.caption(f"Using: {doc_name} ({st.session_state['num_chunks']} chunks)")

# ---------- Past messages ----------
history = memory.load_history(session_id, user_id)
for m in history:
    label = "User" if m["role"] == "user" else "Assistant"
    st.markdown(f"**{label}**")
    st.write(m["content"])
    st.divider()

# ---------- New question ----------
question = st.chat_input("Ask a question about the document")

if question:
    st.markdown("**User**")
    st.write(question)
    st.divider()

    st.markdown("**Assistant**")
    with st.spinner("Thinking..."):
        standalone = memory.rewrite_question(question, history)
        result = pipeline.ask(standalone)

    st.write(result["answer"])

    if standalone != question:
        st.caption(f"Searched as: {standalone}")

    with st.expander("Retrieved chunks"):
        for i, (chunk, score) in enumerate(result["sources"], start=1):
            st.markdown(f"**Chunk {i}** (similarity {score:.2f})")
            st.write(chunk)

    memory.save_message(session_id, "user", question, user_id)
    memory.save_message(session_id, "assistant", result["answer"], user_id)

    # refresh so the sidebar shows the new chat title
    if not history:
        st.rerun()
