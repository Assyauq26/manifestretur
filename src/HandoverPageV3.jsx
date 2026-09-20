import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Camera, CheckCircle2, CheckSquare, ChevronRight, Clock, FileText, Home, Loader2, X } from 'lucide-react';

const API_URL = 'https://script.google.com/macros/s/AKfycbxzFZV3HMqdRf8_sFQFCZ3qQcIhnRVEXLhzTYGD7OPjv-Q7khAvMdCk8jx90Ff9d10WUw/exec';

const navItems = [
  { path: '/', icon: Home, label: 'Beranda' },
  { path: '/manifests', icon: FileText, label: 'Manifest' },
  { path: '/handover', icon: CheckSquare, label: 'Hand Over' },
  { path: '/history', icon: Clock, label: 'Riwayat' },
];

const getManifestId = (manifest) => manifest?.manifestNumber || manifest?.manifest_number || manifest?.id || '';
const getSellerName = (manifest) => manifest?.sellerName || manifest?.seller_name || 'Seller';
const getTotalAwb = (manifest) => manifest?.totalAwb || manifest?.total_awb || manifest?.awbCount || manifest?.awb_count || 0;
const getShift = (manifest) => manifest?.shiftLabel || manifest?.shift_name || manifest?.shift || '-';

function goTo(path) {
  const target = `${window.location.pathname}${path === '/' ? '#/' : `#${path}`}`;
  // Use a real browser navigation here because HandoverPageV3 is intentionally
  // mounted outside the legacy HashRouter. This avoids the stale-overlay / dead
  // navigation state observed after completing a handover.
  if (window.location.href !== new URL(target, window.location.href).href) {
    window.location.assign(target);
  } else {
    window.location.reload();
  }
}

function BottomNavigation() {
  const currentHash = window.location.hash || '#/';
  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 flex justify-around items-center h-16 z-50 max-w-md mx-auto shadow-[0_-5px_10px_rgba(0,0,0,0.03)]">
      {navItems.map(({ path, icon: Icon, label }) => {
        const active = path === '/handover'
          ? currentHash.startsWith('#/handover')
          : currentHash === `#${path}` || (path === '/' && (currentHash === '#' || currentHash === '#/'));
        return (
          <button
            key={path}
            type="button"
            onClick={() => goTo(path)}
            className={`flex flex-col items-center justify-center w-full h-full gap-1 transition-colors ${active ? 'text-[#D71920]' : 'text-gray-400 active:text-gray-600'}`}
            aria-label={label}
          >
            <Icon size={23} strokeWidth={active ? 2.5 : 2} />
            <span className={`text-[10px] font-semibold ${active ? 'text-[#D71920]' : 'text-gray-500'}`}>{label}</span>
          </button>
        );
      })}
    </nav>
  );
}

async function compressPhoto(file) {
  if (!file) return '';
  const sourceUrl = URL.createObjectURL(file);
  try {
    const image = await new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = sourceUrl;
    });
    const maxSide = 1600;
    const sourceWidth = image.naturalWidth || image.width;
    const sourceHeight = image.naturalHeight || image.height;
    const scale = Math.min(1, maxSide / Math.max(sourceWidth, sourceHeight));
    const width = Math.max(1, Math.round(sourceWidth * scale));
    const height = Math.max(1, Math.round(sourceHeight * scale));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d', { alpha: false });
    ctx.drawImage(image, 0, 0, width, height);
    return canvas.toDataURL('image/jpeg', 0.82);
  } finally {
    URL.revokeObjectURL(sourceUrl);
  }
}

export default function HandoverPageV3() {
  const [manifests, setManifests] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedManifest, setSelectedManifest] = useState(null);
  const [photoPreview, setPhotoPreview] = useState('');
  const [isPhotoProcessing, setIsPhotoProcessing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successData, setSuccessData] = useState(null);
  const fileInputRef = useRef(null);

  const loadReadyHandover = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage('');
    try {
      const token = localStorage.getItem('retur_token');
      const response = await fetch(API_URL, {
        method: 'POST',
        body: JSON.stringify({ action: 'getReadyHandover', userToken: token })
      });
      const result = await response.json();
      if (!result.success) throw new Error(result.message || 'Gagal mengambil manifest handover.');
      setManifests(Array.isArray(result.data) ? result.data : []);
    } catch (error) {
      console.error(error);
      setErrorMessage(error.message || 'Gagal mengambil data manifest.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { loadReadyHandover(); }, [loadReadyHandover]);

  const openHandover = (manifest) => {
    setSuccessData(null);
    setSelectedManifest(manifest);
    setPhotoPreview('');
    setErrorMessage('');
  };

  const closeHandover = () => {
    if (isSubmitting || isPhotoProcessing) return;
    setSelectedManifest(null);
    setPhotoPreview('');
  };

  const handlePhoto = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setErrorMessage('File harus berupa foto.');
      return;
    }
    setIsPhotoProcessing(true);
    setErrorMessage('');
    try {
      setPhotoPreview(await compressPhoto(file));
    } catch (error) {
      console.error(error);
      setErrorMessage('Foto gagal diproses. Silakan ambil foto kembali.');
    } finally {
      setIsPhotoProcessing(false);
    }
  };

  const submitHandover = async (event) => {
    event.preventDefault();
    if (!selectedManifest || isSubmitting || isPhotoProcessing) return;
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
          handoverMode: 'PHOTO_ONLY',
          appendPhotoToPdf: true,
          handoverBy: savedUser?.nama_sprinter || ''
        })
      });
      const result = await response.json();
      if (!result.success) throw new Error(result.message || 'Gagal menyelesaikan handover.');

      const data = result.data || {};
      const finalManifestNumber = data.manifestNumber || manifestNumber;
      const pdfUrl = data.pdfUrl || manifestSnapshot.pdfUrl || manifestSnapshot.pdf_url || '';
      setManifests((prev) => prev.filter((item) => getManifestId(item) !== manifestNumber));
      setSelectedManifest(null);
      setPhotoPreview('');
      setSuccessData({
        manifestNumber: finalManifestNumber,
        handoverId: data.handoverId || '',
        sellerName: getSellerName(manifestSnapshot),
        totalAwb: getTotalAwb(manifestSnapshot),
        handoverBy: savedUser?.nama_sprinter || '',
        handoverAt: data.handoverAt || data.handover_at || new Date().toISOString(),
        pdfUrl,
        photoBase64: photoPreview
      });
    } catch (error) {
      console.error(error);
      setErrorMessage(error.message || 'Koneksi gagal. Silakan coba lagi.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const shareToWhatsApp = async () => {
    if (!successData) return;
    const caption = [
      'SERAH TERIMA MANIFEST RETUR',
      '',
      `Manifest: ${successData.manifestNumber}`,
      `Seller: ${successData.sellerName}`,
      `Jumlah AWB: ${successData.totalAwb}`,
      '',
      'Manifest PDF:',
      successData.pdfUrl || '-'
    ].join('\n');

    try {
      if (successData.photoBase64) {
        const response = await fetch(successData.photoBase64);
        const blob = await response.blob();
        const photoFile = new File(
          [blob],
          `${successData.manifestNumber}-bukti-serah-terima.jpg`,
          { type: 'image/jpeg' }
        );
        if (navigator.share && (!navigator.canShare || navigator.canShare({ files: [photoFile] }))) {
          await navigator.share({
            title: `Serah Terima ${successData.manifestNumber}`,
            text: caption,
            files: [photoFile]
          });
          return;
        }
      }
    } catch (error) {
      if (error?.name === 'AbortError') return;
      console.error('Native share error:', error);
    }

    window.location.href = `https://wa.me/?text=${encodeURIComponent(caption)}`;
  };

  const closeSuccessModal = () => {
    setSuccessData(null);
    setPhotoPreview('');
  };

  const goHome = () => {
    setSuccessData(null);
    setSelectedManifest(null);
    setPhotoPreview('');
    goTo('/');
  };

  return (
    <div className="min-h-screen bg-[#F7F8FA] pb-20 max-w-md mx-auto shadow-sm relative text-[#172033]">
      <header className="bg-white px-5 py-4 sticky top-0 z-30 border-b border-gray-100">
        <h1 className="text-xl font-bold tracking-tight">Hand Over</h1>
        <p className="text-xs text-gray-500 mt-0.5">Manifest yang siap diserahkan ke seller</p>
      </header>

      {errorMessage && (
        <div className="fixed inset-0 z-[800] bg-black/55 flex items-center justify-center p-5" role="dialog" aria-modal="true">
          <div className="w-full max-w-sm bg-white rounded-[28px] p-6 shadow-2xl">
            <div className="w-14 h-14 mx-auto rounded-full bg-red-50 flex items-center justify-center text-[#D71920]"><X size={27} /></div>
            <h3 className="text-lg font-bold text-gray-900 text-center mt-4">Terjadi Kesalahan</h3>
            <p className="text-sm text-gray-500 text-center mt-2 break-words">{errorMessage}</p>
            <button type="button" onClick={() => setErrorMessage('')} className="w-full mt-6 py-3.5 rounded-2xl bg-[#D71920] text-white font-bold">OKE</button>
          </div>
        </div>
      )}

      <main className="p-5 space-y-3">
        {isLoading ? (
          <div className="py-16 flex justify-center"><Loader2 className="animate-spin text-[#D71920]" size={28} /></div>
        ) : manifests.length === 0 ? (
          <div className="bg-white rounded-3xl p-8 text-center border border-gray-100 shadow-sm">
            <CheckSquare className="mx-auto text-gray-300" size={42} />
            <p className="mt-4 font-bold text-gray-800">Belum ada manifest</p>
            <p className="text-xs text-gray-400 mt-1">Tidak ada manifest berstatus READY_HANDOVER.</p>
            <button type="button" onClick={loadReadyHandover} className="mt-5 px-5 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-700">Muat Ulang</button>
          </div>
        ) : manifests.map((manifest) => {
          const id = getManifestId(manifest);
          return (
            <button key={id} type="button" onClick={() => openHandover(manifest)} className="w-full text-left bg-white rounded-2xl p-4 border border-gray-100 shadow-sm active:scale-[0.99] transition-transform">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-mono font-bold text-[15px] text-gray-900 break-all">{id}</p>
                  <p className="text-sm text-gray-600 mt-2">{getSellerName(manifest)}</p>
                  <p className="text-xs text-gray-400 mt-1">{getTotalAwb(manifest)} AWB • {getShift(manifest)}</p>
                </div>
                <div className="shrink-0 flex items-center gap-1">
                  <span className="text-[9px] font-bold px-2 py-1 rounded-full bg-amber-50 text-amber-700">{manifest.status || 'READY_HANDOVER'}</span>
                  <ChevronRight size={18} className="text-gray-300" />
                </div>
              </div>
            </button>
          );
        })}
      </main>

      <BottomNavigation />

      {selectedManifest && (
        <div className="fixed inset-0 z-[400] bg-black/50 flex items-end justify-center" role="dialog" aria-modal="true">
          <div className="w-full max-w-md bg-white rounded-t-[30px] p-5 max-h-[94vh] overflow-y-auto shadow-2xl">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="text-xl font-bold text-gray-900">Detail Hand Over</h2>
                <p className="text-xs text-gray-500 mt-1">{getManifestId(selectedManifest)}</p>
              </div>
              <button type="button" onClick={closeHandover} disabled={isSubmitting || isPhotoProcessing} className="text-sm text-gray-500 disabled:opacity-50">Tutup</button>
            </div>

            <div className="bg-gray-50 rounded-2xl border border-gray-100 p-4 space-y-3 mb-5">
              <div className="flex justify-between gap-4 text-sm"><span className="text-gray-400">Seller</span><span className="font-semibold text-gray-800 text-right">{getSellerName(selectedManifest)}</span></div>
              <div className="flex justify-between gap-4 text-sm"><span className="text-gray-400">Jumlah AWB</span><span className="font-semibold text-gray-800">{getTotalAwb(selectedManifest)} AWB</span></div>
              <div className="flex justify-between gap-4 text-sm"><span className="text-gray-400">Shift</span><span className="font-semibold text-gray-800">{getShift(selectedManifest)}</span></div>
              <div className="flex justify-between gap-4 text-sm"><span className="text-gray-400">Status</span><span className="font-bold text-amber-700">{selectedManifest.status || 'READY_HANDOVER'}</span></div>
            </div>

            <form onSubmit={submitHandover} className="space-y-5">
              <div>
                <label className="block text-sm font-semibold mb-2 text-gray-900">Foto Serah Terima</label>
                <div className="rounded-2xl border border-gray-200 overflow-hidden bg-gray-50">
                  {photoPreview ? (
                    <div className="relative">
                      <img src={photoPreview} alt="Foto bukti serah terima" className="block w-full max-h-[310px] object-cover" />
                      <button type="button" onClick={() => setPhotoPreview('')} className="absolute top-3 right-3 w-9 h-9 rounded-full bg-black/65 text-white flex items-center justify-center" aria-label="Hapus foto"><X size={18} /></button>
                    </div>
                  ) : (
                    <button type="button" onClick={() => fileInputRef.current?.click()} disabled={isPhotoProcessing} className="w-full py-12 px-5 flex flex-col items-center justify-center active:bg-gray-100">
                      {isPhotoProcessing ? <Loader2 className="animate-spin text-[#D71920]" size={34} /> : <Camera className="text-[#D71920]" size={36} />}
                      <p className="text-sm font-bold mt-3 text-gray-800">{isPhotoProcessing ? 'Memproses foto...' : 'Ambil Foto Serah Terima'}</p>
                      <p className="text-xs text-gray-400 mt-1 text-center">Gunakan kamera HP untuk mengambil bukti serah terima.</p>
                    </button>
                  )}
                  <input ref={fileInputRef} type="file" accept="image/*" capture="environment" onChange={handlePhoto} className="hidden" />
                </div>
                <p className="text-[11px] text-gray-400 mt-2">Foto akan dimasukkan ke halaman terakhir PDF Manifest. Tidak ada TTD dan foto tidak disimpan sebagai file terpisah.</p>
              </div>

              <button type="submit" disabled={isSubmitting || isPhotoProcessing || !photoPreview} className="w-full py-4 rounded-2xl bg-[#D71920] text-white font-bold disabled:opacity-50 flex items-center justify-center">
                {isSubmitting ? <><Loader2 size={20} className="animate-spin mr-2" /> MENYIMPAN...</> : 'SELESAIKAN SERAH TERIMA'}
              </button>
            </form>
          </div>
        </div>
      )}

      {successData && (
        <div className="fixed inset-0 z-[700] bg-black/60 flex items-end justify-center backdrop-blur-sm" role="dialog" aria-modal="true">
          <div className="w-full max-w-md bg-white rounded-t-[32px] p-5 max-h-[95vh] overflow-y-auto shadow-2xl">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-green-700 bg-green-50 px-3 py-1.5 rounded-full">BERHASIL</span>
              <button type="button" onClick={closeSuccessModal} className="text-sm text-gray-500">Tutup</button>
            </div>

            <div className="flex justify-center pt-4"><div className="w-16 h-16 rounded-full bg-green-50 flex items-center justify-center"><CheckCircle2 size={36} className="text-green-600" /></div></div>

            <div className="text-center mt-4">
              <h2 className="text-2xl font-bold text-gray-900">Serah Terima Berhasil</h2>
              <p className="text-sm text-gray-500 mt-1">Manifest berhasil diserahkan kepada seller.</p>
            </div>

            <div className="mt-5 bg-gray-50 rounded-2xl p-4 border border-gray-100">
              <p className="text-[11px] text-gray-400 uppercase font-semibold">Nomor Manifest</p>
              <p className="font-mono font-bold text-gray-900 mt-1 break-all">{successData.manifestNumber}</p>
              <div className="h-px bg-gray-200 my-3" />
              <p className="text-[11px] text-gray-400 uppercase font-semibold">Seller</p>
              <p className="font-semibold text-gray-800 mt-1">{successData.sellerName}</p>
              <div className="h-px bg-gray-200 my-3" />
              <div className="grid grid-cols-2 gap-3"><div><p className="text-[11px] text-gray-400 uppercase font-semibold">Jumlah AWB</p><p className="text-sm font-semibold mt-1">{successData.totalAwb} AWB</p></div><div><p className="text-[11px] text-gray-400 uppercase font-semibold">Status</p><p className="text-sm font-bold text-green-700 mt-1">COMPLETED</p></div></div>
            </div>

            {successData.photoBase64 && (
              <div className="mt-5">
                <div className="flex items-center justify-between mb-2"><p className="text-sm font-semibold text-gray-900">Bukti Serah Terima</p><span className="text-xs text-green-700 font-semibold">Masuk PDF</span></div>
                <img src={successData.photoBase64} alt="Bukti serah terima" className="w-full max-h-64 object-cover rounded-2xl border border-gray-200" />
              </div>
            )}

            <div className="mt-5">
              <p className="text-sm font-semibold text-gray-900 mb-2">Manifest PDF</p>
              {successData.pdfUrl ? (
                <a href={successData.pdfUrl} target="_blank" rel="noreferrer" className="flex items-center justify-between p-4 rounded-2xl bg-red-50 border border-red-100 active:bg-red-100">
                  <div className="flex items-center min-w-0"><FileText size={24} className="text-[#D71920] mr-3 shrink-0" /><div className="min-w-0"><p className="font-semibold text-gray-900 text-sm">Buka Manifest PDF</p><p className="text-xs text-gray-500 truncate">PDF sudah diperbarui dengan foto serah terima.</p></div></div>
                  <ChevronRight size={20} className="text-[#D71920] shrink-0" />
                </a>
              ) : <div className="p-4 rounded-2xl bg-amber-50 text-xs text-amber-700 border border-amber-100">PDF sudah diproses, tetapi link PDF belum dikirim oleh server.</div>}
            </div>

            <button type="button" onClick={shareToWhatsApp} className="w-full mt-5 py-4 rounded-2xl bg-[#25D366] text-white font-bold flex items-center justify-center active:scale-[0.99] transition-transform"><span className="text-xl mr-2">💬</span> KIRIM FOTO + LINK PDF KE WHATSAPP</button>
            <p className="text-[11px] text-gray-400 text-center mt-2 px-3">Jika perangkat mendukung berbagi file, pilih WhatsApp agar foto ikut terlampir dan caption berisi link PDF.</p>

            <div className="grid grid-cols-2 gap-3 mt-5 pb-2">
              <button type="button" onClick={closeSuccessModal} className="py-3.5 rounded-2xl border border-gray-200 text-gray-700 font-bold active:bg-gray-50">Tutup</button>
              <button type="button" onClick={goHome} className="py-3.5 rounded-2xl bg-[#D71920] text-white font-bold active:bg-[#B9151B]">Ke Beranda</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
