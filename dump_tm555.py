from pypdf import PdfReader

filename = "assets/ตัดล๊อต TM555.pdf"
try:
    reader = PdfReader(filename)
    for i, page in enumerate(reader.pages):
        print(f"--- Page {i+1} ---")
        print(page.extract_text())
except Exception as e:
    print(f"Error: {e}")
