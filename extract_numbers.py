import os
import sys
import re
import json
from pypdf import PdfReader

def extract_numbers_from_pdfs(directory="assets", output_file="search_index.json"):
    """
    Scans all PDFs in the directory, extracts numbers (3+ digits), 
    and saves a mapping of Number -> [List of Files] to a JSON file.
    """
    if not os.path.exists(directory):
        print(f"Directory '{directory}' not found.")
        return

    index = {}
    pdf_files = [f for f in os.listdir(directory) if f.lower().endswith('.pdf')]
    
    print(f"Indexing {len(pdf_files)} files in '{directory}'...")

    for filename in pdf_files:
        filepath = os.path.join(directory, filename)
        try:
            reader = PdfReader(filepath)
            for page in reader.pages:
                text = page.extract_text()
                if text:
                    # Find sequences of 3 or more digits
                    # We normalize by removing spaces or dashes if they break up numbers, 
                    # but for now, let's just find contiguous digits or digits with simple separators
                    
                    # Refined pattern: Look for 8 to 13 digits (Machine Numbers can be 8 digits too)
                    matches = re.findall(r'\b\d{8,13}\b', text)
                    
                    for match in matches:
                        if match not in index:
                            index[match] = []
                        if filename not in index[match]:
                            index[match].append(filename)
                            
        except Exception as e:
            print(f"Error reading '{filename}': {e}")

    # Save to JSON
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(index, f, ensure_ascii=False, indent=2)
    
    print(f"Indexing complete. Found {len(index)} unique numbers. Saved to '{output_file}'.")

if __name__ == "__main__":
    target_dir = sys.argv[1] if len(sys.argv) > 1 else "assets"
    extract_numbers_from_pdfs(target_dir)
