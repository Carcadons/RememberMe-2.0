#!/usr/bin/env python3
"""
Generate iOS and PWA icons from favicon.svg
"""

import os
from PIL import Image, ImageDraw
import xml.etree.ElementTree as ET

def parse_svg_colors(svg_path):
    """Extract colors from the SVG gradient"""
    try:
        tree = ET.parse(svg_path)
        root = tree.getroot()

        # Find linearGradient
        gradient = root.find('.//{http://www.w3.org/2000/svg}linearGradient')
        if gradient is None:
            gradient = root.find('.//linearGradient')

        stops = []
        if gradient is not None:
            for stop in gradient.findall('{http://www.w3.org/2000/svg}stop'):
                stops.append(stop.get('stop-color'))
            if not stops:
                for stop in gradient.findall('stop'):
                    stops.append(stop.get('stop-color'))

        return stops if stops else ['#6366f1', '#8b5cf6']
    except Exception as e:
        print(f"Warning: Could not parse SVG colors: {e}")
        return ['#6366f1', '#8b5cf6']

def hex_to_rgb(hex_color):
    """Convert hex color to RGB tuple"""
    hex_color = hex_color.lstrip('#')
    return tuple(int(hex_color[i:i+2], 16) for i in (0, 2, 4))

def create_icon(size, colors, output_path):
    """Create a proper icon with gradient and brain-like elements"""
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    # Parse colors
    color1 = hex_to_rgb(colors[0])
    color2 = hex_to_rgb(colors[1])

    # Create gradient background (linear gradient)
    for y in range(size):
        ratio = y / size
        r = int(color1[0] + (color2[0] - color1[0]) * ratio)
        g = int(color1[1] + (color2[1] - color1[1]) * ratio)
        b = int(color1[2] + (color2[2] - color1[2]) * ratio)
        draw.line([(0, y), (size, y)], fill=(r, g, b, 255))

    # Draw circles to represent brain nodes (based on original SVG)
    center_x = size // 2
    center_y = size // 2
    node_radius = max(4, size // 15)

    # Three main nodes in a triangular pattern
    nodes = [
        (center_x - int(size * 0.12), center_y),  # Left
        (center_x, center_y - int(size * 0.15)),  # Top
        (center_x + int(size * 0.12), center_y)   # Right
    ]

    # Draw nodes
    for (x, y) in nodes:
        bbox = [(x - node_radius, y - node_radius),
                (x + node_radius, y + node_radius)]
        draw.ellipse(bbox, fill=(255, 255, 255, 240))

    # Draw connecting lines
    line_width = max(2, size // 60)
    # Top to left node
    draw.line([nodes[1][0], nodes[1][1], nodes[0][0], nodes[0][1]],
              fill=(255, 255, 255, 180), width=line_width)
    # Top to right node
    draw.line([nodes[1][0], nodes[1][1], nodes[2][0], nodes[2][1]],
              fill=(255, 255, 255, 180), width=line_width)

    # Save the image
    img.save(output_path, 'PNG')
    print(f"  Created {output_path} ({size}x{size}px)")

def main():
    # SVG path
    svg_path = 'public/images/favicon.svg'

    if not os.path.exists(svg_path):
        print(f"Error: {svg_path} not found!")
        return

    # Parse colors from SVG
    colors = parse_svg_colors(svg_path)
    print(f"Using gradient colors: {colors[0]} to {colors[1]}")

    # Create output directory
    os.makedirs('public/icons', exist_ok=True)

    # Sizes for PWA manifest and iOS
    sizes = {
        # PWA manifest icons
        72: 'icon-72x72.png',
        96: 'icon-96x96.png',
        128: 'icon-128x128.png',
        144: 'icon-144x144.png',
        152: 'icon-152x152.png',
        192: 'icon-192x192.png',
        384: 'icon-384x384.png',
        512: 'icon-512x512.png',

        # iOS Apple Touch icons
        76: 'apple-touch-icon-76.png',
        120: 'apple-touch-icon-120.png',
        152: 'apple-touch-icon-152.png',
        167: 'apple-touch-icon-167.png',
        180: 'apple-touch-icon.png',

        # Splash screen
        640: 'splash-screen.png'
    }

    print("\nGenerating iOS and PWA icons...")

    # Generate all icons
    for size, filename in sizes.items():
        output_path = f'public/icons/{filename}'
        create_icon(size, colors, output_path)

    print(f"\n✓ Successfully generated {len(sizes)} icons in public/icons/")
    print("\nYou can now test the app on iOS and add it to the home screen.")

if __name__ == "__main__":
    try:
        main()
    except ImportError:
        print("Error: PIL (Pillow) is required.")
        print("Install with: pip3 install Pillow")
    except Exception as e:
        print(f"Error: {e}")
