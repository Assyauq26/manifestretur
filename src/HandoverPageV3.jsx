import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Camera, CheckCircle2, CheckSquare, Clock, FileText, Home, Loader2, X } from 'lucide-react';

const API_URL = 'https://script.google.com/macros/s/AKfycbxzFZV3HMqdRf8_sFQFCZ3qQcIhnRVEXLhzTYGD7OPjv-Q7khAvMdCk8jx90Ff9d10WUw/exec';

const navItems = [
  { path: '/', icon: Home, label: 'Home' },
  { path: '/manifests', icon: FileText, label: 'Manifest' },
  { path: '/handover', icon: CheckSquare, label: 'Hand Over' },
  { path: '/history', icon: Clock, label: 'Riwayat' },
];

const getManifestId = (m) => m?.manifestNumber || m?.manifest_number || m?.id || '';
const getSellerName = (m) => m?.sellerName || m?.seller_name || 'Seller';

function goTo(path) {
  window.location.hash = path === '/' ? '#/' : `#${path}`;
}

function BottomNavigation() {
  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 flex justify-around items-center h-16 z-50 max-w-md mx-auto shadow-[0_-5px_10px_rgba(0,0,0,0.03)]">
      {navItems.map(({ path, icon: Icon, label }) => (
        <button key={path} type="button" onClick={() => goTo(path)} className={`flex flex-col items-center justify-center w-full h-full ${path === '/handover' ? 'text-[#D71920]' : 'text-gray-400'}`}>
          <Icon size={23} strokeWidth={path === '/handover' ? 2.5 : 2} />
          <span className={`text-[10px] font-semibold mt-1 ${path === '/handover' ? 'text-[#D71920]' : 'text-gray-500'}`}>{label}</span>
        </button>
      ))}
    </nav>
  );
}

async function compressPhoto(file) {
  if (!file.type.startsWith('image/')) throw new Error('File yang dipilih bukan foto.');
  const source = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('Foto gagal dibaca.'));
    reader.readAsDataURL(file);
  });

  const image = await new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Foto tidak dapat diproses.'));
    img.src = source;
  });

  const maxSide = 1800;
  const scale = Math.min(1, maxSide / Math.max(image.naturalWidth, image.naturalHeight));
  const width = Math.max(1, Math.round(image.naturalWidth * scale));
  const height = Math.max(1, Math.round(image.naturalHeight * scale));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { alpha: false });
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(image, 0, 0, width, height);
  return canvas.toDataURL('image/jpeg', 0.82);
}

export default function HandoverPageV3() {
  const [manifests, setManifests] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedManifest, setSelectedManifest] = useState(null);
  const [photoPreview, setPhotoPreview] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successData, setSuccessData] = useState(null);
  const fileInputRef = useRef(null);

  const loadReadyHandover = useCallback(async () => {
    setIsLoading(true);
    try {
      const token = localStorage.getItem('retur_token');
      const response = await fetch(API_URL, { method: 'POST', body: JSON.stringify({ action: 'getReadyHandover', userToken: token }) });
      const result = await response.json();
      if (!result.success) throw new Error(result.message || 'Gagal mengambil manifest handover.');
      setManifests(Array.isArray(result.data) ? result.data : []);
    } catch (error) {
      setErrorMessage(error.message || 'Gagal mengambil data manifest.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { loadReadyHandover(); }, [loadReadyHandover]);

  const openHandover = (manifest) => {
    setSelectedManifest(manifest);
    setPhotoPreview('');
    setErrorMessage('');
    setSuccessData(null);
  };

  const closeHandover = () => {
    if (isSubmitting) return;
    setSelectedManifest(null);
    setPhotoPreview('');
  };

  const handlePhoto = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    try {
      const compressed = await compressPhoto(file);
      setPhotoPreview(compressed);
      setErrorMessage('');
    } catch (error) {
      setErrorMessage(error.message || 'Foto gagal diproses.');
    }
  };

  const submitHandover = async (event) => {
    event.preventDefault();
    if (!selectedManifest || isSubmitting) return;
    if (!photoPreview) {
      setErrorMessage('Foto bukti serah terima wajib diambil.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage('');
    const manifestSnapshot = selectedManifest;
    const manifestNumber = getManifestId(manifestSnapshot);
    let savedUser = {};
    try { savedUser = JSON.parse(localStorage.getItem('retur_user') || '{}'); } catch (_) {}

    try {
      const token = localStorage.getItem('retur_token');
      const response = await fetch(API_URL, {
        method: 'POST',
        body: JSON.stringify({
          action: 'completeHandover',
          userToken: token,
          manifestNumber,
          photoBase64: photoPreview,
          handoverBy: savedUser?.nama_sprinter || ''
        })
      });
      const result = await response.json();
      if (!result.success) throw new Error(result.message || 'Gagal menyelesaikan serah terima.');

      const data = result.data || {};
      setManifests((prev) => prev.filter((item) => getManifestId(item) !== manifestNumber));
      setSelectedManifest(null);
      setSuccessData({
        manifestNumber: data.manifestNumber || manifestNumber,
        sellerName: getSellerName(manifestSnapshot),
        pdfUrl: data.pdfUrl || manifestSnapshot.pdfUrl || manifestSnapshot.pdf_url || ''
      });
      setPhotoPreview('');
    } catch (error) {
      setErrorMessage(error.message || 'Koneksi gagal. Silakan coba lagi.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const shareToWhatsApp = () => {
    if (!successData) return;
    const caption = [
      'SERAH TERIMA MANIFEST RETUR',
      '',
      `Manifest: ${successData.manifestNumber}`,
      `Seller: ${successData.sellerName}`,
      '',
      'Manifest PDF:',
      successData.pdfUrl || '-'
    ].join('\n');
    window.open(`https://wa.me/?text=${encodeURIComponent(caption)}`, '_blank', 'noopener,noreferrer');
  };

  const closeSuccessModal = () => {
    setSuccessData(null);
    loadReadyHandover();
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-20 max-w-md mx-auto shadow-sm relative">
      <header className="bg-white px-5 py-4 sticky top-0 z-10 border-b border-gray-100">
        <h1 className="text-lg font-bold text-gray-900">Hand Over</h1>
        <p className="text-xs text-gray-500">Foto serah terima akan masuk ke halaman terakhir PDF manifest</p>
      </header>

      {errorMessage && (
        <div className="fixed inset-0 z-[700] bg-black/50 flex items-center justify-center p-5" role="dialog" aria-modal="true">
          <div className="w-full max-w-sm bg-white rounded-3xl p-6 shadow-2xl">
            <div className="w-14 h-14 mx-auto rounded-full bg-red-50 flex items-center justify-center text-[#D71920]"><X size={28} /></div>
            <h3 className="text-lg font-bold text-gray-900 text-center mt-4">Terjadi Kesalahan</h3>
            <p className="text-sm text-gray-500 text-center mt-2 break-words">{errorMessage}</p>
            <button type="button" onClick={() => setErrorMessage('')} className="w-full mt-6 py-3.5 rounded-2xl bg-[#D71920] text-white font-bold">OKE</button>
          </div>
        </div>
      )}

      <main className="p-5 space-y-4">
        {isLoading ? (
          <div className="py-12 flex justify-center"><Loader2 className="animate-spin text-[#D71920]" /></div>
        ) : manifests.length === 0 ? (
          <div className="bg-white rounded-2xl p-8 text-center border border-dashed border-gray-300">
            <CheckSquare className="mx-auto text-gray-300" size={42} />
            <p className="mt-3 font-semibold text-gray-700">Belum ada manifest</p>
            <p className="text-xs text-gray-400 mt-1">Tidak ada manifest berstatus READY_HANDOVER.</p>
          </div>
        ) : manifests.map((manifest) => {
          const id = getManifestId(manifest);
          return (
            <button key={id} type="button" onClick={() => openHandover(manifest)} className="w-full text-left bg-white rounded-2xl p-4 border border-gray-100 shadow-sm active:scale-[0.99] transition-transform">
              <div className="flex items-center justify-between gap-3">
                <span className="font-mono font-bold text-gray-900 truncate">{id}</span>
                <span className="shrink-0 text-[10px] font-bold px-2 py-1 rounded-full bg-amber-50 text-amber-700">READY HANDOVER</span>
              </div>
              <div className="mt-3 text-sm text-gray-600">
                <p className="font-semibold text-gray-800">{getSellerName(manifest)}</p>
                <p className="text-xs mt-1">{manifest.totalAwb || manifest.total_awb || 0} AWB • {manifest.shift || manifest.shift_name || '-'}</p>
              </div>
            </button>
          );
        })}
      </main>

      <BottomNavigation />

      {selectedManifest && (
        <div className="fixed inset-0 z-[400] bg-black/50 flex items-end justify-center" role="dialog" aria-modal="true">
          <div className="w-full max-w-md bg-white rounded-t-3xl p-5 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="text-xl font-bold text-gray-900">Serah Terima</h2>
                <p className="text-xs text-gray-500 mt-1">{getManifestId(selectedManifest)}</p>
              </div>
              <button type="button" onClick={closeHandover} disabled={isSubmitting} className="text-sm text-gray-500 disabled:opacity-50">Tutup</button>
            </div>

            <form onSubmit={submitHandover} className="space-y-5">
              <div className="rounded-2xl bg-gray-50 p-4">
                <p className="text-xs text-gray-500">Seller</p>
                <p className="font-bold text-gray-900 mt-1">{getSellerName(selectedManifest)}</p>
                <p className="text-xs text-gray-500 mt-2">{selectedManifest.totalAwb || selectedManifest.total_awb || 0} AWB</p>
              </div>

              <div>
                <label className="block text-sm font-semibold mb-2">Foto Bukti Serah Terima</label>
                {photoPreview ? (
                  <div className="relative rounded-2xl overflow-hidden bg-black border border-gray-200">
                    <img src={photoPreview} alt="Preview bukti serah terima" className="w-full max-h-72 object-contain" />
                    <button type="button" onClick={() => setPhotoPreview('')} className="absolute top-3 right-3 w-9 h-9 rounded-full bg-black/60 text-white flex items-center justify-center"><X size={18} /></button>
                  </div>
                ) : (
                  <button type="button" onClick={() => fileInputRef.current?.click()} className="w-full rounded-2xl border-2 border-dashed border-gray-200 bg-gray-50 p-8 flex flex-col items-center justify-center text-gray-500">
                    <div className="w-14 h-14 rounded-full bg-red-50 text-[#D71920] flex items-center justify-center"><Camera size={28} /></div>
                    <span className="mt-3 font-bold text-gray-800">Ambil Foto Serah Terima</span>
                    <span className="text-xs mt-1">Foto akan dimasukkan ke PDF manifest</span>
                  </button>
                )}
                <input ref={fileInputRef} type="file" accept="image/*" capture="environment" onChange={handlePhoto} className="hidden" />
              </div>

              <div className="rounded-2xl border border-blue-100 bg-blue-50 p-4 text-xs text-blue-800">
                <strong>Catatan:</strong> Tidak ada lagi tanda tangan digital. Foto menjadi bukti serah terima dan otomatis ditempatkan di halaman terakhir PDF manifest.
              </div>

              <button type="submit" disabled={isSubmitting || !photoPreview} className="w-full py-4 rounded-2xl bg-[#D71920] text-white font-bold disabled:opacity-50 flex items-center justify-center gap-2">
                {isSubmitting ? <><Loader2 size={19} className="animate-spin" /> Memproses PDF...</> : <><CheckCircle2 size={19} /> Selesaikan Serah Terima</>}
              </button>
            </form>
          </div>
        </div>
      )}

      {successData && (
        <div className="fixed inset-0 z-[800] bg-black/55 flex items-center justify-center p-5" role="dialog" aria-modal="true">
          <div className="w-full max-w-sm bg-white rounded-3xl p-6 shadow-2xl">
            <div className="w-16 h-16 mx-auto rounded-full bg-green-50 text-green-600 flex items-center justify-center"><CheckCircle2 size={34} /></div>
            <h3 className="text-xl font-bold text-gray-900 text-center mt-4">Serah Terima Berhasil</h3>
            <p className="text-sm text-gray-500 text-center mt-2">Manifest <strong>{successData.manifestNumber}</strong> sudah ditandai sebagai COMPLETED.</p>
            <div className="space-y-3 mt-6">
              {successData.pdfUrl && <a href={successData.pdfUrl} target="_blank" rel="noreferrer" className="block w-full text-center py-3.5 rounded-2xl border border-gray-200 font-bold text-gray-800">Buka PDF Final</a>}
              <button type="button" onClick={shareToWhatsApp} className="w-full py-3.5 rounded-2xl bg-[#25D366] text-white font-bold">Share Manifest ke WhatsApp</button>
              <button type="button" onClick={closeSuccessModal} className="w-full py-3.5 rounded-2xl bg-gray-100 text-gray-800 font-bold">Kembali</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
