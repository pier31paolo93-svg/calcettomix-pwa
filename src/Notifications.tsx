import {useCallback,useEffect,useState} from 'react';
import {Bell, RefreshCw, X, Clock3, CheckCircle2, AlertCircle} from 'lucide-react';
import {supabase} from './supabase';

type Notice={id:string;title:string|null;body:string|null;type:string;status:string;created_at:string;scheduled_at:string};
export default function Notifications({userId,onClose}:{userId:string;onClose:()=>void}){
 const [items,setItems]=useState<Notice[]>([]);const [error,setError]=useState('');const [loading,setLoading]=useState(false);
 const reload=useCallback(async()=>{if(!supabase)return;setLoading(true);const {data,error}=await supabase.from('notification_jobs').select('id,title,body,type,status,created_at,scheduled_at').eq('user_id',userId).order('created_at',{ascending:false}).limit(50);if(error)setError(error.message);else{setError('');setItems((data||[]) as Notice[])}setLoading(false)},[userId]);
 useEffect(()=>{void reload()},[reload]);
 return <div className="notice-overlay" onMouseDown={e=>{if(e.target===e.currentTarget)onClose()}}><section className="notice-drawer" role="dialog" aria-modal="true" aria-label="Le tue notifiche">
  <div className="notice-head"><div><small>CALCETTOMIX</small><h2><Bell size={22}/> Le tue notifiche</h2></div><button className="icon-button" aria-label="Chiudi notifiche" onClick={onClose}><X size={20}/></button></div>
  <p className="muted tiny">Messaggi salvati dal sistema. La lettura qui non equivale alla consegna push sul telefono.</p>
  <button className="outline" onClick={()=>void reload()} disabled={loading}><RefreshCw size={15}/> {loading?'Aggiornamento...':'Aggiorna'}</button>
  {error&&<p className="warn" role="alert">Impossibile leggere le notifiche: {error}</p>}
  {!loading&&!error&&!items.length&&<div className="notice-empty"><Bell size={33}/><b>Non hai ancora notifiche</b><span>Quando il sistema crea un avviso, comparirà qui.</span></div>}
  <div className="notice-list">{items.map(n=><article className="notice-item" key={n.id}><div className="notice-item-top"><strong>{n.title||'Notifica CalcettoMix'}</strong>{n.status==='SENT'?<CheckCircle2 size={17} color="#79d4ad"/>:n.status==='FAILED'?<AlertCircle size={17} color="#ff8a9d"/>:<Clock3 size={17}/>}</div><p>{n.body||'Nessun testo disponibile'}</p><small>{new Date(n.created_at).toLocaleString('it-IT',{dateStyle:'medium',timeStyle:'short'})} · {n.status==='SENT'?'Inviata':n.status==='PENDING'?'In attesa':n.status==='CANCELLED'?'Annullata':n.status==='FAILED'?'Invio non riuscito':n.status==='PROCESSING'?'In elaborazione':n.status}</small></article>)}</div>
 </section></div>
}
