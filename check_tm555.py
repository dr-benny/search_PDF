from pypdf import PdfReader
import re

filename = "assets/ตัดล๊อต TM555.pdf"
try:
    reader = PdfReader(filename)
    full_text = ""
    for page in reader.pages:
        full_text += page.extract_text()
    
    target = "3392252280001"
    if target in full_text:
        print(f"FOUND {target} in {filename}")
    else:
        print(f"NOT FOUND {target} in {filename}")
        # Print nearby context if possible (e.g. maybe it has spaces)
        # simplistic check for now
except Exception as e:
    print(f"Error: {e}")
