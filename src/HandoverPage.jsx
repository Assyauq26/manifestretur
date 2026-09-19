import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Camera, CheckCircle2, CheckSquare, ChevronLeft, Clock, FileText, Home, Loader2, X } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';

const API_URL = 'https://script.google.com/macros/s/AKfycbxzFZV3HMqdRf8_sFQFCZ3qQcIhnRVEXLhzTYGD7OPjv-Q7khAvMdCk8jx90Ff9d10WUw/exec';

const navItems = [
  { path: '/', icon: Home, label: 'Home' },
  { path: '/manifests', icon: FileText, label: 'Manifest' },
  { path: '/handover', icon: CheckSquare, label: 'Hand Over' },
  { path: '/history', icon: Clock, label: 'Riwayat' },
];

const BottomNavigation = () => (
  <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 flex justify-around items-center h-16 z-50 max-w-md mx-auto shadow-[0_-5px_10px_rgba(0,0,0,0.02)]">
    {navItems.map(({ path, icon: Icon, label }) => (
      <Link key={path} to={path} className={`flex flex-col items-center justify-center w-full h-full space-y-1 ${path === '/handover' ? 'text-[#D71920]' : 'text-gray-400'}`}>
        <Icon size={24} strokeWidth={path === '/handover' ? 2.5 : 2} />
        <span className={`text-[10px] font-semibold ${path === '/handover' ? 'text-[#D71920]' : 'text-gray-500'}`}>{label}</span>
      </Link>
    ))}
  </div>
);

const getManifestId = (manifest) => manifest?.manifestNumber || manifest?.manifest_number || manifest?.id || '';
const getSellerName = (manifest) => manifest?.sellerName || manifest?.seller_name || 'Seller';

export default function HandoverPage() {
  const navigate = useNavigate();
  const [manifests, setManifests] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedManifest, setSelectedManifest] = useState(null);
  const [photoPreview, setPhotoPreview] = useState('');
  const [signature, setSignature] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successData, setSuccessData] = useState(null);
  const canvasRef = useRef(null);
  const drawingRef = useRef(false);

  const loadReadyHandover = useCallback(async () => {
    setIsLoading(true);
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

  useEffect(() => {
    loadReadyHandover();
  }, [loadReadyHandover]);

  const setupCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.max(1, Math.min(window.devicePixelRatio || 1, 3));
    canvas.width = Math.max(1, Math.round(rect.width * dpr));
    canvas.height = Math.max(1, Math.round(rect.height * dpr));
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.lineWidth = 2.2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#111827';
  }, []);

  useEffect(() => {
    if (!selectedManifest) return undefined;
    const timer = window.setTimeout(setupCanvas, 50);
    const handleResize = () => {
      if (!drawingRef.current) setupCanvas();
    };
    window.addEventListener('resize', handleResize);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('resize', handleResize);
    };
  }, [selectedManifest, setupCanvas]);

  const getPoint = (event) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  };

  const startSignature = (event) => {
    event.preventDefault();
    const point = getPoint(event);
    const canvas = canvasRef.current;
    if (!point || !canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.beginPath();
    ctx.moveTo(point.x, point.y);
    drawingRef.current = true;
    try { canvas.setPointerCapture(event.pointerId); } catch (_) {}
  };

  const drawSignature = (event) => {
    if (!drawingRef.current) return;
    event.preventDefault();
    const point = getPoint(event);
    const canvas = canvasRef.current;
    if (!point || !canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.lineWidth = 2.2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#111827';
    ctx.lineTo(point.x, point.y);
    ctx.stroke();
  };

  const endSignature = (event) => {
    if (!drawingRef.current) return;
    drawingRef.current = false;
    const canvas = canvasRef.current;
    if (!canvas) return;
    try { canvas.releasePointerCapture(event.pointerId); } catch (_) {}
    setSignature(canvas.toDataURL('image/png'));
  };

  const clearSignature = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setSignature('');
  };

  const openHandover = (manifest) => {
    setSelectedManifest(manifest);
    setPhotoPreview('');
    setSignature('');
    setErrorMessage('');
    window.setTimeout(setupCanvas, 60);
  };

  const closeHandover = () => {
    if (isSubmitting) return;
    setSelectedManifest(null);
    setPhotoPreview('');
    setSignature('');
    drawingRef.current = false;
  };

  const handlePhoto = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setPhotoPreview(String(reader.result || ''));
    reader.readAsDataURL(file);
  };

  const submitHandover = async (event) => {
    event.preventDefault();
    if (!selectedManifest) return;
    if (!photoPreview) {
      setErrorMessage('Foto bukti serah terima wajib diambil.');
      return;
    }
    if (!signature) {
      setErrorMessage('Tanda tangan PIC Seller wajib diisi.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage('');

    const manifestNumber = getManifestId(selectedManifest);
    const savedUser = JSON.parse(localStorage.getItem('retur_user') || '{}');

    try {
      const token = localStorage.getItem('retur_token');
      const response = await fetch(API_URL, {
        method: 'POST',
        body: JSON.stringify({
          action: 'completeHandover',
          userToken: token,
          manifestNumber,
          photoBase64: photoPreview,
          signatureBase64: signature,
          handoverBy: savedUser?.nama_sprinter || ''
        })
      });
      const result = await response.json();
      if (!result.success) throw new Error(result.message || 'Gagal menyelesaikan handover.');

      const data = result.data || {};
      const pdfUrl = data.pdfUrl || selectedManifest.pdfUrl || selectedManifest.pdf_url || '';

      setManifests((prev) => prev.filter((item) => getManifestId(item) !== manifestNumber));
      setSelectedManifest(null);
      setPhotoPreview('');
      setSignature('');
      drawingRef.current = false;

      setSuccessData({
        manifestNumber: data.manifestNumber || manifestNumber,
        handoverId: data.handoverId || '',
        sellerName: getSellerName(selectedManifest),
        photoUrl: data.photoUrl || data.photo_url || '',
        photoBase64: photoPreview,
        pdfUrl
      });
    } catch (error) {
      console.error(error);
      setErrorMessage(error.message || 'Koneksi gagal. Silakan coba lagi.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const createPhotoFile = async () => {
    if (!successData?.photoBase64) throw new Error('Foto handover tidak tersedia.');
    const response = await fetch(successData.photoBase64);
    const blob = await response.blob();
    return new File([blob], `${successData.manifestNumber}-handover.jpg`, { type: blob.type || 'image/jpeg' });
  };

  const shareToWhatsApp = async () => {
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

    try {
      const photoFile = await createPhotoFile();
      if (navigator.share && navigator.canShare && navigator.canShare({ files: [photoFile] })) {
        await navigator.share({
          title: `Handover ${successData.manifestNumber}`,
          text: caption,
          files: [photoFile]
        });
        return;
      }
    } catch (error) {
      if (error?.name === 'AbortError') return;
      console.error('Native share error:', error);
    }

    const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(caption)}`;
    window.open(whatsappUrl, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-20 max-w-md mx-auto shadow-sm relative">
      <div className="bg-white px-5 py-4 sticky top-0 z-10 border-b border-gray-100">
        <h1 className="text-lg font-bold text-gray-900">Hand Over</h1>
        <p className="text-xs text-gray-500">Manifest yang siap diserahkan ke seller</p>
      </div>

      {errorMessage && (
        <div className="fixed inset-0 z-[300] bg-black/50 flex items-center justify-center p-5">
          <div className="w-full max-w-sm bg-white rounded-3xl p-6 shadow-2xl">
            <div className="w-14 h-14 mx-auto rounded-full bg-red-50 flex items-center justify-center text-[#D71920]">
              <X size={28} />
            </div>
            <h3 className="text-lg font-bold text-gray-900 text-center mt-4">Terjadi Kesalahan</h3>
            <p className="text-sm text-gray-500 text-center mt-2">{errorMessage}</p>
            <button type="button" onClick={() => setErrorMessage('')} className="w-full mt-6 py-3.5 rounded-2xl bg-[#D71920] text-white font-bold">OKE</button>
          </div>
        </div>
      )}

      <div className="p-5 space-y-4">
        {isLoading ? (
          <div className="py-10 flex justify-center"><Loader2 className="animate-spin text-[#D71920]" /></div>
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
              <div className="flex items-center justify-between">
                <span className="font-mono font-bold text-gray-900">{id}</span>
                <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-amber-50 text-amber-700">{manifest.status || 'READY_HANDOVER'}</span>
              </div>
              <div className="mt-3 text-sm text-gray-600">
                <p>{getSellerName(manifest)}</p>
                <p className="text-xs mt-1">{manifest.totalAwb || manifest.total_awb || 0} AWB • {manifest.shiftLabel || manifest.shift || '-'}</p>
              </div>
            </button>
          );
        })}
      </div>

      <BottomNavigation />

      {selectedManifest && (
        <div className="fixed inset-0 z-[100] bg-black/50 flex items-end justify-center">
          <div className="w-full max-w-md bg-white rounded-t-3xl p-5 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="text-xl font-bold text-gray-900">Serah Terima</h2>
                <p className="text-xs text-gray-500 mt-1">{getManifestId(selectedManifest)}</p>
              </div>
              <button type="button" onClick={closeHandover} className="text-sm text-gray-500">Tutup</button>
            </div>

            <form onSubmit={submitHandover} className="space-y-5">
              <div>
                <label className="block text-sm font-semibold mb-2">Foto Bukti</label>
                <label className="block rounded-2xl border-2 border-dashed border-gray-200 bg-gray-50 p-4 text-center cursor-pointer">
                  {photoPreview ? (
                    <img src={photoPreview} alt="Bukti handover" className="w-full max-h-56 object-cover rounded-xl" />
                  ) : (
                    <>
                      <Camera className="mx-auto text-[#D71920]" size={32} />
                      <p className="text-sm font-semibold mt-2">Ambil / pilih foto</p>
                      <p className="text-xs text-gray-400 mt-1">Gunakan kamera HP untuk bukti serah terima.</p>
                    </>
                  )}
                  <input type="file" accept="image/*" capture="environment" onChange={handlePhoto} className="hidden" />
                </label>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-semibold">Tanda Tangan PIC Seller</label>
                  <button type="button" onClick={clearSignature} className="text-xs font-semibold text-[#D71920]">Hapus</button>
                </div>
                <div className="rounded-2xl border border-gray-200 bg-white overflow-hidden">
                  <canvas
                    ref={canvasRef}
                    className="block w-full h-48 bg-white touch-none"
                    style={{ touchAction: 'none' }}
                    onPointerDown={startSignature}
                    onPointerMove={drawSignature}
                    onPointerUp={endSignature}
                    onPointerCancel={endSignature}
                  />
                </div>
                <p className="text-[11px] text-gray-400 mt-2">Tanda tangan dengan jari pada area di atas.</p>
              </div>

              <button type="submit" disabled={isSubmitting} className="w-full py-4 rounded-2xl bg-[#D71920] text-white font-bold disabled:opacity-50 flex items-center justify-center">
                {isSubmitting ? <><Loader2 size={20} className="animate-spin mr-2" /> MENYIMPAN...</> : 'SELESAIKAN SERAH TERIMA'}
              </button>
            </form>
          </div>
        </div>
      )}

      {successData && (
        <div className="fixed inset-0 z-[200] bg-black/60 flex items-end justify-center backdrop-blur-sm">
          <div className="w-full max-w-md bg-white rounded-t-[32px] p-5 max-h-[94vh] overflow-y-auto">
            <div className="flex justify-center pt-2">
              <div className="w-16 h-16 rounded-full bg-green-50 flex items-center justify-center">
                <CheckCircle2 size={36} className="text-green-600" />
              </div>
            </div>

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
            </div>

            {successData.photoBase64 && (
              <div className="mt-5">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-semibold text-gray-900">Foto Bukti Handover</p>
                  {successData.photoUrl && <a href={successData.photoUrl} target="_blank" rel="noreferrer" className="text-xs font-semibold text-[#D71920]">Buka</a>}
                </div>
                <img src={successData.photoBase64} alt="Foto bukti handover" className="w-full max-h-64 object-cover rounded-2xl border border-gray-200" />
              </div>
            )}

            <div className="mt-5">
              <p className="text-sm font-semibold text-gray-900 mb-2">Manifest PDF</p>
              {successData.pdfUrl ? (
                <a href={successData.pdfUrl} target="_blank" rel="noreferrer" className="flex items-center justify-between p-4 rounded-2xl bg-red-50 border border-red-100">
                  <div className="flex items-center">
                    <FileText size={24} className="text-[#D71920] mr-3" />
                    <div>
                      <p className="font-semibold text-gray-900 text-sm">Manifest PDF</p>
                      <p className="text-xs text-gray-500">Buka dokumen manifest</p>
                    </div>
                  </div>
                  <ChevronLeft size={20} className="rotate-180 text-[#D71920]" />
                </a>
              ) : (
                <div className="p-4 rounded-2xl bg-gray-50 text-xs text-gray-500">Link PDF manifest tidak tersedia.</div>
              )}
            </div>

            <button type="button" onClick={shareToWhatsApp} className="w-full mt-5 py-4 rounded-2xl bg-[#25D366] text-white font-bold flex items-center justify-center active:scale-[0.99] transition-transform">
              <span className="text-xl mr-2">💬</span> KIRIM KE WHATSAPP
            </button>
            <p className="text-[11px] text-gray-400 text-center mt-2 px-3">Foto + caption link PDF akan dibagikan melalui menu share perangkat. Pilih WhatsApp.</p>

            <button type="button" onClick={() => { setSuccessData(null); navigate('/handover', { replace: true }); }} className="w-full mt-4 py-3.5 rounded-2xl border border-gray-200 text-gray-700 font-bold">SELESAI</button>
          </div>
        </div>
      )}
    </div>
  );
}
