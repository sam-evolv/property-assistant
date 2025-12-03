#!/usr/bin/env python3
"""Generate a sample property document for Riverside Gardens"""

from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, PageBreak
from reportlab.lib.enums import TA_JUSTIFY, TA_CENTER

# Create PDF
pdf_filename = "Riverside_Gardens_Property_Information.pdf"
doc = SimpleDocTemplate(pdf_filename, pagesize=letter)
story = []
styles = getSampleStyleSheet()

# Add custom styles
title_style = ParagraphStyle(
    'CustomTitle',
    parent=styles['Heading1'],
    fontSize=24,
    textColor='darkblue',
    spaceAfter=30,
    alignment=TA_CENTER
)

heading_style = ParagraphStyle(
    'CustomHeading',
    parent=styles['Heading2'],
    fontSize=16,
    textColor='darkblue',
    spaceAfter=12,
    spaceBefore=12
)

# Title
story.append(Paragraph("Riverside Gardens", title_style))
story.append(Paragraph("Luxury Apartment Development", styles['Heading2']))
story.append(Spacer(1, 0.5*inch))

# Overview
story.append(Paragraph("Development Overview", heading_style))
overview_text = """
Riverside Gardens is a prestigious new development located at 123 River Boulevard in Dublin 2. 
This exclusive collection of 48 luxury apartments offers contemporary living with stunning views 
of the River Liffey. Each residence has been meticulously designed to provide the perfect blend 
of style, comfort, and sustainability.
"""
story.append(Paragraph(overview_text, styles['BodyText']))
story.append(Spacer(1, 0.3*inch))

# Amenities
story.append(Paragraph("Premium Amenities", heading_style))
amenities_text = """
<b>Building Features:</b><br/>
• 24-hour concierge and security service<br/>
• Secure underground parking with electric vehicle charging stations<br/>
• Residents' gym with state-of-the-art equipment<br/>
• Rooftop terrace with panoramic city and river views<br/>
• Bicycle storage and maintenance area<br/>
• Package receiving and secure parcel lockers<br/>
<br/>
<b>Apartment Features:</b><br/>
• High-quality German kitchens with Miele appliances<br/>
• Underfloor heating throughout<br/>
• Floor-to-ceiling windows for maximum natural light<br/>
• Smart home technology integration<br/>
• Engineered oak flooring<br/>
• Private balconies (most units)<br/>
"""
story.append(Paragraph(amenities_text, styles['BodyText']))
story.append(Spacer(1, 0.3*inch))

# Specifications
story.append(Paragraph("Technical Specifications", heading_style))
specs_text = """
<b>Energy Efficiency:</b><br/>
All apartments achieve an A2 Building Energy Rating (BER), ensuring low running costs 
and environmental impact. The development features solar panels, heat recovery ventilation, 
and high-performance insulation.
<br/><br/>
<b>Heating & Hot Water:</b><br/>
Central heating system with individual apartment control. Hot water provided via 
energy-efficient heat pumps. Underfloor heating in bathrooms and main living areas.
<br/><br/>
<b>Internet & Connectivity:</b><br/>
High-speed fiber optic broadband (1Gbps) included in all apartments. Full WiFi coverage 
in common areas. Pre-wired for smart home devices and systems.
"""
story.append(Paragraph(specs_text, styles['BodyText']))
story.append(Spacer(1, 0.3*inch))

# Unit Types
story.append(Paragraph("Available Unit Types", heading_style))
units_text = """
<b>One Bedroom Apartments:</b> 55-65 sqm<br/>
Perfect for professionals or first-time buyers. Open-plan living/kitchen area, 
spacious bedroom with fitted wardrobes, luxury bathroom.
<br/><br/>
<b>Two Bedroom Apartments:</b> 75-85 sqm<br/>
Ideal for small families or those wanting extra space. Master bedroom with ensuite, 
second bedroom, main bathroom, large living/dining area.
<br/><br/>
<b>Three Bedroom Apartments:</b> 95-110 sqm<br/>
Generous family homes with master ensuite, two additional bedrooms, family bathroom, 
spacious living areas, and premium finishes throughout.
<br/><br/>
<b>Penthouse Apartments:</b> 120-145 sqm<br/>
Exclusive top-floor residences featuring private roof terraces, three bedrooms, 
two bathrooms, stunning city and river views.
"""
story.append(Paragraph(units_text, styles['BodyText']))
story.append(Spacer(1, 0.3*inch))

# Location
story.append(Paragraph("Prime Location & Transport", heading_style))
location_text = """
Riverside Gardens enjoys an enviable position in Dublin 2, with excellent transport 
links and amenities on your doorstep.
<br/><br/>
<b>Public Transport:</b><br/>
• Tara Street DART station: 5 minutes walk<br/>
• Multiple Dublin Bus routes: 2 minutes walk<br/>
• Luas Red Line: 8 minutes walk<br/>
• Dublin City Centre: 10 minutes walk<br/>
<br/>
<b>Local Amenities:</b><br/>
• Trinity College Dublin: 12 minutes walk<br/>
• Grand Canal: 5 minutes walk<br/>
• Multiple supermarkets and shops within 500m<br/>
• Restaurants, cafes, and entertainment venues nearby<br/>
• St. Stephen's Green: 15 minutes walk<br/>
"""
story.append(Paragraph(location_text, styles['BodyText']))
story.append(Spacer(1, 0.3*inch))

# Management
story.append(Paragraph("Property Management & Service Charges", heading_style))
management_text = """
<b>Management Company:</b><br/>
Riverside Gardens Management Company Ltd. manages all common areas and building services.
<br/><br/>
<b>Service Charge:</b><br/>
Estimated annual service charge ranges from €1,800 to €3,200 depending on apartment size. 
This covers building insurance, maintenance of common areas, concierge service, gym facilities, 
and landscaping.
<br/><br/>
<b>Waste Management:</b><br/>
Central waste management system with recycling facilities. Collection is included in the 
service charge.
<br/><br/>
<b>Contact Information:</b><br/>
Development Manager: Michael O'Brien<br/>
Email: michael.obrien@riversidegardens.ie<br/>
Phone: +353 1 234 5678<br/>
Office Hours: Monday-Friday 9am-5pm<br/>
"""
story.append(Paragraph(management_text, styles['BodyText']))
story.append(Spacer(1, 0.3*inch))

# Utilities
story.append(Paragraph("Utility Providers & Setup", heading_style))
utilities_text = """
<b>Electricity:</b><br/>
Residents can choose their own electricity supplier. The development is connected to 
the ESB Networks grid. Smart meters are installed in all apartments.
<br/><br/>
<b>Gas:</b><br/>
Natural gas is supplied via Gas Networks Ireland. Residents can select from various 
retail suppliers including Bord Gáis Energy, Energia, and SSE Airtricity.
<br/><br/>
<b>Water:</b><br/>
Water supply and wastewater services provided by Irish Water. Charges may apply based 
on government policy.
<br/><br/>
<b>Telecommunications:</b><br/>
The building is pre-wired for all major providers including Virgin Media, Eir, Sky, and Vodafone.
"""
story.append(Paragraph(utilities_text, styles['BodyText']))
story.append(Spacer(1, 0.3*inch))

# Warranty
story.append(Paragraph("Warranty & Guarantees", heading_style))
warranty_text = """
All apartments come with comprehensive warranties and guarantees for peace of mind:
<br/><br/>
• Homebond structural guarantee (10 years)<br/>
• Premier Guarantee (10-year structural warranty)<br/>
• Manufacturer warranties on all appliances<br/>
• Snag list completion guarantee<br/>
• After-sales support from the developer for 12 months<br/>
"""
story.append(Paragraph(warranty_text, styles['BodyText']))

# Build PDF
doc.build(story)
print(f"PDF created: {pdf_filename}")
