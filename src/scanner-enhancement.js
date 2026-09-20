/*
 * Manifest Retur scanner enhancement.
 *
 * The existing App.jsx owns the scanner lifecycle. This module deliberately
 * enhances Html5Qrcode at runtime so we can improve scan sensitivity without
 * changing the manifest/business logic.
 */
(function installScannerEnhancement() {
  const PATCH_FLAG = '__manifestReturScannerEnhanced__';
  const SCRIPT_ID = 'html5qrcode-script';

  const getSupportedFormats = () => {
    const formats = window.Html5QrcodeSupportedFormats;
    if (!formats) return undefined;

    const names = [
      'QR_CODE',
      'CODE_128',
      'CODE_39',
      'CODE_93',
      'CODABAR',
      'EAN_13',
      'EAN_8',
      'ITF',
      'UPC_A',
      'UPC_E',
      'DATA_MATRIX',
      'PDF_417',
      'AZTEC'
    ];

    const result = names
      .map((name) => formats[name])
      .filter((value) => typeof value === 'number');

    return result.length ? result : undefined;
  };

  const applyContinuousFocus = () => {
    const video = document.querySelector('#reader video');
    const stream = video && video.srcObject;
    if (!stream || !stream.getVideoTracks) return;

    const track = stream.getVideoTracks()[0];
    if (!track || !track.applyConstraints) return;

    try {
      const capabilities = track.getCapabilities ? track.getCapabilities() : {};
      const advanced = [];

      if (capabilities.focusMode && capabilities.focusMode.includes('continuous')) {
        advanced.push({ focusMode: 'continuous' });
      }

      // Keep the image sharp on devices that expose a useful zoom range.
      // Do not force digital zoom because some phones produce worse results.
      if (capabilities.zoom && Number.isFinite(capabilities.zoom.min)) {
        const min = capabilities.zoom.min;
        const max = capabilities.zoom.max;
        if (max > min) {
          advanced.push({ zoom: Math.min(max, Math.max(min, min + (max - min) * 0.12)) });
        }
      }

      if (advanced.length) track.applyConstraints({ advanced }).catch(() => {});
    } catch (_) {
      // Camera capability APIs vary between Android browsers.
    }
  };

  const patchConstructor = () => {
    const Html5Qrcode = window.Html5Qrcode;
    if (!Html5Qrcode || !Html5Qrcode.prototype || Html5Qrcode.prototype[PATCH_FLAG]) return;

    const originalStart = Html5Qrcode.prototype.start;
    if (typeof originalStart !== 'function') return;

    Html5Qrcode.prototype.start = function enhancedStart(cameraConfig, configuration, successCallback, errorCallback) {
      const base = configuration || {};
      const formatsToSupport = getSupportedFormats();

      const enhanced = {
        ...base,
        // More frames per second improves capture probability on moving AWBs.
        fps: Math.max(Number(base.fps) || 10, 20),
        // A larger scan window is more forgiving of imperfect alignment.
        qrbox: typeof base.qrbox === 'function'
          ? base.qrbox
          : { width: 320, height: 190 },
        // Avoid mirroring on rear-camera scanning.
        disableFlip: true,
        // Prefer the explicit set of common 1D/2D formats when supported.
        ...(formatsToSupport ? { formatsToSupport } : {})
      };

      const promise = originalStart.call(this, cameraConfig, enhanced, successCallback, errorCallback);
      Promise.resolve(promise).then(() => {
        // The video element is created asynchronously by html5-qrcode.
        setTimeout(applyContinuousFocus, 350);
        setTimeout(applyContinuousFocus, 1200);
      });
      return promise;
    };

    Html5Qrcode.prototype[PATCH_FLAG] = true;
  };

  // If the library is already present, patch immediately.
  patchConstructor();

  // The current App.jsx injects html5-qrcode dynamically. Wrap its onload
  // handler so the constructor is patched BEFORE App.jsx calls start().
  const originalAppendChild = document.body && document.body.appendChild;
  if (originalAppendChild && !document.body.__manifestReturAppendPatched) {
    document.body.__manifestReturAppendPatched = true;
    document.body.appendChild = function patchedAppendChild(node) {
      if (node && node.id === SCRIPT_ID && typeof node.onload === 'function' && !node.__manifestReturOnloadWrapped) {
        const originalOnload = node.onload;
        node.onload = function wrappedScannerLoad(event) {
          patchConstructor();
          return originalOnload.call(this, event);
        };
        node.__manifestReturOnloadWrapped = true;
      }
      return originalAppendChild.call(this, node);
    };
  }

  // Handle a library that may already exist when this module loads.
  const existingScript = document.getElementById(SCRIPT_ID);
  if (existingScript && typeof existingScript.onload === 'function' && !existingScript.__manifestReturOnloadWrapped) {
    const originalOnload = existingScript.onload;
    existingScript.onload = function wrappedExistingScannerLoad(event) {
      patchConstructor();
      return originalOnload.call(this, event);
    };
    existingScript.__manifestReturOnloadWrapped = true;
  }
})();
