import os
import sys
from pypdf import PdfReader

def search_pdf(search_term, directory="."):
    """
    Searches for a specific term (number) in all PDF files in the given directory.
    
    Args:
        search_term (str): The term to search for.
        directory (str): The directory to search in. Defaults to current directory.
    """
    if not os.path.isdir(directory):
        print(f"Error: Directory '{directory}' not found.")
        return

    pdf_files = [f for f in os.listdir(directory) if f.lower().endswith('.pdf')]
    
    if not pdf_files:
        print(f"No PDF files found in '{directory}'.")
        return

    print(f"Searching for '{search_term}' in {len(pdf_files)} PDF files in '{directory}'...")
    
    found_any = False
    
    for filename in pdf_files:
        filepath = os.path.join(directory, filename)
        try:
            reader = PdfReader(filepath)
            for page_num, page in enumerate(reader.pages):
                text = page.extract_text()
                if search_term in text:
                    print(f"Found '{search_term}' in '{filename}' on page {page_num + 1}")
                    found_any = True
                    # If we only want the first match per file, we could break here.
                    # But the requirement says "return .pdf page", implying finding all occurances or at least the relevant page.
                    # Let's list all pages where it appears.
        except Exception as e:
            print(f"Could not read '{filename}': {e}")

    if not found_any:
        print(f"'{search_term}' not found in any PDF files.")

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python3 pdf_search.py <search_number> [directory]")
        sys.exit(1)
    
    term = sys.argv[1]
    search_dir = sys.argv[2] if len(sys.argv) > 2 else "."
    
    search_pdf(term, search_dir)
