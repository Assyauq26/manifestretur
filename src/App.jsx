import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { HashRouter as Router, Routes, Route, Navigate, useNavigate, Link, useLocation } from 'react-router-dom';
import { Eye, EyeOff, Loader2, ChevronLeft, Calendar, User as UserIcon, MapPin, Camera, Type, Trash2, Save, AlertCircle, Home, FileText, CheckSquare, Clock } from 'lucide-react';

const API_URL = "https://script.google.com/macros/s/AKfycbxzFZV3HMqdRf8_sFQFCZ3qQcIhnRVEXLhzTYGD7OPjv-Q7khAvMdCk8jx90Ff9d10WUw/exec";

const AuthContext = createContext(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
};

const BottomNavigation = () => {
  const location = useLocation();
  const currentPath = location.pathname;

  const navItems = [
    { path: '/', icon: Home, label: 'Home' },
    { path: '/manifests', icon: FileText, label: 'Manifest' },
    { path: '/handover', icon: CheckSquare, label: 'Hand Over' },
    { path: '/history', icon: Clock, label: 'Riwayat' },
  ];

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 flex justify-around items-center h-16 z-50 max-w-md mx-auto shadow-[0_-5px_10px_rgba(0,0,0,0.02)]">
      {navItems.map((item) => {
        const Icon = item.icon;
        const isActive = currentPath === item.path || (currentPath === '/' && item.path === '/');
        return (
          <Link
            key={item.path}
            to={item.path}
            className={`flex flex-col items-center justify-center w-full h-full space-y-1 transition-colors ${isActive ? 'text-[#D71920]' : 'text-gray-400 hover:text-gray-600'}`}
          >
            <Icon size={24} strokeWidth={isActive ? 2.5 : 2} />
            <span className={`text-[10px] font-semibold ${isActive ? 'text-[#D71920]' : 'text-gray-500'}`}>{item.label}</span>
          </Link>
        );
      })}
    </div>
  );
};

const LoginPage = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    if (!username || !password) {
      setError('Username dan password harus diisi.');
      return;
    }
    setIsLoading(true);
    try {
      const response = await fetch(API_URL, {
        method: 'POST',
        body: JSON.stringify({ action: 'login', username, password })
      });
      const result = await response.json();
      if (result.success) {
        login(result.data.user, result.data.token);
        navigate('/');
      } else {
        setError(result.message || 'Login gagal.');
      }
    } catch (err) {
      setError('Koneksi ke server gagal. Silakan coba lagi.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white flex flex-col justify-center px-6 py-12 font-sans max-w-md mx-auto shadow-sm relative z-10">
      <div className="mx-auto w-full">
        <h2 className="text-center text-3xl font-extrabold tracking-tight text-[#D71920]">J&T EXPRESS</h2>
        <h3 className="mt-2 text-center text-md font-semibold text-gray-700 tracking-[0.2em]">MANIFEST RETUR</h3>
      </div>
      <div className="mt-12 mx-auto w-full">
        <form className="space-y-6" onSubmit={handleLogin}>
          {error && <div className="p-4 text-sm text-red-700 bg-red-50 rounded-2xl border border-red-100 flex items-center"><span>{error}</span></div>}
          <div>
            <label className="block text-sm font-semibold leading-6 text-gray-900 mb-2">Username</label>
            <input type="text" required value={username} onChange={(e) => setUsername(e.target.value)} className="block w-full rounded-2xl border-0 py-4 px-5 text-gray-900 bg-gray-50 shadow-sm ring-1 ring-inset ring-gray-200 focus:ring-2 focus:ring-inset focus:ring-[#D71920] sm:text-sm outline-none transition-all" placeholder="Masukkan username Anda" />
          </div>
          <div>
            <label className="block text-sm font-semibold leading-6 text-gray-900 mb-2">Password</label>
            <div className="mt-2 relative">
              <input type={showPassword ? "text" : "password"} required value={password} onChange={(e) => setPassword(e.target.value)} className="block w-full rounded-2xl border-0 py-4 px-5 pr-12 text-gray-900 bg-gray-50 shadow-sm ring-1 ring-inset ring-gray-200 focus:ring-2 focus:ring-inset focus:ring-[#D71920] sm:text-sm outline-none transition-all" placeholder="Masukkan password Anda" />
              <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute inset-y-0 right-0 flex items-center pr-5 text-gray-400 hover:text-gray-600">{showPassword ? <EyeOff size={20} /> : <Eye size={20} />}</button>
            </div>
          </div>
          <div className="pt-4">
            <button type="submit" disabled={isLoading} className="flex w-full justify-center items-center rounded-2xl bg-[#D71920] px-3 py-4 text-sm font-bold text-white shadow-md hover:bg-[#B9151B] disabled:opacity-70 transition-colors">
              {isLoading && <Loader2 className="animate-spin mr-2" size={20} />}
              {isLoading ? 'MEMPROSES...' : 'MASUK'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const HomePage = () => {
  const { user, logout } = useAuth();
  return (
    <div className="min-h-screen bg-gray-50 pb-20 max-w-md mx-auto shadow-sm relative">
      <div className="bg-[#D71920] text-white p-6 rounded-b-3xl shadow-md relative overflow-hidden">
        <div className="absolute -top-10 -right-10 w-32 h-32 bg-white opacity-10 rounded-full"></div>
        <div className="relative z-10">
          <h1 className="text-2xl font-bold">Beranda</h1>
          <p className="mt-2 text-red-100 text-sm">Selamat datang,</p>
          <p className="text-2xl font-bold">{user?.nama_sprinter}</p>
          <div className="mt-2 inline-flex items-center bg-black/20 px-3 py-1.5 rounded-full text-xs font-semibold backdrop-blur-sm"><MapPin size={14} className="mr-1" /> Drop Point {user?.drop_point_id}</div>
        </div>
      </div>
      <div className="p-6 -mt-4 relative z-20">
        <Link to="/manifest/create" className="w-full flex justify-center items-center py-4 bg-white text-[#D71920] rounded-2xl shadow-sm border border-gray-100 font-bold text-lg hover:bg-gray-50 active:bg-gray-100 transition-colors"><span className="text-2xl mr-2">+</span> BUAT MANIFEST</Link>
      </div>
      <div className="px-6 mb-24">
        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm mt-2">
          <h3 className="font-bold text-gray-800 mb-3">Ringkasan Hari Ini</h3>
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-gray-50 p-4 rounded-xl border border-gray-100"><p className="text-2xl font-black text-gray-800">0</p><p className="text-xs font-medium text-gray-500 mt-1">Manifest</p></div>
            <div className="bg-gray-50 p-4 rounded-xl border border-gray-100"><p className="text-2xl font-black text-gray-800">0</p><p className="text-xs font-medium text-gray-500 mt-1">AWB Retur</p></div>
          </div>
        </div>
        <button onClick={logout} className="w-full py-3 mt-6 border border-gray-200 text-gray-500 rounded-xl hover:bg-gray-100 font-semibold bg-white shadow-sm">Logout</button>
      </div>
      <BottomNavigation />
    </div>
  );
};

const CreateManifestPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [sellers, setSellers] = useState([]);
  const [isLoadingSellers, setIsLoadingSellers] = useState(true);
  const [shift, setShift] = useState("1");
  const [selectedSeller, setSelectedSeller] = useState("");
  const today = new Date().toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  useEffect(() => {
    const fetchSellers = async () => {
      try {
        const response = await fetch(API_URL, { method: 'POST', body: JSON.stringify({ action: 'getSellers' }) });
        const result = await response.json();
        if (result.success) setSellers(result.data);
      } catch (error) {
        console.error("Gagal mengambil data seller", error);
      } finally {
        setIsLoadingSellers(false);
      }
    };
    fetchSellers();
  }, []);

  const handleNext = (e) => {
    e.preventDefault();
    if (!selectedSeller) {
      alert("Silakan pilih Seller terlebih dahulu.");
      return;
    }
    const sellerInfo = sellers.find(s => s.seller_id === selectedSeller);
    navigate('/manifest/scanner', { state: { shift, sellerId: selectedSeller, sellerName: sellerInfo?.seller_name || 'Seller' } });
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col font-sans max-w-md mx-auto shadow-sm">
      <div className="bg-white px-4 py-4 flex items-center shadow-sm sticky top-0 z-10">
        <button onClick={() => navigate(-1)} className="p-2 -ml-2 text-gray-600 hover:text-[#D71920]"><ChevronLeft size={24} /></button>
        <h1 className="text-lg font-bold ml-2 text-gray-900">Buat Manifest Baru</h1>
      </div>
      <div className="flex-1 p-5 pb-24">
        <form onSubmit={handleNext} className="space-y-6">
          <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 space-y-3">
            <div className="flex items-center text-sm text-gray-600"><Calendar size={18} className="mr-3 text-[#D71920]" /><span className="font-medium">{today}</span></div>
            <div className="flex items-center text-sm text-gray-600"><MapPin size={18} className="mr-3 text-[#D71920]" /><span>Drop Point: <span className="font-bold text-gray-900">{user?.drop_point_id}</span> 🔒</span></div>
            <div className="flex items-center text-sm text-gray-600"><UserIcon size={18} className="mr-3 text-[#D71920]" /><span>Sprinter: <span className="font-bold text-gray-900">{user?.nama_sprinter}</span> 🔒</span></div>
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-2">Pilih Shift</label>
            <div className="grid grid-cols-3 gap-3">
              {[{ id: "1", label: "Pagi" }, { id: "2", label: "Siang" }, { id: "3", label: "Sore" }].map((s) => (
                <button key={s.id} type="button" onClick={() => setShift(s.id)} className={`py-3 rounded-xl border font-bold transition-all text-sm ${shift === s.id ? 'bg-red-50 border-[#D71920] text-[#D71920]' : 'bg-white border-gray-200 text-gray-500'}`}>{s.label}</button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-2">Pilih Seller</label>
            {isLoadingSellers ? (
              <div className="flex items-center justify-center p-4 bg-white border border-gray-200 rounded-xl text-sm text-gray-500"><Loader2 size={18} className="animate-spin mr-2 text-[#D71920]" /> Memuat data seller...</div>
            ) : (
              <div className="relative">
                <select required value={selectedSeller} onChange={(e) => setSelectedSeller(e.target.value)} className="block w-full appearance-none rounded-xl border border-gray-200 bg-white py-4 px-4 pr-10 text-gray-900 font-medium shadow-sm focus:border-[#D71920] focus:outline-none focus:ring-1 focus:ring-[#D71920]">
                  <option value="" disabled>-- Pilih Seller --</option>
                  {sellers.map((seller) => <option key={seller.seller_id} value={seller.seller_id}>{seller.seller_name} ({seller.receiver_name})</option>)}
                </select>
              </div>
            )}
          </div>
          <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-gray-100 shadow-[0_-10px_15px_-3px_rgba(0,0,0,0.05)] max-w-md mx-auto z-50">
            <button type="submit" disabled={!selectedSeller || isLoadingSellers} className="w-full flex justify-center py-4 rounded-2xl bg-[#D71920] text-white font-bold text-lg shadow-md hover:bg-[#B9151B] disabled:opacity-50 transition-all">Lanjut Scan AWB</button>
          </div>
        </form>
      </div>
    </div>
  );
};

const AwbScannerPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  if (!location.state) return <Navigate to="/manifest/create" replace />;
  const { shift, sellerId, sellerName } = location.state;
  const [awbList, setAwbList] = useState([]);
  const [manualInput, setManualInput] = useState('');
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [toastMessage, setToastMessage] = useState(null);
  const [scannerError, setScannerError] = useState('');
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [successData, setSuccessData] = useState(null);
  const scannerRef = useRef(null);

  const playBeep = () => {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(800, ctx.currentTime);
      osc.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.1);
    } catch (e) { console.log("Audio not supported"); }
  };

  const showToast = (message) => {
    setToastMessage(message);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleAddAwb = useCallback((awbNumber) => {
    const cleanAwb = awbNumber.trim().toUpperCase();
    if (!cleanAwb) return;
    if (awbList.includes(cleanAwb)) {
      showToast(`AWB ${cleanAwb} sudah ada di daftar!`);
      return;
    }
    setAwbList(prev => [cleanAwb, ...prev]);
    setManualInput('');
    playBeep();
  }, [awbList]);

  const handleManualSubmit = (e) => { e.preventDefault(); handleAddAwb(manualInput); };
  const handleDeleteAwb = (awbToDelete) => setAwbList(prev => prev.filter(awb => awb !== awbToDelete));

  useEffect(() => {
    if (!isCameraActive) return;
    setScannerError('');
    const scriptId = 'html5qrcode-script';
    let script = document.getElementById(scriptId);
    let html5QrCode = null;

    const initScanner = () => {
      if (!window.Html5Qrcode) { setScannerError("Gagal memuat library scanner."); return; }
      try {
        html5QrCode = new window.Html5Qrcode("reader");
        html5QrCode.start({ facingMode: "environment" }, { fps: 10, qrbox: { width: 250, height: 150 } }, (decodedText) => handleAddAwb(decodedText), () => {}).catch(err => {
          console.error("Camera Error:", err);
          setScannerError("Gagal membuka kamera. Pastikan izin diberikan di browser Anda.");
          setIsCameraActive(false);
        });
      } catch (err) {
        setScannerError("Kamera sedang digunakan aplikasi lain atau tidak ditemukan.");
        setIsCameraActive(false);
      }
    };

    if (!script) {
      script = document.createElement('script');
      script.id = scriptId;
      script.src = "https://unpkg.com/html5-qrcode";
      script.async = true;
      script.onload = initScanner;
      document.body.appendChild(script);
    } else initScanner();

    return () => {
      if (html5QrCode && html5QrCode.isScanning) html5QrCode.stop().then(() => html5QrCode.clear()).catch(console.error);
    };
  }, [isCameraActive, handleAddAwb]);

  const handleSaveDraft = () => {
    if (awbList.length === 0) { alert("Belum ada AWB yang discan!"); return; }
    alert(`Draft Disimpan!\nTotal: ${awbList.length} AWB.`);
  };

  const handleGeneratePdf = async () => {
    if (awbList.length === 0) return;
    setIsCameraActive(false);
    setToastMessage(null);
    setIsGeneratingPdf(true);
    try {
      const token = localStorage.getItem('retur_token');
      const response = await fetch(API_URL, {
        method: 'POST',
        body: JSON.stringify({ action: 'generateManifest', shift, sellerId, awbs: [...awbList].reverse(), userToken: token })
      });
      const result = await response.json();
      if (result.success) setSuccessData({ manifestNumber: result.data.manifestNumber, pdfUrl: result.data.pdfUrl });
      else showToast(result.message || "Gagal membuat PDF.");
    } catch (err) {
      console.error(err);
      showToast("Koneksi gagal saat membuat PDF.");
    } finally { setIsGeneratingPdf(false); }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col font-sans max-w-md mx-auto shadow-sm relative">
      <div className="bg-white px-4 py-4 flex items-center justify-between shadow-sm sticky top-0 z-10">
        <div className="flex items-center">
          <button onClick={() => navigate(-1)} className="p-2 -ml-2 text-gray-600 hover:text-[#D71920]"><ChevronLeft size={24} /></button>
          <div className="ml-2"><h1 className="text-lg font-bold text-gray-900 leading-tight">Input AWB</h1><p className="text-xs text-gray-500 font-medium">{sellerName} • Shift {shift}</p></div>
        </div>
        <div className="bg-red-50 text-[#D71920] px-3 py-1 rounded-full font-bold text-sm">{awbList.length} AWB</div>
      </div>

      {toastMessage && <div className="fixed top-20 left-1/2 transform -translate-x-1/2 z-50 w-[90%] max-w-sm"><div className="bg-gray-900 text-white px-4 py-3 rounded-xl shadow-lg flex items-center text-sm font-medium"><AlertCircle size={18} className="mr-2 text-red-400 flex-shrink-0" />{toastMessage}</div></div>}

      {successData && (
        <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-3xl p-6 w-full max-w-sm text-center shadow-2xl">
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4"><CheckSquare size={40} className="text-green-600" /></div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Berhasil!</h2>
            <p className="text-gray-500 text-sm mb-6">Manifest berhasil dibuat dan disimpan ke Google Drive.</p>
            <div className="bg-gray-50 p-4 rounded-xl border border-gray-100 mb-6"><p className="text-xs text-gray-400 mb-1">Nomor Manifest</p><p className="font-mono font-bold text-gray-800 tracking-wider">{successData.manifestNumber}</p></div>
            <div className="space-y-3">
              <button onClick={() => window.open(successData.pdfUrl, '_blank')} className="w-full py-4 rounded-xl bg-[#D71920] text-white font-bold shadow-md hover:bg-[#B9151B] transition-colors">BUKA PDF SEKARANG</button>
              <button onClick={() => navigate('/', { replace: true })} className="w-full py-4 rounded-xl bg-white border border-gray-200 text-gray-700 font-bold hover:bg-gray-50 transition-colors">KEMBALI KE BERANDA</button>
            </div>
          </div>
        </div>
      )}

      <div className="flex-1 p-5 pb-28 space-y-6">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          {isCameraActive ? (
            <div className="relative bg-black h-[280px] w-full flex flex-col items-center justify-center">
              <div id="reader" className="w-full h-full object-cover"></div>
              {scannerError ? <div className="absolute inset-0 flex items-center justify-center text-white text-center p-4 bg-black/80 text-sm">{scannerError}</div> : <div className="absolute top-4 left-1/2 transform -translate-x-1/2 text-white bg-black/50 px-3 py-1 rounded-full text-xs font-semibold backdrop-blur-sm z-10">Arahkan ke Barcode Resi</div>}
            </div>
          ) : (
            <div className="p-6 text-center border-b border-gray-100"><div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-3 text-[#D71920]"><Camera size={28} /></div><h3 className="font-bold text-gray-900 mb-1">Scanner Kamera</h3><p className="text-xs text-gray-500 mb-4">Gunakan kamera HP untuk scan AWB berurutan.</p></div>
          )}
          <button onClick={() => setIsCameraActive(!isCameraActive)} className={`w-full py-4 text-sm font-bold transition-colors ${isCameraActive ? 'bg-gray-100 text-gray-700 hover:bg-gray-200' : 'bg-[#D71920] text-white hover:bg-[#B9151B]'}`}>{isCameraActive ? 'TUTUP KAMERA' : 'BUKA KAMERA'}</button>
        </div>

        <div className="flex items-center"><hr className="flex-grow border-gray-200" /><span className="px-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">ATAU</span><hr className="flex-grow border-gray-200" /></div>

        <form onSubmit={handleManualSubmit} className="relative">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none"><Type size={18} className="text-gray-400" /></div>
          <input type="text" value={manualInput} onChange={(e) => setManualInput(e.target.value)} placeholder="Ketik/Paste manual nomor AWB..." className="block w-full rounded-xl border-0 py-4 pl-11 pr-24 text-gray-900 bg-white shadow-sm ring-1 ring-inset ring-gray-200 focus:ring-2 focus:ring-inset focus:ring-[#D71920] sm:text-sm outline-none" />
          <button type="submit" disabled={!manualInput.trim()} className="absolute inset-y-1.5 right-1.5 flex items-center px-4 rounded-lg bg-gray-900 text-white text-xs font-bold hover:bg-gray-800 disabled:opacity-50 transition-colors">TAMBAH</button>
        </form>

        <div>
          <h3 className="font-bold text-gray-900 mb-3 text-sm flex justify-between items-center">Daftar AWB Retur <span className="text-xs font-normal text-gray-500">{awbList.length} Item</span></h3>
          {awbList.length === 0 ? (
            <div className="text-center py-10 bg-white rounded-2xl border border-dashed border-gray-300"><p className="text-sm text-gray-500 font-medium">Belum ada AWB.</p><p className="text-xs text-gray-400 mt-1">Mulai scan atau ketik manual.</p></div>
          ) : (
            <div className="space-y-2 max-h-[40vh] overflow-y-auto pr-1 pb-4">
              {awbList.map((awb, index) => (
                <div key={awb} className="flex items-center justify-between bg-white p-3.5 rounded-xl border border-gray-100 shadow-[0_2px_4px_rgba(0,0,0,0.02)]">
                  <div className="flex items-center"><span className="w-6 text-xs font-bold text-gray-400">{awbList.length - index}.</span><span className="font-bold text-gray-800 tracking-wide">{awb}</span></div>
                  <button onClick={() => handleDeleteAwb(awb)} className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"><Trash2 size={18} /></button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-gray-100 shadow-[0_-10px_15px_-3px_rgba(0,0,0,0.05)] max-w-md mx-auto grid grid-cols-2 gap-3 z-50">
        <button onClick={handleSaveDraft} className="flex justify-center items-center py-4 rounded-xl border-2 border-gray-200 text-gray-700 font-bold text-sm hover:bg-gray-50 transition-colors"><Save size={18} className="mr-2 text-gray-500" /> DRAFT</button>
        <button onClick={handleGeneratePdf} disabled={awbList.length === 0 || isGeneratingPdf} className="flex justify-center items-center py-4 rounded-xl bg-[#D71920] text-white font-bold text-sm shadow-md hover:bg-[#B9151B] disabled:opacity-50 transition-all">
          {isGeneratingPdf ? <><Loader2 className="animate-spin mr-2" size={18} /> MEMPROSES...</> : <>LANJUT PDF <ChevronLeft size={18} className="ml-1 rotate-180" /></>}
        </button>
      </div>
    </div>
  );
};

const HandoverPage = () => {
  const { user } = useAuth();
  const [manifests, setManifests] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedManifest, setSelectedManifest] = useState(null);
  const [photoPreview, setPhotoPreview] = useState('');
  const [signature, setSignature] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const canvasRef = useRef(null);
  const drawingRef = useRef(false);
  const navigate = useNavigate();

  useEffect(() => {
    const load = async () => {
      setIsLoading(true);
      try {
        const token = localStorage.getItem('retur_token');
        const response = await fetch(API_URL, { method: 'POST', body: JSON.stringify({ action: 'getReadyHandover', userToken: token }) });
        const result = await response.json();
        if (result.success) setManifests(Array.isArray(result.data) ? result.data : []);
      } catch (e) {
        console.error(e);
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, []);

  const startSignature = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const point = e.touches?.[0] || e;
    const x = point.clientX - rect.left;
    const y = point.clientY - rect.top;
    const ctx = canvas.getContext('2d');
    ctx.beginPath(); ctx.moveTo(x, y);
    drawingRef.current = true;
  };

  const drawSignature = (e) => {
    if (!drawingRef.current) return;
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const point = e.touches?.[0] || e;
    const x = point.clientX - rect.left;
    const y = point.clientY - rect.top;
    const ctx = canvas.getContext('2d');
    ctx.lineWidth = 2; ctx.lineCap = 'round'; ctx.strokeStyle = '#111827';
    ctx.lineTo(x, y); ctx.stroke();
    e.preventDefault?.();
  };

  const endSignature = () => {
    drawingRef.current = false;
    const canvas = canvasRef.current;
    if (canvas) setSignature(canvas.toDataURL('image/png'));
  };

  const clearSignature = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
    setSignature('');
  };

  const handlePhoto = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setPhotoPreview(reader.result);
    reader.readAsDataURL(file);
  };

  const submitHandover = async (e) => {
    e.preventDefault();
    if (!selectedManifest) return;
    if (!photoPreview) { alert('Foto bukti serah terima wajib diambil.'); return; }
    if (!signature) { alert('Tanda tangan PIC Seller wajib diisi.'); return; }

    setIsSubmitting(true);
    try {
      const token = localStorage.getItem('retur_token');
      const response = await fetch(API_URL, {
        method: 'POST',
        body: JSON.stringify({
          action: 'completeHandover',
          userToken: token,
          manifestNumber: selectedManifest.manifestNumber || selectedManifest.manifest_number || selectedManifest.id,
          photoBase64: photoPreview,
          signatureBase64: signature,
          handoverBy: user?.nama_sprinter || ''
        })
      });
      const result = await response.json();
      if (!result.success) throw new Error(result.message || 'Gagal menyelesaikan handover.');
      setManifests(prev => prev.filter(m => (m.manifestNumber || m.manifest_number || m.id) !== (selectedManifest.manifestNumber || selectedManifest.manifest_number || selectedManifest.id)));
      setSelectedManifest(null);
      setPhotoPreview('');
      setSignature('');
      alert('Serah terima berhasil diselesaikan.');
    } catch (err) {
      console.error(err);
      alert(err.message || 'Koneksi gagal.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-20 max-w-md mx-auto shadow-sm">
      <div className="bg-white px-5 py-4 sticky top-0 z-10 border-b border-gray-100">
        <h1 className="text-lg font-bold text-gray-900">Hand Over</h1>
        <p className="text-xs text-gray-500">Manifest yang siap diserahkan ke seller</p>
      </div>
      <div className="p-5 space-y-4">
        {isLoading ? <div className="py-10 flex justify-center"><Loader2 className="animate-spin text-[#D71920]" /></div> : manifests.length === 0 ? (
          <div className="bg-white rounded-2xl p-8 text-center border border-dashed border-gray-300"><CheckSquare className="mx-auto text-gray-300" size={42} /><p className="mt-3 font-semibold text-gray-700">Belum ada manifest</p><p className="text-xs text-gray-400 mt-1">Tidak ada manifest berstatus READY_HANDOVER.</p></div>
        ) : manifests.map((manifest) => {
          const id = manifest.manifestNumber || manifest.manifest_number || manifest.id;
          return (
            <button key={id} onClick={() => { setSelectedManifest(manifest); setPhotoPreview(''); setSignature(''); setTimeout(clearSignature, 0); }} className="w-full text-left bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
              <div className="flex items-center justify-between"><span className="font-mono font-bold text-gray-900">{id}</span><span className="text-[10px] font-bold px-2 py-1 rounded-full bg-amber-50 text-amber-700">{manifest.status || 'READY_HANDOVER'}</span></div>
              <div className="mt-3 text-sm text-gray-600"><p>{manifest.sellerName || manifest.seller_name || 'Seller'}</p><p className="text-xs mt-1">{manifest.totalAwb || manifest.total_awb || 0} AWB • {manifest.shiftLabel || manifest.shift || '-'}</p></div>
            </button>
          );
        })}
      </div>
      <BottomNavigation />

      {selectedManifest && (
        <div className="fixed inset-0 z-[100] bg-black/50 flex items-end justify-center">
          <div className="w-full max-w-md bg-white rounded-t-3xl p-5 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <div><h2 className="text-xl font-bold">Serah Terima</h2><p className="text-xs text-gray-500">{selectedManifest.manifestNumber || selectedManifest.manifest_number || selectedManifest.id}</p></div>
              <button onClick={() => setSelectedManifest(null)} className="text-sm text-gray-500">Tutup</button>
            </div>
            <form onSubmit={submitHandover} className="space-y-5">
              <div>
                <label className="block text-sm font-semibold mb-2">Foto Bukti</label>
                <label className="block rounded-2xl border-2 border-dashed border-gray-200 bg-gray-50 p-4 text-center cursor-pointer">
                  {photoPreview ? <img src={photoPreview} alt="Bukti handover" className="w-full max-h-56 object-cover rounded-xl" /> : <><Camera className="mx-auto text-[#D71920]" size={32} /><p className="text-sm font-semibold mt-2">Ambil / pilih foto</p><p className="text-xs text-gray-400 mt-1">Gunakan kamera HP untuk bukti serah terima.</p></>}
                  <input type="file" accept="image/*" capture="environment" onChange={handlePhoto} className="hidden" />
                </label>
              </div>
              <div>
                <div className="flex items-center justify-between mb-2"><label className="block text-sm font-semibold">Tanda Tangan PIC Seller</label><button type="button" onClick={clearSignature} className="text-xs font-semibold text-[#D71920]">Hapus</button></div>
                <div className="rounded-2xl border border-gray-200 bg-white overflow-hidden touch-none"><canvas ref={canvasRef} width={900} height={360} className="w-full h-48 bg-white" onMouseDown={startSignature} onMouseMove={drawSignature} onMouseUp={endSignature} onMouseLeave={endSignature} onTouchStart={startSignature} onTouchMove={drawSignature} onTouchEnd={endSignature} /></div>
                <p className="text-[11px] text-gray-400 mt-2">Tanda tangan dengan jari pada area di atas.</p>
              </div>
              <button type="submit" disabled={isSubmitting} className="w-full py-4 rounded-2xl bg-[#D71920] text-white font-bold disabled:opacity-50">{isSubmitting ? 'MENYIMPAN...' : 'SELESAIKAN SERAH TERIMA'}</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

const EmptyPage = ({ title }) => (
  <div className="min-h-screen bg-gray-50 flex items-center justify-center flex-col relative z-10 pb-20">
    <div className="w-16 h-16 bg-gray-200 rounded-full flex items-center justify-center mb-4 text-gray-400"><FileText size={28} /></div>
    <h2 className="text-xl font-bold text-gray-800">{title}</h2>
    <p className="text-sm text-gray-500 mt-2 text-center px-6">Halaman ini sedang dalam tahap pengembangan (Fase berikutnya).</p>
    <BottomNavigation />
  </div>
);

export default function App() {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const savedToken = localStorage.getItem('retur_token');
    const savedUser = localStorage.getItem('retur_user');
    if (savedToken && savedUser) {
      setToken(savedToken);
      setUser(JSON.parse(savedUser));
    }
    setIsReady(true);
  }, []);

  const login = (userData, authToken) => {
    setUser(userData); setToken(authToken);
    localStorage.setItem('retur_token', authToken);
    localStorage.setItem('retur_user', JSON.stringify(userData));
  };

  const logout = () => {
    setUser(null); setToken(null);
    localStorage.removeItem('retur_token');
    localStorage.removeItem('retur_user');
  };

  const ProtectedRoute = ({ children }) => token ? <>{children}</> : <Navigate to="/login" replace />;
  if (!isReady) return <div className="min-h-screen bg-white flex items-center justify-center"><Loader2 className="animate-spin text-[#D71920]" size={32} /></div>;

  return (
    <AuthContext.Provider value={{ user, token, login, logout }}>
      <div className="bg-gray-200 min-h-screen">
        <Router>
          <Routes>
            <Route path="/login" element={token ? <Navigate to="/" replace /> : <LoginPage />} />
            <Route path="/" element={<ProtectedRoute><HomePage /></ProtectedRoute>} />
            <Route path="/manifests" element={<ProtectedRoute><EmptyPage title="Daftar Manifest" /></ProtectedRoute>} />
            <Route path="/handover" element={<ProtectedRoute><HandoverPage /></ProtectedRoute>} />
            <Route path="/history" element={<ProtectedRoute><EmptyPage title="Riwayat Aktivitas" /></ProtectedRoute>} />
            <Route path="/manifest/create" element={<ProtectedRoute><CreateManifestPage /></ProtectedRoute>} />
            <Route path="/manifest/scanner" element={<ProtectedRoute><AwbScannerPage /></ProtectedRoute>} />
          </Routes>
        </Router>
      </div>
    </AuthContext.Provider>
  );
}
