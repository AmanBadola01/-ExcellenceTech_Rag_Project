"""
COMMAND-LINE INTERFACE
----------------------
Usage:
    python app.py                          # uses the sample document
    python app.py path/to/your_file.pdf    # uses your own TXT or PDF
    python app.py data/company_policy.txt --show-sources

Type a question and press Enter. Type 'exit' to quit.
"""

import argparse
from dotenv import load_dotenv

from rag.pipeline import RAGPipeline

DEFAULT_DOCUMENT = "data/company_policy.txt"


def main():
    # Load API keys and settings from the .env file
    load_dotenv()

    # Read command-line arguments
    parser = argparse.ArgumentParser(description="Mini RAG Q&A system")
    parser.add_argument("document", nargs="?", default=DEFAULT_DOCUMENT,
                        help="Path to a .txt or .pdf file")
    parser.add_argument("--show-sources", action="store_true",
                        help="Also print the chunks that were retrieved")
    args = parser.parse_args()

    # Build the pipeline and index the document (Steps 1-4 run here, once)
    pipeline = RAGPipeline()
    num_chunks = pipeline.index_document(args.document)
    print(f"\nIndexed '{args.document}' into {num_chunks} chunks.")
    print("Ask a question about the document (type 'exit' to quit).\n")

    # Question loop (Steps 5-6 run for every question)
    while True:
        question = input("You: ").strip()

        if not question:
            continue
        if question.lower() in {"exit", "quit"}:
            print("Goodbye!")
            break

        result = pipeline.ask(question)
        print(f"\nAnswer: {result['answer']}\n")

        # Optionally show which chunks the answer was based on
        if args.show_sources:
            for i, (chunk, score) in enumerate(result["sources"], start=1):
                preview = chunk[:200] + ("..." if len(chunk) > 200 else "")
                print(f"  [Source {i} | similarity {score:.2f}] {preview}")
            print()


if __name__ == "__main__":
    main()
