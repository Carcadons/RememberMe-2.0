#!/usr/bin/env python3
import sys
import base64
import xml.etree.ElementTree as ET

def svg_to_base64_png(svg_content, size):
    """
    Convert SVG to base64-encoded PNG.
    This is a simplified version that creates a placeholder PNG with the right dimensions.
    For a full implementation, you would use libraries like Cairo or Pillow with drawing.
    """
    try:
        from PIL import Image, ImageDraw
        import io

        # Create a new image with the specified size
        img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
        draw = ImageDraw.Draw(img)

        # Parse SVG to extract main elements (simplified)
        # Since this is complex, we'll create a simple representation

        # Create gradient background similar to the favicon
        # Using the purple gradient from the SVG
        for y in range(size):
            # Simple vertical gradient from #6366f1 to #8b5cf6
            r = int(99 + (139 - 99) * (y / size))
            g = int(102 + (92 - 102) * (y / size))
            b = int(241 + (246 - 241) * (y / size))
            draw.line([(0, y), (size, y)], fill=(r, g, b, 255))

        # Draw a simple center "brain" representation
        center = size // 2
        radius = int(size * 0.45)
        margin = int(size * 0.1)

        # Draw circles to represent the brain nodes
        circle_radius = int(size * 0.08)
        draw.ellipse(
            [(center - circle_radius - int(size * 0.15), center - circle_radius),
             (center + circle_radius - int(size * 0.15), center + circle_radius)],
            fill=(255, 255, 255, 230)
        )

        draw.ellipse(
            [(center - circle_radius + int(size * 0.15), center - circle_radius),
             (center + circle_radius + int(size * 0.15), center + circle_radius)],
            fill=(255, 255, 255, 230)
        )

        draw.ellipse(
            [(center - circle_radius, center - circle_radius - int(size * 0.15)),
             (center + circle_radius, center + circle_radius - int(size * 0.15))],
            fill=(255, 255, 255, 230)
        )

        # Save to buffer
        buffer = io.BytesIO()
        img.save(buffer, format='PNG')
        buffer.seek(0)

        # Return base64
        return base64.b64encode(buffer.read()).decode('utf-8')
    except ImportError:
        print("PIL library not available. Creating placeholder.")
        return None

def generate_html_placeholder(sizes):
    """Generate HTML with base64-encoded PNGs for various sizes."""
    svg_path = 'public/images/favicon.svg'

    # Read the SVG file
    with open(svg_path, 'r') as f:
        svg_content = f.read()

    print("Generating iOS icons...")

    html = """<!DOCTYPE html>
<html>
<head>
    <title>iOS Icon Generator</title>
</head>
<body>
    <h1>iOS App Icons</h1>
    <p>Use a proper SVG to PNG converter to generate these icons:</p>

    <div style="display: flex; flex-wrap: wrap; gap: 20px;">
"""

    for size in sizes:
        try:
            # Try to generate the icon
            base64_data = svg_to_base64_png(svg_content, size)

            if base64_data:
                html += f"""
        <div style="text-align: center;">
            <img src="data:image/png;base64,{base64_data}" width="{size}" height="{size}" style="border: 1px solid #ccc;">
            <p>{size}x{size}px</p>
        </div>
"""
                print(f"✓ Generated {size}x{size}px icon")
            else:
                html += f"""
        <div style="text-align: center;">
            <div style="width: {size}px; height: {size}px; border: 1px solid #ccc; display: flex; align-items: center; justify-content: center; background: linear-gradient(135deg, rgba(99, 102, 241, 0.15), rgba(139, 92, 246, 0.15));">
                <span style="font-size: {size//10}px;">{size}px</span>
            </div>
            <p>{size}x{size}px (placeholder)</p>
        </div>
"""
                print(f"✗ Could not generate {size}x{size}px icon (PIL required)")
        except Exception as e:
            print(f"Error generating {size}x{size}px: {e}")

    html += """
    </div>
</body>
</html>
"""

    # Save the HTML file
    with open('ios-icons.html', 'w') as f:
        f.write(html)
    print("\n✓ Generated ios-icons.html - open in browser to see icons")

    # Create a shell script for manual generation with proper tools
    script = """#!/bin/bash
# Generate iOS icons from favicon.svg using ImageMagick or similar tools
# Install ImageMagick first: brew install imagemagick

# Create icons directory
mkdir -p public/icons

# Generate various sizes
convert public/images/favicon.svg -resize 72x72 public/icons/icon-72x72.png
convert public/images/favicon.svg -resize 96x96 public/icons/icon-96x96.png
convert public/images/favicon.svg -resize 128x128 public/icons/icon-128x128.png
convert public/images/favicon.svg -resize 144x144 public/icons/icon-144x144.png
convert public/images/favicon.svg -resize 152x152 public/icons/icon-152x152.png
convert public/images/favicon.svg -resize 192x192 public/icons/icon-192x192.png
convert public/images/favicon.svg -resize 384x384 public/icons/icon-384x384.png
convert public/images/favicon.svg -resize 512x512 public/icons/icon-512x512.png

# Generate iOS-specific Apple Touch icons
convert public/images/favicon.svg -resize 76x76 public/icons/apple-touch-icon-76.png
convert public/images/favicon.svg -resize 120x120 public/icons/apple-touch-icon-120.png
convert public/images/favicon.svg -resize 152x152 public/icons/apple-touch-icon-152.png
convert public/images/favicon.svg -resize 180x180 public/icons/apple-touch-icon.png

# Additional iOS home screen icon
convert public/images/favicon.svg -resize 167x167 public/icons/apple-touch-icon-167.png

# Splash screen
convert public/images/favicon.svg -background "#6366f1" -gravity center -resize 50% -extent 640x1136 public/icons/splash-screen.png

echo "✓ All iOS icons generated in public/icons/"
"""

    with open('generate-icons.sh', 'w') as f:
        f.write(script)

    # Make it executable
    import os
    try:
        os.chmod('generate-icons.sh', 0o755)
        print("✓ Generated generate-icons.sh - run: ./generate-icons.sh (requires ImageMagick)")
    except Exception as e:
        print(f"Note: Could not make script executable: {e}")

    print("\n=== Alternative Method ===")
    print("Use an online SVG to PNG converter:")
    print("1. Upload: public/images/favicon.svg")
    print("2. Generate sizes: 72, 76, 96, 120, 128, 144, 152, 167, 180, 192, 384, 512")
    print("3. Save as: icon-{size}x{size}.png")

if __name__ == "__main__":
    # Icon sizes needed for iOS and PWA
    ios_sizes = [72, 76, 96, 120, 128, 144, 152, 167, 180, 192, 384, 512]

    generate_html_placeholder(ios_sizes)
