import os
import re
from pypdf import PdfReader

assets_dir = 'assets'
target = "55500001"
print(f"Searching for {target} in {assets_dir}...")

for filename in os.listdir(assets_dir):
    if filename.endswith('.pdf'):
        path = os.path.join(assets_dir, filename)
        try:
            reader = PdfReader(path)
            for i, page in enumerate(reader.pages):
                text = page.extract_text()
                if target in text:
                    print(f"FOUND in {filename} page {i+1}")
                    # Print context
                    start = text.find(target)
                    print(f"Context: ...{text[start-10:start+20]}...")
        except Exception as e:
            print(f"Error reading {filename}: {e}")
