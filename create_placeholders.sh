#!/bin/bash

# Create placeholder PNG files for iOS icons
# These can be replaced later with properly rendered versions

echo "Creating placeholder iOS icon files..."

# Create a simple colored square PNG using sips (macOS) or Python
mkdir -p public/icons

# Function to create a colored square PNG using Python
create_square() {
    size=$1
    filename=$2
    python3 <<EOF
import struct
import os

# Simple PNG creation - colored square
# PNG header (8 bytes)
png_header = b'\x89PNG\r\n\x1a\n'

# IHDR chunk
width = struct.pack('>I', $size)
height = struct.pack('>I', $size)
bit_depth = b'\x08'
color_type = b'\x06'  # RGBA
compression = b'\x00'
filter_method = b'\x00'
interlace = b'\x00'

ihdr_data = width + height + bit_depth + color_type + compression + filter_method + interlace
ihdr_length = struct.pack('>I', 13)
ihdr_type = b'IHDR'
ihdr_crc = struct.pack('>I', 0x9a0a9f9e)  # Pre-calculated for simplicity

# IDAT chunk - create a simple gradient
# For simplicity, create a single colored pixel and replicate it
pixel_color = b'\xa7\xa7\xff\xff'  # Light purple/pink with alpha
scanline = b'\x00' + (pixel_color * $size)
scanlines = scanline * $size

import zlib
compressed = zlib.compress(scanlines)
idat_length = struct.pack('>I', len(compressed))
idat_type = b'IDAT'
idat_data = compressed
import binascii
idat_crc = struct.pack('>I', binascii.crc32(idat_type + idat_data) & 0xffffffff)

# IEND chunk
iend_length = struct.pack('>I', 0)
iend_type = b'IEND'
iend_crc = struct.pack('>I', 0xae426082)

# Write PNG
with open('$filename', 'wb') as f:
    f.write(png_header)
    f.write(ihdr_length)
    f.write(ihdr_type)
    f.write(ihdr_data)
    f.write(ihdr_crc)
    f.write(idat_length)
    f.write(idat_type)
    f.write(idat_data)
    f.write(idat_crc)
    f.write(iend_length)
    f.write(iend_type)
    f.write(iend_crc)

print("  Created $filename (${size}x${size}px)")
EOF
}

# Create icons for manifest
create_square 72 "public/icons/icon-72x72.png"
create_square 96 "public/icons/icon-96x96.png"
create_square 128 "public/icons/icon-128x128.png"
create_square 144 "public/icons/icon-144x144.png"
create_square 152 "public/icons/icon-152x152.png"
create_square 192 "public/icons/icon-192x192.png"
create_square 384 "public/icons/icon-384x384.png"
create_square 512 "public/icons/icon-512x512.png"

# Create iOS-specific icons
create_square 76 "public/icons/apple-touch-icon-76.png"
create_square 120 "public/icons/apple-touch-icon-120.png"
create_square 152 "public/icons/apple-touch-icon-152.png"
create_square 167 "public/icons/apple-touch-icon-167.png"
create_square 180 "public/icons/apple-touch-icon.png"

# Create splash screen
create_square 640 "public/icons/splash-screen.png"

echo ""
echo "✓ Created all placeholder icons in public/icons/"
echo ""
echo "NOTE: These are COLORED PLACEHOLDERS. You should replace them with"
echo "properly rendered icons from the SVG using an online converter:"
echo ""
echo "1. Visit: https://cloudconvert.com/svg-to-png"
echo "2. Upload: public/images/favicon.svg"
echo "3. Convert to PNG with sizes: 72, 76, 96, 120, 128, 144, 152, 167, 180, 192, 384, 512"
echo "4. Save as: icon-{size}x{size}.png or apple-touch-icon{-size}.png"
echo ""
echo "Or use ImageMagick when available:"
echo "convert public/images/favicon.svg -resize 180x180 public/icons/apple-touch-icon.png"
