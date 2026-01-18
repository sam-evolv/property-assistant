#!/usr/bin/env python3
"""
Convert floor plan images to a PDF document.
Usage: python3 create-floorplan-pdf.py ground_floor.png first_floor.png output.pdf
"""

import sys
from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas
from reportlab.lib.utils import ImageReader
from PIL import Image
import os

def create_floorplan_pdf(image_paths: list, output_path: str):
    """Create a PDF from floor plan images."""

    # A4 dimensions
    page_width, page_height = A4

    # Create PDF
    c = canvas.Canvas(output_path, pagesize=A4)

    labels = ["Ground Floor", "First Floor", "Second Floor", "Third Floor"]

    for i, image_path in enumerate(image_paths):
        if not os.path.exists(image_path):
            print(f"Warning: Image not found: {image_path}")
            continue

        # Get image dimensions
        img = Image.open(image_path)
        img_width, img_height = img.size

        # Calculate scaling to fit on page with margins
        margin = 50
        max_width = page_width - (2 * margin)
        max_height = page_height - (2 * margin) - 40  # Extra space for title

        # Calculate scale factor
        scale = min(max_width / img_width, max_height / img_height)

        scaled_width = img_width * scale
        scaled_height = img_height * scale

        # Center the image
        x = (page_width - scaled_width) / 2
        y = (page_height - scaled_height) / 2 - 20  # Shift down a bit for title

        # Add title
        label = labels[i] if i < len(labels) else f"Floor {i + 1}"
        c.setFont("Helvetica-Bold", 16)
        c.drawCentredString(page_width / 2, page_height - 40, f"OpenHouse Park - The Keeley - {label}")

        # Draw the image
        c.drawImage(image_path, x, y, width=scaled_width, height=scaled_height)

        # Add page number
        c.setFont("Helvetica", 10)
        c.drawCentredString(page_width / 2, 30, f"Page {i + 1} of {len(image_paths)}")

        # New page for next image (except last)
        if i < len(image_paths) - 1:
            c.showPage()

    c.save()
    print(f"Created PDF: {output_path}")

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("Usage: python3 create-floorplan-pdf.py image1.png [image2.png ...] output.pdf")
        sys.exit(1)

    output_pdf = sys.argv[-1]
    image_files = sys.argv[1:-1]

    create_floorplan_pdf(image_files, output_pdf)
