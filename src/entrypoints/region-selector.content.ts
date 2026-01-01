/**
 * Region Selector Content Script | 区域选择器内容脚本
 *
 * Content script for region selection overlay.
 * Allows users to select a screen region with mouse to scan QR codes.
 * Uses jsQR for QR code detection directly in the content script.
 *
 * 用于区域选择覆盖层的内容脚本。
 * 允许用户通过鼠标选择屏幕区域来扫描二维码。
 * 使用 jsQR 在内容脚本中直接进行二维码检测。
 */

import jsQR from 'jsqr';

export default defineContentScript({
  matches: ['<all_urls>'],
  runAt: 'document_idle',
  main() {
    // Listen for messages from the extension
    // 监听来自扩展的消息
    chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
      if (message.action === 'startRegionSelection') {
        startRegionSelection()
          .then(sendResponse)
          .catch((error) => sendResponse({ error: error.message }));
        return true; // Will respond asynchronously
      }
    });

    function startRegionSelection(): Promise<{ success: boolean; error?: string }> {
      return new Promise((resolve, reject) => {
        // Remove any existing overlay first
        // 首先移除任何现有的覆盖层
        const existingOverlay = document.getElementById('auths-region-selector-overlay');
        const existingBox = document.getElementById('auths-selection-box');
        const existingTooltip = document.getElementById('auths-tooltip');
        if (existingOverlay) existingOverlay.remove();
        if (existingBox) existingBox.remove();
        if (existingTooltip) existingTooltip.remove();

        // Create overlay container
        // 创建覆盖层容器
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
        // 创建选择框
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
        // 创建提示工具栏
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
          // 最小选择尺寸
          if (width < 20 || height < 20) {
            cleanup();
            reject(new Error('Selection too small'));
            return;
          }

          // Hide overlay before capturing
          // 截图前隐藏覆盖层
          overlay.style.display = 'none';
          selectionBox.style.display = 'none';
          tooltip.style.display = 'none';

          // Wait a frame for the overlay to be hidden
          // 等待一帧让覆盖层隐藏
          await new Promise(r => requestAnimationFrame(r));

          // Send message to background to capture the screen
          // 发送消息到后台脚本进行屏幕截图
          try {
            const response = await chrome.runtime.sendMessage({
              action: 'captureVisibleTab'
            });

            if (response.error) {
              cleanup();
              reject(new Error(response.error));
              return;
            }

            // Crop and detect QR code
            // 裁剪并检测二维码
            const qrResult = await cropAndDetectQR(response.dataUrl, left, top, width, height);

            cleanup();

            if (qrResult.success && qrResult.qrData) {
              console.log('[Auths Content] QR detected:', qrResult.qrData);
              // Send QR data to background script to save
              const saveResponse = await chrome.runtime.sendMessage({
                action: 'saveQRAccount',
                qrData: qrResult.qrData
              });

              if (saveResponse.success) {
                console.log('[Auths Content] Account saved via background');
                showToast(saveResponse.message || 'Account added successfully!', 'success');
                resolve({ success: true });
              } else if (saveResponse.isDuplicate) {
                console.log('[Auths Content] Duplicate account detected');
                showToast(saveResponse.message || 'This account already exists!', 'error');
                resolve({ success: false, error: 'duplicate' });
              } else {
                showToast(saveResponse.message || 'Failed to add account', 'error');
                resolve({ success: false, error: saveResponse.error });
              }
            } else {
              console.log('[Auths Content] No QR code found');
              // Request localized message from background
              const notFoundResponse = await chrome.runtime.sendMessage({
                action: 'getMessage',
                key: 'qr_error_not_found'
              });
              showToast(notFoundResponse?.message || 'QR code not found', 'error');
              resolve({ success: false, error: 'QR code not found' });
            }
          } catch (error) {
            cleanup();
            reject(error);
          }
        });
      });
    }

    // Show a toast notification on the page
    // 在页面上显示 Toast 通知
    function showToast(message: string, type: 'success' | 'error') {
      // Remove any existing toast
      // 移除任何现有的 Toast
      const existingToast = document.getElementById('auths-toast');
      if (existingToast) existingToast.remove();

      const toast = document.createElement('div');
      toast.id = 'auths-toast';
      toast.textContent = message;
      toast.style.cssText = `
        position: fixed;
        top: 20px;
        left: 50%;
        transform: translateX(-50%);
        padding: 12px 24px;
        border-radius: 4px;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        font-size: 14px;
        font-weight: 500;
        z-index: 2147483647;
        box-shadow: 0 2px 12px 0 rgba(0, 0, 0, 0.1);
        animation: auths-toast-slide-in 0.3s ease-out;
        ${type === 'success'
          ? 'background: #f0f9eb; color: #67c23a; border: 1px solid #e1f3d8;'
          : 'background: #fef0f0; color: #f56c6c; border: 1px solid #fde2e2;'}
      `;

      // Add animation keyframes
      // 添加动画关键帧
      const style = document.createElement('style');
      style.textContent = `
        @keyframes auths-toast-slide-in {
          from { transform: translateX(-50%) translateY(-20px); opacity: 0; }
          to { transform: translateX(-50%) translateY(0); opacity: 1; }
        }
        @keyframes auths-toast-slide-out {
          from { transform: translateX(-50%) translateY(0); opacity: 1; }
          to { transform: translateX(-50%) translateY(-20px); opacity: 0; }
        }
      `;
      document.head.appendChild(style);
      document.body.appendChild(toast);

      // Auto remove after 3 seconds
      // 3秒后自动移除
      setTimeout(() => {
        toast.style.animation = 'auths-toast-slide-out 0.3s ease-in forwards';
        setTimeout(() => {
          toast.remove();
          style.remove();
        }, 300);
      }, 3000);
    }

    /**
     * Crop image and detect QR code | 裁剪图片并检测二维码
     */
    async function cropAndDetectQR(
      dataUrl: string,
      x: number,
      y: number,
      width: number,
      height: number
    ): Promise<{ success: boolean; qrData?: string }> {
      return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
          // Account for device pixel ratio
          // 考虑设备像素比
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
          // 绘制裁剪区域
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

          // Get image data for QR detection
          // 获取图像数据用于二维码检测
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

          // Try to detect QR code
          // 尝试检测二维码
          let code = jsQR(imageData.data, imageData.width, imageData.height, {
            inversionAttempts: 'dontInvert',
          });

          if (code) {
            console.log('[Auths Content] QR found (normal):', code.data);
            resolve({ success: true, qrData: code.data });
            return;
          }

          // Try with inverted colors
          // 尝试反色检测
          console.log('[Auths Content] Trying inverted...');
          code = jsQR(imageData.data, imageData.width, imageData.height, {
            inversionAttempts: 'attemptBoth',
          });

          if (code) {
            console.log('[Auths Content] QR found (inverted):', code.data);
            resolve({ success: true, qrData: code.data });
          } else {
            console.log('[Auths Content] No QR code detected');
            resolve({ success: false });
          }
        };

        img.onerror = () => {
          reject(new Error('Failed to load image'));
        };

        img.src = dataUrl;
      });
    }
  }
});
