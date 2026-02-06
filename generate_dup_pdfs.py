from pypdf import PdfWriter
from io import BytesIO
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import letter

def create_pdf(filename, text):
    packet = BytesIO()
    can = canvas.Canvas(packet, pagesize=letter)
    can.drawString(100, 100, text)
    can.save()
    packet.seek(0)
    new_pdf = PdfWriter()
    new_pdf.add_page(PdfWriter(packet).pages[0])
    with open(filename, "wb") as f:
        new_pdf.write(f)
    print(f"Created {filename}")

create_pdf("test_dup_1.pdf", "Ref: 88887777")
create_pdf("test_dup_2.pdf", "Ref: 88887777")
