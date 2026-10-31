# Excellence AI Platform

A unified full-stack AI platform combining:
1. **Q&A RAG**: Semantic retrieval-augmented question answering over documents.
2. **AI Content Studio**: Multi-format content generation, repurposing, and brand voices.
3. **AI Document Processing & OCR Pipeline**: Intelligent dual-extraction OCR pipeline combining OpenCV image preprocessing, EasyOCR token bounding boxes, and Google Gemini Vision structured field/table extraction.

---

## Architecture Overview

```
                      ┌────────────────────────────────────────┐
                      │    React.js + TanStack Router (UI)     │
                      │  [ Q&A · Studio · Documents (OCR) ]   │
                      └──────────────────┬─────────────────────┘
                                         │ HTTP / REST
                      ┌──────────────────▼─────────────────────┐
                      │            FastAPI Backend             │
                      │  /api/auth   /api/rag   /api/content   │
                      │               /api/ocr                 │
                      └────┬─────────────┬─────────────┬───────┘
                           │             │             │
              ┌────────────▼──┐   ┌──────▼──────┐   ┌──▼───────────────────┐
              │  RAG Engine   │   │   Content   │   │   OCR & Document AI  │
              │  FAISS Vector │   │   Studio    │   │  • OpenCV Deskewing  │
              │  Embeddings   │   │  (Groq LLM) │   │  • EasyOCR (BBoxes)  │
              │  Gemini Gen   │   │             │   │  • Gemini 3.8 Flash  │
              └───────────────┘   └─────────────┘   │  • Table & CSV/Excel │
                                                    └──────────────────────┘
```

---

## Features

### 1. Documents · OCR Pipeline (Assignment #6)
* **Image Preprocessing**: Auto-deskewing tilted scans, bilateral denoising, CLAHE contrast boost, and border removal via OpenCV.
* **Dual Extraction**: EasyOCR extracts precise text token bounding boxes; Gemini Vision classifies document type (Invoice, Receipt, Business Card, Form, ID, Contract) and extracts structured key-value pairs.
* **Table & Line Items**: Extracts tabular row/column data with cell-level precision.
* **Interactive Bounding Box Review**: Color-coded overlays (Names: Orange, Dates: Blue, IDs: Purple, Amounts: Green, Tables: Teal).
* **Export**: Formatted multi-tab Excel (`.xlsx`), CSV, and JSON.
* **RAG Bridge**: "Approve & add to Q&A" directly indexes extracted documents into the RAG vector store.

### 2. AI Content Studio
* Brand voice customization and multi-channel content generation (LinkedIn, Twitter/X, Blogs, Newsletters).
* Content repurposing pipeline powered by Groq.

### 3. Excellence Q&A RAG
* Chunking and local dense embeddings (`all-MiniLM-L6-v2`).
* Exact cosine similarity retrieval using FAISS vector indexing.
* Grounded answer generation with strict zero-hallucination guardrails.

---

## Quick Setup

### 1. Prerequisites
* Python 3.10+
* Node.js 18+

### 2. Backend Setup
```bash
# Navigate to backend and create virtual environment
cd backend
python -m venv venv

# Activate virtual environment (Windows)
.\venv\Scripts\activate
# (macOS/Linux: source venv/bin/activate)

# Install dependencies
pip install -r requirements.txt
```

### 3. Environment Configuration
Copy `.env.example` or create a `.env` file in the project root:
```env
GEMINI_API_KEY=your_google_gemini_api_key_here
GROQ_API_KEY=your_groq_api_key_here
JWT_SECRET=your_secret_key_here
```

### 4. Frontend Setup
```bash
cd frontend
npm install
```

---

## Running the Application

### Start the Backend
```bash
# From project root with venv activated
uvicorn backend.main:app --reload --port 8000
```
API Documentation will be available at: `http://127.0.0.1:8000/docs`

### Start the Frontend
```bash
cd frontend
npm run dev
```
Open your browser at: `http://localhost:5173`

---

## Running the Standalone OCR Pipeline Test

To verify OpenCV deskewing, EasyOCR bounding boxes, and Gemini Vision extraction without opening the browser:
```bash
python backend/ocr/test_pipeline.py
```
This script programmatically generates a tilted invoice scan, auto-deskews it, extracts tokens and structured fields, and saves the annotated bounding-box image to `sample_documents/invoices/sample_annotated_output.jpg`.
