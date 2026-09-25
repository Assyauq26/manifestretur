import React, { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, Clock3, FileText, Loader2, Search, XCircle, Home, CheckSquare, Clock } from 'lucide-react';

const API_URL='https://script.google.com/macros/s/AKfycbxzFZV3HMqdRf8_sFQFCZ3qQcIhnRVEXLhzTYGD7OPjv-Q7khAvMdCk8jx90Ff9d10WUw/exec';

const nav=[
  { path: '/', icon: Home, label: 'Home' },
  { path: '/manifests', icon: FileText, label: 'Manifest' },
  { path: '/handover', icon: CheckSquare, label: 'Hand Over' },
  { path: '/history', icon: Clock, label: 'Riwayat' },
];

const goTo=(path)=>{
  const hash=path==='/'?'#/':`#${path}`;
  if(window.location.hash!==hash)window.location.hash=hash;
  else window.dispatchEvent(new HashChangeEvent('hashchange'));
};

function BottomNavigation(){
  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 flex justify-around items-center h-16 z-50 max-w-md mx-auto shadow-[0_-5px_10px_rgba(0,0,0,0.03)]">
      {nav.map(({path,icon:Icon,label})=>{
        const active=path==='/history';
        return (
          <button key={path} type="button" onClick={()=>goTo(path)} className={`flex flex-col items-center justify-center w-full h-full ${active?'text-[#D71920]':'text-gray-400'}`}>
            <Icon size={23} strokeWidth={active?2.5:2}/>
            <span className={`text-[10px] font-semibold mt-1 ${active?'text-[#D71920]':'text-gray-500'}`}>{label}</span>
          </button>
        );
      })}
    </nav>
  );
}

function date(v){if(!v)return '-';const d=new Date(v);return Number.isNaN(d.getTime())?String(v):d.toLocaleString('id-ID',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'});}

export default function HistoryPage(){const[items,setItems]=useState([]),[loading,setLoading]=useState(true),[query,setQuery]=useState(''),[error,setError]=useState('');const load=useCallback(async()=>{setLoading(true);setError('');try{const r=await fetch(API_URL,{method:'POST',body:JSON.stringify({action:'getHistory',userToken:localStorage.getItem('retur_token'),query,limit:100})});const j=await r.json();if(!j.success)throw new Error(j.message||'Gagal mengambil riwayat.');setItems(Array.isArray(j.data)?j.data:[]);}catch(e){setError(e.message||'Gagal memuat riwayat.');}finally{setLoading(false);}},[query]);useEffect(()=>{const t=setTimeout(load,250);return()=>clearTimeout(t)},[load]);return <div className="min-h-screen bg-gray-50 pb-20 max-w-md mx-auto"><header className="bg-white px-5 py-4 sticky top-0 z-10 border-b border-gray-100"><h1 className="text-lg font-bold text-gray-900">Riwayat</h1><p className="text-xs text-gray-500 mt-1">Aktivitas manifest dan serah terima</p></header><main className="p-5 space-y-4"><div className="bg-white rounded-2xl p-3 border border-gray-100 flex items-center gap-2"><Search size={18} className="text-gray-400"/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Cari manifest / seller..." className="flex-1 outline-none text-sm"/>{query&&<button type="button" onClick={()=>setQuery('')} className="text-gray-400"><XCircle size={18}/></button>}</div>{loading?<div className="py-16 flex justify-center"><Loader2 className="animate-spin text-[#D71920]"/></div>:error?<div className="bg-red-50 text-red-700 rounded-2xl p-4 text-sm">{error}<button type="button" onClick={load} className="block mt-3 font-bold underline">Coba lagi</button></div>:items.length===0?<div className="bg-white rounded-2xl p-8 text-center border border-dashed border-gray-300"><Clock3 className="mx-auto text-gray-300" size={42}/><p className="mt-3 font-semibold text-gray-700">Belum ada riwayat</p><p className="text-xs text-gray-400 mt-1">Aktivitas akan tercatat setelah manifest dibuat dan diserahterimakan.</p></div>:items.map(x=><article key={x.manifestId} className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm"><div className="flex justify-between gap-3"><div><p className="font-mono font-bold text-sm text-gray-900">{x.manifestNumber}</p><p className="text-xs text-gray-500 mt-1">{x.sellerName||'-'} • {x.totalAwb} AWB</p></div><span className={`px-2 py-1 rounded-full text-[10px] font-bold ${x.status==='COMPLETED'?'bg-green-50 text-green-700':'bg-amber-50 text-amber-700'}`}>{x.status==='COMPLETED'?'SELESAI':'READY HANDOVER'}</span></div><div className="mt-4 space-y-2 text-xs"><div className="flex justify-between"><span className="text-gray-400">Manifest dibuat</span><span className="font-medium text-gray-700">{date(x.createdAt)}</span></div><div className="flex justify-between"><span className="text-gray-400">Serah terima</span><span className="font-medium text-gray-700">{date(x.handoverAt||x.completedAt)}</span></div>{x.receiverName&&<div className="flex justify-between"><span className="text-gray-400">Penerima</span><span className="font-medium text-gray-700">{x.receiverName}</span></div>}</div><div className="mt-4 flex gap-2">{x.status==='COMPLETED'&&<span className="flex-1 flex items-center justify-center gap-1 py-2.5 rounded-xl bg-green-50 text-green-700 text-xs font-bold"><CheckCircle2 size={15}/> Selesai</span>}{x.pdfUrl&&<a href={x.pdfUrl} target="_blank" rel="noreferrer" className="flex-1 flex items-center justify-center gap-1 py-2.5 rounded-xl bg-gray-50 text-gray-700 text-xs font-bold"><FileText size={15}/> PDF</a>}</div></article>)}</main><BottomNavigation/></div>}