#!/bin/bash
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
