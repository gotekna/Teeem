#!/usr/bin/env python3
"""Generate a demo floor plan PDF for takeoff testing."""

from reportlab.lib.pagesizes import A3
from reportlab.lib.units import mm
from reportlab.pdfgen import canvas
from reportlab.lib.colors import black, gray, lightgrey, white, Color

OUTPUT = "frontend-next/public/demo/floor-plan.pdf"

# A3 landscape
WIDTH, HEIGHT = A3[1], A3[0]

c = canvas.Canvas(OUTPUT, pagesize=(WIDTH, HEIGHT))
c.setTitle("Demo Floor Plan - 1:100 Scale")

# Grid background
c.setStrokeColor(Color(0.9, 0.9, 0.9))
c.setLineWidth(0.25)
for x in range(0, int(WIDTH), int(10 * mm)):
    c.line(x, 0, x, HEIGHT)
for y in range(0, int(HEIGHT), int(10 * mm)):
    c.line(0, y, WIDTH, y)

# Scale bar (1:100 means 1mm on paper = 100mm real = 10cm)
# So 10mm on paper = 1m real
scale_x = 20 * mm
scale_y = 15 * mm
c.setStrokeColor(black)
c.setLineWidth(1.5)
c.setFillColor(black)
c.setFont("Helvetica-Bold", 8)

# 5m scale bar = 50mm on paper at 1:100
bar_length = 50 * mm
c.line(scale_x, scale_y, scale_x + bar_length, scale_y)
c.line(scale_x, scale_y - 2 * mm, scale_x, scale_y + 2 * mm)
c.line(scale_x + bar_length, scale_y - 2 * mm, scale_x + bar_length, scale_y + 2 * mm)
# Tick marks at each meter
for i in range(6):
    tick_x = scale_x + i * 10 * mm
    c.line(tick_x, scale_y - 1.5 * mm, tick_x, scale_y + 1.5 * mm)
    c.drawCentredString(tick_x, scale_y - 5 * mm, f"{i}m")

c.setFont("Helvetica", 7)
c.drawString(scale_x, scale_y + 4 * mm, "SCALE 1:100")

# Title block
c.setFont("Helvetica-Bold", 14)
c.drawString(20 * mm, HEIGHT - 20 * mm, "DEMO FLOOR PLAN")
c.setFont("Helvetica", 10)
c.drawString(20 * mm, HEIGHT - 27 * mm, "Scale 1:100  |  A3 Landscape  |  For Takeoff Testing")
c.setFont("Helvetica", 8)
c.drawString(20 * mm, HEIGHT - 34 * mm, "Use the scale bar (bottom-left) to calibrate. Each division = 1 metre.")

# Wall thickness
wall = 2.5 * mm  # 250mm walls at 1:100

# ---- HOUSE OUTLINE ----
# Main house: 12m x 8m = 120mm x 80mm on paper
house_x = 80 * mm
house_y = 60 * mm
house_w = 120 * mm
house_h = 80 * mm

c.setStrokeColor(black)
c.setLineWidth(2)
c.setFillColor(white)

# Outer walls
c.rect(house_x, house_y, house_w, house_h, fill=1)

# ---- ROOMS ----
c.setLineWidth(1.5)
c.setFillColor(white)

# Living room: 6m x 5m (left side)
living_w = 60 * mm
living_h = 50 * mm
c.rect(house_x, house_y + house_h - living_h, living_w, living_h)
c.setFont("Helvetica", 7)
c.setFillColor(gray)
c.drawCentredString(house_x + living_w / 2, house_y + house_h - living_h / 2, "LIVING ROOM")
c.drawCentredString(house_x + living_w / 2, house_y + house_h - living_h / 2 - 4 * mm, "6.0m x 5.0m")
c.setFillColor(white)

# Kitchen: 6m x 3m (left bottom)
kitchen_h = 30 * mm
c.rect(house_x, house_y, living_w, kitchen_h)
c.setFillColor(gray)
c.drawCentredString(house_x + living_w / 2, house_y + kitchen_h / 2, "KITCHEN")
c.drawCentredString(house_x + living_w / 2, house_y + kitchen_h / 2 - 4 * mm, "6.0m x 3.0m")
c.setFillColor(white)

# Bedroom 1: 4m x 4m (top right)
bed1_w = 40 * mm
bed1_h = 40 * mm
bed1_x = house_x + living_w
bed1_y = house_y + house_h - bed1_h
c.rect(bed1_x, bed1_y, bed1_w, bed1_h)
c.setFillColor(gray)
c.drawCentredString(bed1_x + bed1_w / 2, bed1_y + bed1_h / 2, "BEDROOM 1")
c.drawCentredString(bed1_x + bed1_w / 2, bed1_y + bed1_h / 2 - 4 * mm, "4.0m x 4.0m")
c.setFillColor(white)

# Bedroom 2: 4m x 4m (right, below bed1, leaving space for hallway)
bed2_w = 40 * mm
bed2_h = 30 * mm
bed2_x = house_x + living_w + 20 * mm
bed2_y = house_y
c.rect(bed2_x, bed2_y, bed2_w, bed2_h)
c.setFillColor(gray)
c.drawCentredString(bed2_x + bed2_w / 2, bed2_y + bed2_h / 2, "BEDROOM 2")
c.drawCentredString(bed2_x + bed2_w / 2, bed2_y + bed2_h / 2 - 4 * mm, "4.0m x 3.0m")
c.setFillColor(white)

# Bathroom: 2m x 3m (middle right area)
bath_w = 20 * mm
bath_h = 30 * mm
bath_x = house_x + living_w
bath_y = house_y
c.rect(bath_x, bath_y, bath_w, bath_h)
c.setFillColor(gray)
c.drawCentredString(bath_x + bath_w / 2, bath_y + bath_h / 2, "BATH")
c.drawCentredString(bath_x + bath_w / 2, bath_y + bath_h / 2 - 4 * mm, "2.0m x 3.0m")
c.setFillColor(white)

# Hallway label
hall_x = house_x + living_w
hall_y = house_y + bath_h
c.setFillColor(Color(0.7, 0.7, 0.7))
c.setFont("Helvetica", 6)
c.drawCentredString(hall_x + 30 * mm, hall_y + 5 * mm, "HALLWAY")

# ---- DOORS (arcs) ----
c.setStrokeColor(black)
c.setLineWidth(0.75)
c.setFillColor(white)

# Door openings (gaps in walls + arc)
def draw_door(x, y, size=8*mm, direction="right"):
    """Draw a door arc."""
    import math
    c.setDash([], 0)
    if direction == "right":
        c.arc(x, y, x + size, y + size, 0, 90)
        c.line(x, y, x + size, y)
    elif direction == "up":
        c.arc(x, y, x + size, y + size, 0, 90)
        c.line(x, y, x, y + size)

# Front door (bottom of living room)
draw_door(house_x + 25 * mm, house_y + house_h - living_h - 1 * mm)

# ---- DIMENSIONS ----
c.setStrokeColor(Color(0.2, 0.2, 0.8))
c.setFillColor(Color(0.2, 0.2, 0.8))
c.setLineWidth(0.5)
c.setFont("Helvetica", 6)

def draw_dimension(x1, y1, x2, y2, label, offset=8*mm):
    """Draw a dimension line with label."""
    import math
    dx = x2 - x1
    dy = y2 - y1
    length = math.sqrt(dx * dx + dy * dy)

    if abs(dy) < 0.1:  # Horizontal
        # Dimension above
        c.line(x1, y1 + offset, x2, y1 + offset)
        c.line(x1, y1, x1, y1 + offset + 2 * mm)
        c.line(x2, y2, x2, y2 + offset + 2 * mm)
        # Arrows
        c.line(x1, y1 + offset, x1 + 2 * mm, y1 + offset + 1 * mm)
        c.line(x1, y1 + offset, x1 + 2 * mm, y1 + offset - 1 * mm)
        c.line(x2, y2 + offset, x2 - 2 * mm, y2 + offset + 1 * mm)
        c.line(x2, y2 + offset, x2 - 2 * mm, y2 + offset - 1 * mm)
        c.drawCentredString((x1 + x2) / 2, y1 + offset + 2 * mm, label)
    else:  # Vertical
        c.line(x1 - offset, y1, x1 - offset, y2)
        c.line(x1, y1, x1 - offset - 2 * mm, y1)
        c.line(x2, y2, x2 - offset - 2 * mm, y2)
        c.line(x1 - offset, y1, x1 - offset + 1 * mm, y1 + 2 * mm)
        c.line(x1 - offset, y1, x1 - offset - 1 * mm, y1 + 2 * mm)
        c.line(x2 - offset, y2, x2 - offset + 1 * mm, y2 - 2 * mm)
        c.line(x2 - offset, y2, x2 - offset - 1 * mm, y2 - 2 * mm)
        c.saveState()
        c.translate(x1 - offset - 2 * mm, (y1 + y2) / 2)
        c.rotate(90)
        c.drawCentredString(0, 0, label)
        c.restoreState()

# Overall dimensions
draw_dimension(house_x, house_y + house_h, house_x + house_w, house_y + house_h, "12,000", 10 * mm)
draw_dimension(house_x, house_y, house_x, house_y + house_h, "8,000", 12 * mm)

# Room dimensions
draw_dimension(house_x, house_y + house_h - living_h, house_x + living_w, house_y + house_h - living_h, "6,000", -6 * mm)

# ---- GARAGE (separate structure) ----
garage_x = house_x + house_w + 20 * mm
garage_y = house_y
garage_w = 60 * mm  # 6m
garage_h = 60 * mm  # 6m

c.setStrokeColor(black)
c.setLineWidth(2)
c.setFillColor(white)
c.rect(garage_x, garage_y, garage_w, garage_h, fill=1)

c.setFillColor(gray)
c.setFont("Helvetica", 7)
c.drawCentredString(garage_x + garage_w / 2, garage_y + garage_h / 2, "DOUBLE GARAGE")
c.drawCentredString(garage_x + garage_w / 2, garage_y + garage_h / 2 - 4 * mm, "6.0m x 6.0m")

# Garage door (dashed)
c.setStrokeColor(black)
c.setLineWidth(1)
c.setDash([3, 3], 0)
c.line(garage_x + 5 * mm, garage_y, garage_x + garage_w - 5 * mm, garage_y)
c.setDash([], 0)

# Garage dimension
c.setStrokeColor(Color(0.2, 0.2, 0.8))
c.setFillColor(Color(0.2, 0.2, 0.8))
draw_dimension(garage_x, garage_y + garage_h, garage_x + garage_w, garage_y + garage_h, "6,000", 8 * mm)

# ---- NORTH ARROW ----
arrow_x = WIDTH - 40 * mm
arrow_y = HEIGHT - 40 * mm
c.setStrokeColor(black)
c.setFillColor(black)
c.setLineWidth(1)
# Arrow shaft
c.line(arrow_x, arrow_y, arrow_x, arrow_y + 20 * mm)
# Arrow head
c.line(arrow_x, arrow_y + 20 * mm, arrow_x - 3 * mm, arrow_y + 15 * mm)
c.line(arrow_x, arrow_y + 20 * mm, arrow_x + 3 * mm, arrow_y + 15 * mm)
c.setFont("Helvetica-Bold", 10)
c.drawCentredString(arrow_x, arrow_y + 23 * mm, "N")

# ---- PAGE 2: Site Plan (simpler, for multi-page testing) ----
c.showPage()
c.setPageSize((WIDTH, HEIGHT))

# Title
c.setFont("Helvetica-Bold", 14)
c.drawString(20 * mm, HEIGHT - 20 * mm, "SITE PLAN")
c.setFont("Helvetica", 10)
c.drawString(20 * mm, HEIGHT - 27 * mm, "Scale 1:200  |  A3 Landscape")

# Scale bar for page 2 (1:200)
scale_x = 20 * mm
scale_y = 15 * mm
bar_length = 50 * mm  # = 10m at 1:200
c.setStrokeColor(black)
c.setLineWidth(1.5)
c.setFont("Helvetica-Bold", 8)
c.line(scale_x, scale_y, scale_x + bar_length, scale_y)
c.line(scale_x, scale_y - 2 * mm, scale_x, scale_y + 2 * mm)
c.line(scale_x + bar_length, scale_y - 2 * mm, scale_x + bar_length, scale_y + 2 * mm)
for i in range(6):
    tick_x = scale_x + i * 10 * mm
    c.line(tick_x, scale_y - 1.5 * mm, tick_x, scale_y + 1.5 * mm)
    c.drawCentredString(tick_x, scale_y - 5 * mm, f"{i * 2}m")
c.setFont("Helvetica", 7)
c.drawString(scale_x, scale_y + 4 * mm, "SCALE 1:200")

# Property boundary (30m x 20m = 150mm x 100mm at 1:200)
prop_x = 60 * mm
prop_y = 50 * mm
prop_w = 150 * mm
prop_h = 100 * mm

c.setStrokeColor(black)
c.setLineWidth(1)
c.setDash([5, 3], 0)
c.rect(prop_x, prop_y, prop_w, prop_h)
c.setDash([], 0)

# House footprint (smaller at this scale)
hf_x = prop_x + 30 * mm
hf_y = prop_y + 25 * mm
hf_w = 60 * mm   # 12m at 1:200
hf_h = 40 * mm   # 8m at 1:200
c.setLineWidth(2)
c.setFillColor(lightgrey)
c.rect(hf_x, hf_y, hf_w, hf_h, fill=1)
c.setFillColor(gray)
c.setFont("Helvetica", 7)
c.drawCentredString(hf_x + hf_w / 2, hf_y + hf_h / 2, "HOUSE")

# Garage footprint
gf_x = hf_x + hf_w + 10 * mm
gf_y = hf_y
gf_w = 30 * mm   # 6m at 1:200
gf_h = 30 * mm   # 6m at 1:200
c.setFillColor(lightgrey)
c.rect(gf_x, gf_y, gf_w, gf_h, fill=1)
c.setFillColor(gray)
c.drawCentredString(gf_x + gf_w / 2, gf_y + gf_h / 2, "GARAGE")

# Driveway
c.setFillColor(Color(0.85, 0.85, 0.85))
c.rect(gf_x, prop_y, gf_w, gf_y - prop_y, fill=1)
c.setFillColor(gray)
c.setFont("Helvetica", 6)
c.drawCentredString(gf_x + gf_w / 2, prop_y + (gf_y - prop_y) / 2, "DRIVEWAY")

# Property dimensions
c.setStrokeColor(Color(0.2, 0.2, 0.8))
c.setFillColor(Color(0.2, 0.2, 0.8))
c.setLineWidth(0.5)
draw_dimension(prop_x, prop_y + prop_h, prop_x + prop_w, prop_y + prop_h, "30,000", 8 * mm)
draw_dimension(prop_x, prop_y, prop_x, prop_y + prop_h, "20,000", 10 * mm)

c.save()
print(f"Generated: {OUTPUT}")
print(f"  Page 1: Floor Plan (1:100, A3 landscape)")
print(f"  Page 2: Site Plan (1:200, A3 landscape)")
