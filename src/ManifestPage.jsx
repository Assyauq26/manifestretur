import React, { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, Clock3, FileText, Loader2, Search, XCircle } from 'lucide-react';

const API_URL = 'https://script.google.com/macros/s/AKfycbxzFZV3HMqdRf8_sFQFCZ3qQcIhnRVEXLhzTYGD7OPjv-Q7khAvMdCk8jx90Ff9d10WUw/exec';
const navItems = [['/','⌂','Home'],['/manifests','▤','Manifest'],['/handover','✓','Hand Over'],['/history','◷','Riwayat']];
const goTo = (path) => { const hash = path === '/' ? '#/' : `#${path}`; if (window.location.hash !== hash) window.location.hash = hash; };

function BottomNavigation(){
  return <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 flex justify-around items-center h-16 z-50 max-w-md mx-auto">
    {navItems.map(([path,icon,label])=><button key={path} type="button" onClick={()=>goTo(path)} className={`flex flex-col items-center justify-center w-full h-full ${path==='/manifests'?'text-[#D71920]':'text-gray-400'}`}><span className="text-xl leading-none">{icon}</span><span className="text-[10px] font-semibold mt-1">{label}</span></button>)}
  </div>;
}

const statusStyle={READY_HANDOVER:['bg-amber-50','text-amber-700','Belum Serah'],COMPLETED:['bg-green-50','text-green-700','Sudah Serah']};
function formatDate(value){if(!value)return '-';const d=new Date(value);return Number.isNaN(d.getTime())?String(value):d.toLocaleDateString('id-ID',{day:'2-digit',month:'short',year:'numeric'});}

export default function ManifestPage(){
 const [items,setItems]=useState([]),[loading,setLoading]=useState(true),[query,setQuery]=useState(''),[status,setStatus]=useState(''),[error,setError]=useState('');
 const load=useCallback(async()=>{setLoading(true);setError('');try{const token=localStorage.getItem('retur_token');const r=await fetch(API_URL,{method:'POST',body:JSON.stringify({action:'getManifests',userToken:token,query,status,limit:100})});const j=await r.json();if(!j.success)throw new Error(j.message||'Gagal mengambil manifest.');setItems(Array.isArray(j.data)?j.data:[]);}catch(e){setError(e.message||'Gagal memuat data.');}finally{setLoading(false);}},[query,status]);
 useEffect(()=>{const t=setTimeout(load,250);return()=>clearTimeout(t)},[load]);
 return <div className="min-h-screen bg-gray-50 pb-20 max-w-md mx-auto">
  <header className="bg-white px-5 py-4 sticky top-0 z-10 border-b border-gray-100"><h1 className="text-lg font-bold text-gray-900">Manifest</h1><p className="text-xs text-gray-500 mt-1">Daftar manifest dan status serah terima</p></header>
  <main className="p-5 space-y-4">
   <div className="bg-white rounded-2xl p-3 border border-gray-100 flex items-center gap-2"><Search size={18} className="text-gray-400"/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Cari nomor manifest / seller..." className="flex-1 outline-none text-sm"/><button type="button" onClick={()=>setQuery('')} className="text-gray-400">{query&&<XCircle size={18}/>}</button></div>
   <div className="flex gap-2 overflow-x-auto pb-1">{[['','Semua'],['READY_HANDOVER','Belum Serah'],['COMPLETED','Sudah Serah']].map(([v,l])=><button type="button" key={v} onClick={()=>setStatus(v)} className={`shrink-0 px-4 py-2 rounded-full text-xs font-bold border ${status===v?'bg-[#D71920] text-white border-[#D71920]':'bg-white text-gray-500 border-gray-200'}`}>{l}</button>)}</div>
   {loading?<div className="py-16 flex justify-center"><Loader2 className="animate-spin text-[#D71920]"/></div>:error?<div className="bg-red-50 text-red-700 rounded-2xl p-4 text-sm">{error}<button type="button" onClick={load} className="block mt-3 font-bold underline">Coba lagi</button></div>:items.length===0?<div className="bg-white rounded-2xl p-8 text-center border border-dashed border-gray-300"><FileText className="mx-auto text-gray-300" size={42}/><p className="mt-3 font-semibold text-gray-700">Belum ada manifest</p><p className="text-xs text-gray-400 mt-1">Data akan muncul setelah manifest dibuat.</p></div>:items.map(item=>{const s=statusStyle[item.status]||['bg-gray-50','text-gray-600',item.status||'-'];return <article key={item.manifestId} className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm"><div className="flex items-start justify-between gap-3"><div><p className="font-mono font-bold text-gray-900 text-sm">{item.manifestNumber}</p><p className="text-xs text-gray-500 mt-1">{formatDate(item.manifestDate)} • Shift {item.shift||'-'}</p></div><span className={`shrink-0 px-2 py-1 rounded-full text-[10px] font-bold ${s[0]} ${s[1]}`}>{s[2]}</span></div><div className="mt-4 grid grid-cols-2 gap-3 text-xs"><div><p className="text-gray-400">Seller</p><p className="font-semibold text-gray-800 mt-1">{item.sellerName||'-'}</p></div><div><p className="text-gray-400">Total AWB</p><p className="font-semibold text-gray-800 mt-1">{item.totalAwb} AWB</p></div></div>{item.receiverName&&<div className="mt-3 text-xs text-gray-500">Penerima: <span className="font-semibold text-gray-800">{item.receiverName}</span></div>}{item.pdfUrl&&<a href={item.pdfUrl} target="_blank" rel="noreferrer" className="mt-4 flex items-center justify-center gap-2 w-full py-3 rounded-xl bg-gray-50 text-gray-700 font-bold text-xs"><FileText size={16}/> Buka PDF Manifest</a>}{item.status==='COMPLETED'&&<div className="mt-3 flex items-center gap-2 text-xs text-green-700 font-semibold"><CheckCircle2 size={15}/> Serah terima selesai {formatDate(item.completedAt||item.handoverAt)}</div>}{item.status==='READY_HANDOVER'&&<div className="mt-3 flex items-center gap-2 text-xs text-amber-700 font-semibold"><Clock3 size={15}/> Menunggu serah terima</div>}</article>})}
  </main><BottomNavigation/>
 </div>;
}
