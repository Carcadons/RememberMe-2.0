// Photo Cropper Utility for Contact Photos
// Provides face detection and cropping functionality

class PhotoCropper {
  constructor() {
    this.canvas = null;
    this.ctx = null;
    this.originalImage = null;
    this.croppedImage = null;
  }

  /**
   * Create a canvas for image processing
   */
  createCanvas(width, height) {
    if (!this.canvas) {
      this.canvas = document.createElement('canvas');
      this.ctx = this.canvas.getContext('2d');
      document.body.appendChild(this.canvas);
      this.canvas.style.display = 'none';
    }
    this.canvas.width = width;
    this.canvas.height = height;
    return this.canvas;
  }

  /**
   * Estimate face position (simplified - assumes face is in center)
   * For a full implementation, use face-api.js or similar library
   */
  estimateFacePosition(width, height) {
    // Simplified face detection - assumes face is in the center
    // Returns a square crop area around the center
    const minSize = Math.min(width, height);
    const cropSize = Math.min(minSize, Math.round(minSize * 0.8)); // Use 80% of smaller dimension

    return {
      x: Math.round((width - cropSize) / 2),
      y: Math.round((height - cropSize) / 2),
      width: cropSize,
      height: cropSize
    };
  }

  /**
   * Smart crop image around face
   * @param {string|File} imageSource - Image URL or File object
   * @param {Object} options - Cropping options
   * @returns {Promise<string>} - Cropped image as data URL
   */
  async smartCropImage(imageSource, options = {}) {
    const {
      targetSize = 256,
      maintainAspectRatio = true
    } = options;

    return new Promise((resolve, reject) => {
      const img = new Image();

      img.onload = () => {
        try {
          this.originalImage = img;

          // Create canvas
          const canvas = this.createCanvas(img.width, img.height);
          const ctx = this.ctx;

          // Draw original image
          ctx.drawImage(img, 0, 0);

          // Estimate face position (center crop for now)
          const faceRect = this.estimateFacePosition(img.width, img.height);

          // Ensure the crop area is within image bounds
          const safeRect = this.ensureBounds(faceRect, img.width, img.height);

          // Create a new canvas for the cropped image
          const cropCanvas = document.createElement('canvas');
          const cropCtx = cropCanvas.getContext('2d');
          cropCanvas.width = targetSize;
          cropCanvas.height = targetSize;

          // Draw the cropped face area
          cropCtx.drawImage(
            canvas,
            safeRect.x, safeRect.y,
            safeRect.width, safeRect.height,
            0, 0,
            targetSize, targetSize
          );

          // Get the cropped image as data URL
          const croppedDataUrl = cropCanvas.toDataURL('image/jpeg', 0.9);
          this.croppedImage = croppedDataUrl;

          // Cleanup
          document.body.removeChild(cropCanvas);

          console.log('[PhotoCropper] Image cropped successfully');
          resolve(croppedDataUrl);

        } catch (error) {
          console.error('[PhotoCropper] Error cropping image:', error);
          reject(error);
        }
      };

      img.onerror = () => {
        console.error('[PhotoCropper] Failed to load image');
        reject(new Error('Failed to load image'));
      };

      // Handle both File and URL sources
      if (typeof imageSource === 'string') {
        img.src = imageSource;
      } else if (imageSource instanceof File) {
        const reader = new FileReader();
        reader.onload = (e) => {
          img.src = e.target.result;
        };
        reader.readAsDataURL(imageSource);
      } else {
        reject(new Error('Invalid image source'));
      }
    });
  }

  /**
   * Ensure crop rectangle is within image bounds
   */
  ensureBounds(rect, imgWidth, imgHeight) {
    const newRect = { ...rect };

    // Adjust if rectangle goes beyond left edge
    if (newRect.x < 0) {
      newRect.x = 0;
    }

    // Adjust if rectangle goes beyond top edge
    if (newRect.y < 0) {
      newRect.y = 0;
    }

    // Adjust if rectangle goes beyond right edge
    if (newRect.x + newRect.width > imgWidth) {
      newRect.width = imgWidth - newRect.x;
    }

    // Adjust if rectangle goes beyond bottom edge
    if (newRect.y + newRect.height > imgHeight) {
      newRect.height = imgHeight - newRect.y;
    }

    // Ensure minimum size
    const minSize = 64;
    if (newRect.width < minSize || newRect.height < minSize) {
      // Fallback to center crop with minimum size
      const size = Math.min(minSize, imgWidth, imgHeight);
      newRect.x = (imgWidth - size) / 2;
      newRect.y = (imgHeight - size) / 2;
      newRect.width = size;
      newRect.height = size;
    }

    return newRect;
  }

  /**
   * Show a manual crop interface
   * @param {string|File} imageSource - Image to crop
   * @param {Function} onCropComplete - Callback with cropped image
   */
  showManualCropper(imageSource, onCropComplete) {
    console.log('[PhotoCropper] Showing manual cropper');

    return new Promise((resolve, reject) => {
      const img = new Image();

      img.onload = () => {
        try {
          // Create modal overlay
          const overlay = document.createElement('div');
          overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.9);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 9999;
            backdrop-filter: blur(8px);
          `;

          const container = document.createElement('div');
          container.style.cssText = `
            max-width: 90vw;
            max-height: 80vh;
            position: relative;
            border-radius: 12px;
            overflow: hidden;
            box-shadow: 0 20px 40px rgba(0, 0, 0, 0.5);
          `;

          // Create canvas for image
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          const maxSize = 600;
          const scale = Math.min(maxSize / img.width, maxSize / img.height);

          canvas.width = img.width * scale;
          canvas.height = img.height * scale;

          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

          // Add instructions
          const instructions = document.createElement('div');
          instructions.style.cssText = `
            position: absolute;
            top: 20px;
            left: 50%;
            transform: translateX(-50%);
            color: white;
            font-size: 16px;
            text-align: center;
            font-weight: 500;
            text-shadow: 0 2px 4px rgba(0,0,0,0.5);
          `;
          instructions.textContent = 'Tap to confirm this image';

          // Add button container
          const buttonContainer = document.createElement('div');
          buttonContainer.style.cssText = `
            position: absolute;
            bottom: 20px;
            left: 50%;
            transform: translateX(-50%);
            display: flex;
            gap: 12px;
          `;

          // Confirm button
          const confirmBtn = document.createElement('button');
          confirmBtn.textContent = 'Use This Image';
          confirmBtn.className = 'btn btn-primary';
          confirmBtn.style.cssText = `
            padding: 12px 24px;
            border-radius: 24px;
            font-weight: 600;
          `;

          // Cancel button
          const cancelBtn = document.createElement('button');
          cancelBtn.textContent = 'Cancel';
          cancelBtn.className = 'btn btn-secondary';
          cancelBtn.style.cssText = `
            padding: 12px 24px;
            border-radius: 24px;
            font-weight: 600;
          `;

          buttonContainer.appendChild(confirmBtn);
          buttonContainer.appendChild(cancelBtn);

          // Auto-crop (center square) as preview
          const previewSize = Math.min(canvas.width, canvas.height) * 0.8;
          const previewX = (canvas.width - previewSize) / 2;
          const previewY = (canvas.height - previewSize) / 2;

          // Draw crop indicator
          ctx.strokeStyle = '#6366f1';
          ctx.lineWidth = 3;
          ctx.strokeRect(previewX, previewY, previewSize, previewSize);

          ctx.fillStyle = 'rgba(99, 102, 241, 0.2)';
          ctx.fillRect(previewX, previewY, previewSize, previewSize);

          container.appendChild(instructions);
          container.appendChild(canvas);
          container.appendChild(buttonContainer);
          overlay.appendChild(container);
          document.body.appendChild(overlay);

          // Confirm button handler
          confirmBtn.addEventListener('click', () => {
            // Crop the image
            const cropCanvas = document.createElement('canvas');
            const cropCtx = cropCanvas.getContext('2d');
            cropCanvas.width = 256;
            cropCanvas.height = 256;

            cropCtx.drawImage(
              canvas,
              previewX, previewY, previewSize, previewSize,
              0, 0, 256, 256
            );

            const croppedDataUrl = cropCanvas.toDataURL('image/jpeg', 0.9);

            document.body.removeChild(overlay);
            resolve(croppedDataUrl);
          });

          // Cancel button handler
          cancelBtn.addEventListener('click', () => {
            document.body.removeChild(overlay);
            reject(new Error('User cancelled'));
          });

          // Overlay click handler (cancel)
          overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
              document.body.removeChild(overlay);
              reject(new Error('User cancelled'));
            }
          });

        } catch (error) {
          reject(error);
        }
      };

      img.onerror = () => {
        reject(new Error('Failed to load image'));
      };

      if (typeof imageSource === 'string') {
        img.src = imageSource;
      } else if (imageSource instanceof File) {
        const reader = new FileReader();
        reader.onload = (e) => {
          img.src = e.target.result;
        };
        reader.readAsDataURL(imageSource);
      }
    });
  }

  /**
   * Cleanup function
   */
  destroy() {
    if (this.canvas && this.canvas.parentNode) {
      document.body.removeChild(this.canvas);
    }
    this.canvas = null;
    this.ctx = null;
    this.originalImage = null;
    this.croppedImage = null;
  }
}

// Export singleton instance
window.photoCropper = new PhotoCropper();
