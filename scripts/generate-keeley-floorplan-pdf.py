#!/usr/bin/env python3
"""
Generate a floor plan PDF for The Keeley house type
with room dimensions based on the provided floor plan images.

Run: python3 scripts/generate-keeley-floorplan-pdf.py
"""

from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm, cm
from reportlab.lib.colors import Color, HexColor
from reportlab.pdfgen import canvas
from reportlab.lib.styles import getSampleStyleSheet
import os

# Colors matching the floor plan images
LIVING_ROOM_COLOR = HexColor('#F5D76E')  # Yellow
KITCHEN_COLOR = HexColor('#5DADE2')  # Blue
UTILITY_COLOR = HexColor('#F1948A')  # Light red/pink
WC_COLOR = HexColor('#58D68D')  # Green
HALL_COLOR = HexColor('#BB8FCE')  # Purple/Lavender
BEDROOM_COLOR = HexColor('#5DADE2')  # Blue (same as kitchen)
BATHROOM_COLOR = HexColor('#F39C12')  # Orange
WALL_COLOR = HexColor('#515A5A')  # Dark gray

def draw_room(c, x, y, width, height, color, label, dimensions):
    """Draw a room rectangle with label and dimensions."""
    # Draw filled rectangle
    c.setFillColor(color)
    c.setStrokeColor(WALL_COLOR)
    c.setLineWidth(2)
    c.rect(x, y, width, height, fill=1, stroke=1)

    # Draw room label
    c.setFillColor(HexColor('#2C3E50'))
    c.setFont("Helvetica-Bold", 10)
    label_x = x + width / 2
    label_y = y + height / 2 + 5
    c.drawCentredString(label_x, label_y, label)

    # Draw dimensions
    c.setFont("Helvetica", 8)
    c.drawCentredString(label_x, label_y - 12, dimensions)


def create_ground_floor(c, page_width, page_height):
    """Create ground floor layout."""
    c.setFont("Helvetica-Bold", 16)
    c.drawCentredString(page_width / 2, page_height - 40, "OpenHouse Park - The Keeley")
    c.setFont("Helvetica-Bold", 14)
    c.drawCentredString(page_width / 2, page_height - 60, "Ground Floor")

    # Scale factor for drawing
    scale = 35  # mm per meter

    # Starting position
    start_x = 80
    start_y = page_height - 450

    # House outline dimensions (approximate)
    house_width = 8.5 * scale * mm
    house_height = 7.5 * scale * mm

    # Draw rooms - Ground Floor
    # Kitchen/Dining - top left (blue)
    kitchen_w = 5.37 * scale * mm
    kitchen_h = 3.26 * scale * mm
    draw_room(c, start_x, start_y + 3.5 * scale * mm, kitchen_w, kitchen_h,
              KITCHEN_COLOR, "Kitchen/Dining", "5.37m x 3.26m")

    # Utility - top right (red/pink)
    utility_w = 1.80 * scale * mm
    utility_h = 1.70 * scale * mm
    draw_room(c, start_x + kitchen_w + 0.5 * scale * mm, start_y + 5.5 * scale * mm,
              utility_w, utility_h, UTILITY_COLOR, "Utility", "1.80m x 1.70m")

    # WC - below utility (green)
    wc_w = 1.70 * scale * mm
    wc_h = 0.90 * scale * mm
    draw_room(c, start_x + kitchen_w + 0.5 * scale * mm, start_y + 4.2 * scale * mm,
              wc_w, wc_h, WC_COLOR, "WC", "1.70m x 0.90m")

    # Living Room - bottom left (yellow)
    living_w = 4.69 * scale * mm
    living_h = 3.47 * scale * mm
    draw_room(c, start_x, start_y, living_w, living_h,
              LIVING_ROOM_COLOR, "Living Room", "4.69m x 3.47m")

    # Hall - bottom right (purple)
    hall_w = 1.70 * scale * mm
    hall_h = 3.95 * scale * mm
    draw_room(c, start_x + living_w + 0.5 * scale * mm, start_y, hall_w, hall_h,
              HALL_COLOR, "Hall", "1.70m x 3.95m")

    # Add dimension summary
    c.setFont("Helvetica", 10)
    y_offset = start_y - 50
    c.drawString(start_x, y_offset, "Ground Floor Room Dimensions:")
    c.setFont("Helvetica", 9)
    rooms = [
        "Living Room: 4.69m x 3.47m (16.3 sq m)",
        "Kitchen/Dining: 5.37m x 3.26m (17.5 sq m)",
        "Utility: 1.80m x 1.70m (3.1 sq m)",
        "WC: 1.70m x 0.90m (1.5 sq m)",
        "Hall: 1.70m x 3.95m (6.7 sq m)",
    ]
    for i, room in enumerate(rooms):
        c.drawString(start_x + 10, y_offset - 15 - (i * 12), room)


def create_first_floor(c, page_width, page_height):
    """Create first floor layout."""
    c.setFont("Helvetica-Bold", 16)
    c.drawCentredString(page_width / 2, page_height - 40, "OpenHouse Park - The Keeley")
    c.setFont("Helvetica-Bold", 14)
    c.drawCentredString(page_width / 2, page_height - 60, "First Floor")

    # Scale factor for drawing
    scale = 35  # mm per meter

    # Starting position
    start_x = 80
    start_y = page_height - 450

    # Draw rooms - First Floor
    # Bedroom 1 - top left (large, blue)
    bed1_w = 4.20 * scale * mm
    bed1_h = 3.47 * scale * mm
    draw_room(c, start_x, start_y + 3.0 * scale * mm, bed1_w, bed1_h,
              BEDROOM_COLOR, "Bedroom", "4.20m x 3.47m")

    # Bathroom - top right (orange)
    bath_w = 2.10 * scale * mm
    bath_h = 1.80 * scale * mm
    draw_room(c, start_x + bed1_w + 0.5 * scale * mm, start_y + 5.0 * scale * mm,
              bath_w, bath_h, BATHROOM_COLOR, "Bathroom", "2.10m x 1.80m")

    # Landing - middle right (purple)
    landing_w = 2.50 * scale * mm
    landing_h = 1.70 * scale * mm
    draw_room(c, start_x + bed1_w + 0.3 * scale * mm, start_y + 2.8 * scale * mm,
              landing_w, landing_h, HALL_COLOR, "Landing", "2.50m x 1.70m")

    # Bedroom 3 - bottom left (smaller, blue)
    bed3_w = 2.70 * scale * mm
    bed3_h = 2.40 * scale * mm
    draw_room(c, start_x, start_y, bed3_w, bed3_h,
              BEDROOM_COLOR, "Bedroom", "2.70m x 2.40m")

    # Bedroom 2 - bottom right (blue)
    bed2_w = 3.40 * scale * mm
    bed2_h = 2.90 * scale * mm
    draw_room(c, start_x + bed3_w + 1.0 * scale * mm, start_y, bed2_w, bed2_h,
              BEDROOM_COLOR, "Bedroom", "3.40m x 2.90m")

    # Add dimension summary
    c.setFont("Helvetica", 10)
    y_offset = start_y - 50
    c.drawString(start_x, y_offset, "First Floor Room Dimensions:")
    c.setFont("Helvetica", 9)
    rooms = [
        "Bedroom 1 (Master): 4.20m x 3.47m (14.6 sq m)",
        "Bedroom 2: 3.40m x 2.90m (9.9 sq m)",
        "Bedroom 3: 2.70m x 2.40m (6.5 sq m)",
        "Bathroom: 2.10m x 1.80m (3.8 sq m)",
        "Landing: 2.50m x 1.70m (4.3 sq m)",
    ]
    for i, room in enumerate(rooms):
        c.drawString(start_x + 10, y_offset - 15 - (i * 12), room)


def create_summary_page(c, page_width, page_height):
    """Create summary page with all dimensions."""
    c.setFont("Helvetica-Bold", 18)
    c.drawCentredString(page_width / 2, page_height - 50, "The Keeley - Room Dimensions Summary")

    c.setFont("Helvetica-Bold", 12)
    c.drawString(70, page_height - 100, "Total Floor Area: 83.2 sq m (896 sq ft)")

    y = page_height - 140
    line_height = 20

    # Ground Floor
    c.setFont("Helvetica-Bold", 14)
    c.drawString(70, y, "Ground Floor")
    y -= line_height + 5

    c.setFont("Helvetica", 11)
    ground_rooms = [
        ("Living Room", "4.69m x 3.47m", "16.3 sq m"),
        ("Kitchen/Dining", "5.37m x 3.26m", "17.5 sq m"),
        ("Utility", "1.80m x 1.70m", "3.1 sq m"),
        ("WC", "1.70m x 0.90m", "1.5 sq m"),
        ("Hall", "1.70m x 3.95m", "6.7 sq m"),
    ]

    for room, dims, area in ground_rooms:
        c.drawString(90, y, f"{room}:")
        c.drawString(220, y, dims)
        c.drawString(340, y, f"({area})")
        y -= line_height

    y -= 20

    # First Floor
    c.setFont("Helvetica-Bold", 14)
    c.drawString(70, y, "First Floor")
    y -= line_height + 5

    c.setFont("Helvetica", 11)
    first_rooms = [
        ("Bedroom 1 (Master)", "4.20m x 3.47m", "14.6 sq m"),
        ("Bedroom 2", "3.40m x 2.90m", "9.9 sq m"),
        ("Bedroom 3", "2.70m x 2.40m", "6.5 sq m"),
        ("Bathroom", "2.10m x 1.80m", "3.8 sq m"),
        ("Landing", "2.50m x 1.70m", "4.3 sq m"),
    ]

    for room, dims, area in first_rooms:
        c.drawString(90, y, f"{room}:")
        c.drawString(220, y, dims)
        c.drawString(340, y, f"({area})")
        y -= line_height

    # Footer
    c.setFont("Helvetica", 9)
    c.drawCentredString(page_width / 2, 50, "OpenHouse Park Development - The Keeley House Type")
    c.drawCentredString(page_width / 2, 35, "All dimensions are approximate and should be verified on site")


def main():
    output_dir = os.path.dirname(os.path.abspath(__file__))
    output_path = os.path.join(output_dir, "keeley-floorplan.pdf")

    page_width, page_height = A4
    c = canvas.Canvas(output_path, pagesize=A4)

    # Page 1: Ground Floor
    create_ground_floor(c, page_width, page_height)
    c.showPage()

    # Page 2: First Floor
    create_first_floor(c, page_width, page_height)
    c.showPage()

    # Page 3: Summary
    create_summary_page(c, page_width, page_height)

    c.save()
    print(f"✅ Created floor plan PDF: {output_path}")
    print("\nTo upload to demo, run:")
    print(f"npx tsx scripts/upload-floorplan-pdf.ts {output_path}")


if __name__ == "__main__":
    main()
