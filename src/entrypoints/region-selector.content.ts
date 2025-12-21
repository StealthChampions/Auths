// Content script for region selection overlay
// This script is injected into the page to allow users to select a region with mouse

export default defineContentScript({
  matches: ['<all_urls>'],
  runAt: 'document_idle',
  main() {
    // Listen for messages from the extension
    chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
      if (message.action === 'startRegionSelection') {
        startRegionSelection()
          .then(sendResponse)
          .catch((error) => sendResponse({ error: error.message }));
        return true; // Will respond asynchronously
      }
    });

    function startRegionSelection(): Promise<{ imageData: string; x: number; y: number; width: number; height: number }> {
      return new Promise((resolve, reject) => {
        // Create overlay container
        const overlay = document.createElement('div');
        overlay.id = 'auths-region-selector-overlay';
        overlay.style.cssText = `
          position: fixed;
          top: 0;
          left: 0;
          width: 100vw;
          height: 100vh;
          background: rgba(0, 0, 0, 0.3);
          cursor: crosshair;
          z-index: 2147483647;
          user-select: none;
        `;

        // Create selection box
        const selectionBox = document.createElement('div');
        selectionBox.id = 'auths-selection-box';
        selectionBox.style.cssText = `
          position: fixed;
          border: 2px dashed #2563eb;
          background: rgba(37, 99, 235, 0.1);
          pointer-events: none;
          display: none;
          z-index: 2147483647;
        `;

        // Create instruction tooltip
        const tooltip = document.createElement('div');
        tooltip.id = 'auths-tooltip';
        tooltip.textContent = chrome.i18n.getMessage('qr_region_instruction') || 'Click and drag to select QR code area. Press ESC to cancel.';
        tooltip.style.cssText = `
          position: fixed;
          top: 20px;
          left: 50%;
          transform: translateX(-50%);
          background: rgba(0, 0, 0, 0.8);
          color: white;
          padding: 12px 24px;
          border-radius: 8px;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          font-size: 14px;
          z-index: 2147483647;
          pointer-events: none;
        `;

        document.body.appendChild(overlay);
        document.body.appendChild(selectionBox);
        document.body.appendChild(tooltip);

        let startX = 0;
        let startY = 0;
        let isSelecting = false;

        const cleanup = () => {
          overlay.remove();
          selectionBox.remove();
          tooltip.remove();
          document.removeEventListener('keydown', handleKeyDown);
        };

        const handleKeyDown = (e: KeyboardEvent) => {
          if (e.key === 'Escape') {
            cleanup();
            reject(new Error('Selection cancelled'));
          }
        };

        document.addEventListener('keydown', handleKeyDown);

        overlay.addEventListener('mousedown', (e) => {
          isSelecting = true;
          startX = e.clientX;
          startY = e.clientY;
          selectionBox.style.left = `${startX}px`;
          selectionBox.style.top = `${startY}px`;
          selectionBox.style.width = '0px';
          selectionBox.style.height = '0px';
          selectionBox.style.display = 'block';
        });

        overlay.addEventListener('mousemove', (e) => {
          if (!isSelecting) return;

          const currentX = e.clientX;
          const currentY = e.clientY;

          const left = Math.min(startX, currentX);
          const top = Math.min(startY, currentY);
          const width = Math.abs(currentX - startX);
          const height = Math.abs(currentY - startY);

          selectionBox.style.left = `${left}px`;
          selectionBox.style.top = `${top}px`;
          selectionBox.style.width = `${width}px`;
          selectionBox.style.height = `${height}px`;
        });

        overlay.addEventListener('mouseup', async (e) => {
          if (!isSelecting) return;
          isSelecting = false;

          const endX = e.clientX;
          const endY = e.clientY;

          const left = Math.min(startX, endX);
          const top = Math.min(startY, endY);
          const width = Math.abs(endX - startX);
          const height = Math.abs(endY - startY);

          // Minimum selection size
          if (width < 20 || height < 20) {
            cleanup();
            reject(new Error('Selection too small'));
            return;
          }

          // Hide overlay before capturing
          overlay.style.display = 'none';
          selectionBox.style.display = 'none';
          tooltip.style.display = 'none';

          // Wait a frame for the overlay to be hidden
          await new Promise(r => requestAnimationFrame(r));

          // Send message to background to capture the screen
          try {
            const response = await chrome.runtime.sendMessage({
              action: 'captureVisibleTab'
            });

            if (response.error) {
              cleanup();
              reject(new Error(response.error));
              return;
            }

            // Crop the image to the selected region
            const croppedImage = await cropImage(response.dataUrl, left, top, width, height);

            cleanup();
            resolve({
              imageData: croppedImage,
              x: left,
              y: top,
              width,
              height
            });
          } catch (error) {
            cleanup();
            reject(error);
          }
        });
      });
    }

    async function cropImage(
      dataUrl: string,
      x: number,
      y: number,
      width: number,
      height: number
    ): Promise<string> {
      return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
          // Account for device pixel ratio
          const dpr = window.devicePixelRatio || 1;

          const canvas = document.createElement('canvas');
          canvas.width = width * dpr;
          canvas.height = height * dpr;

          const ctx = canvas.getContext('2d');
          if (!ctx) {
            reject(new Error('Canvas not available'));
            return;
          }

          // Draw the cropped region
          ctx.drawImage(
            img,
            x * dpr,
            y * dpr,
            width * dpr,
            height * dpr,
            0,
            0,
            width * dpr,
            height * dpr
          );

          resolve(canvas.toDataURL('image/png'));
        };

        img.onerror = () => {
          reject(new Error('Failed to load image'));
        };

        img.src = dataUrl;
      });
    }
  }
});
