from pypdf import PdfWriter
from io import BytesIO
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import letter

packet = BytesIO()
can = canvas.Canvas(packet, pagesize=letter)
can.drawString(100, 100, "Ref Number: 99998888")
can.save()

packet.seek(0)
new_pdf = PdfWriter()
new_pdf.add_page(PdfWriter(packet).pages[0])

with open("test_upload_99.pdf", "wb") as f:
    new_pdf.write(f)
print("Created test_upload_99.pdf")
