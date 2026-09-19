// Small compatibility layer for the revised Manifest generation wording.
// React remains the source of truth for application state; this only updates
// presentation text after React renders the existing success modal.

(function installManifestRuntimePatch() {
  const applyLabels = () => {
    document.querySelectorAll('button').forEach((button) => {
      const text = (button.textContent || '').replace(/\s+/g, ' ').trim();
      if (text.includes('LANJUT PDF')) {
        button.childNodes.forEach((node) => {
          if (node.nodeType === Node.TEXT_NODE && node.textContent.includes('LANJUT PDF')) {
            node.textContent = node.textContent.replace('LANJUT PDF', 'Buat Manifest');
          }
        });
      }
      if (text.includes('BUKA PDF SEKARANG')) {
        button.textContent = 'Download Manifest';
      }
    });

    document.querySelectorAll('h2').forEach((heading) => {
      if ((heading.textContent || '').trim() === 'Berhasil!') {
        heading.textContent = 'Berhasil Manifest dibuat';
      }
    });
  };

  const observer = new MutationObserver(() => applyLabels());

  const start = () => {
    applyLabels();
    observer.observe(document.body, { childList: true, subtree: true });
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }
})();
