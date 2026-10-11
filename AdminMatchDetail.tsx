import {useCallback,useEffect,useState} from 'react';
import {RefreshCw,X,Users,Clock3,Trash2} from 'lucide-react';
import {supabase} from './supabase';
type Booking={id:string;user_id:string|null;player_name:string|null;status:string;source:string;created_at:string};
type Participant={booking_id:string;display_name:string;is_holder:boolean;status:string};
type Offer={booking_id:string;status:string;offered_seats:number;created_at:string};
type Payment={booking_id:string;status:string;amount_due:number};
const format=(d:string)=>new Date(d).toLocaleString('it-IT',{dateStyle:'medium',timeStyle:'short'});
export default function AdminMatchDetail({matchId,onClose,onChanged}:{matchId:string;onClose:()=>void;onChanged:()=>void}){
 const [bookings,setBookings]=useState<Booking[]>([]);const [participants,setParticipants]=useState<Participant[]>([]);const [offers,setOffers]=useState<Offer[]>([]);const [payments,setPayments]=useState<Payment[]>([]);const [players,setPlayers]=useState<Record<string,string>>({});const [busy,setBusy]=useState(false);const [error,setError]=useState('');
 const reload=useCallback(async()=>{if(!supabase)return;setBusy(true);setError('');try{
  const b=await supabase.from('bookings').select('id,user_id,player_name,status,source,created_at').eq('match_id',matchId).order('created_at',{ascending:true});if(b.error)throw b.error;
  const bs=(b.data||[]) as Booking[];setBookings(bs);const ids=bs.map(x=>x.id);if(!ids.length){setParticipants([]);setOffers([]);setPayments([]);setPlayers({});return}
  const [p,o,pm]=await Promise.all([supabase.from('booking_participants').select('booking_id,display_name,is_holder,status').in('booking_id',ids),supabase.from('waitlist_offers').select('booking_id,status,offered_seats,created_at').eq('match_id',matchId).eq('status','PENDING'),supabase.from('payments').select('booking_id,status,amount_due').in('booking_id',ids)]);
  const err=p.error||o.error||pm.error;if(err)throw err;setParticipants((p.data||[]) as Participant[]);setOffers((o.data||[]) as Offer[]);setPayments((pm.data||[]) as Payment[]);
  const uids=[...new Set(bs.map(x=>x.user_id).filter((x):x is string=>!!x))];if(uids.length){const u=await supabase.from('profiles').select('id,first_name,last_name').in('id',uids);if(u.error)throw u.error;setPlayers(Object.fromEntries((u.data||[]).map(x=>[x.id,`${x.first_name} ${x.last_name}`])))}else setPlayers({});
 }catch(e){setError(e instanceof Error?e.message:String(e))}finally{setBusy(false)}},[matchId]);
 useEffect(()=>{void reload()},[reload]);
 const confirmed=participants.filter(p=>p.status==='ACTIVE').length,waiting=participants.filter(p=>p.status==='WAITLISTED').length;
 const cancel=async(b:Booking)=>{const paid=payments.some(p=>p.booking_id===b.id&&p.status==='PAID');if(paid){setError('Pagamento gia dichiarato: la procedura corrente non consente la cancellazione. Gestire il rimborso prima di modificare la prenotazione.');return}if(!window.confirm(`Annullare tutta la prenotazione di ${b.user_id?players[b.user_id]||'utente':b.player_name||'ospite'} inclusi eventuali amici?`))return;
 setBusy(true);setError('');try{const res=await supabase!.rpc('cancel_booking',{p_booking_id:b.id});if(res.error)throw res.error;await reload();onChanged()}catch(e){setError(e instanceof Error?e.message:String(e))}finally{setBusy(false)}};
 return <section className="admin-editor" style={{marginBlock:18}}><div className="panel-title"><Users size={18}/> Dettaglio iscritti <button className="outline" onClick={onClose}><X size={15}/> Chiudi</button></div>
 <p className="muted">{confirmed} giocatori confermati · {waiting} in lista d'attesa · {offers.length} offerte pendenti</p>
 <button className="outline" disabled={busy} onClick={()=>void reload()}><RefreshCw size={15}/> Aggiorna</button>
 {error&&<p className="warn" role="alert">{error}</p>}
 <h4>Prenotazioni, in ordine di arrivo</h4>{bookings.map((b,i)=>{const ps=participants.filter(p=>p.booking_id===b.id);const paid=payments.find(p=>p.booking_id===b.id);const offer=offers.find(o=>o.booking_id===b.id);return <div className="manage-row" key={b.id}><div><b>{i+1}. {b.user_id?players[b.user_id]||'Utente registrato':b.player_name||'Ospite esterno'}</b><small>{b.source} · {b.status} · {format(b.created_at)}</small>{ps.map((p,j)=><small key={j}>{p.is_holder?'Titolare':'Amico'}: {p.display_name} — {p.status==='ACTIVE'?'Confermato':p.status==='WAITLISTED'?'In attesa':'Annullato'}</small>)}{offer&&<small><Clock3 size={13}/> Offerta pendente: {offer.offered_seats} posti</small>}{paid&&<small>Pagamento: {paid.status} · € {Number(paid.amount_due).toFixed(2)}</small>}{b.status!=='CANCELLED'&&<button className="outline" disabled={busy||paid?.status==='PAID'} title={paid?.status==='PAID'?'Pagamento gia confermato':''} onClick={()=>void cancel(b)}><Trash2 size={14}/> Annulla intero gruppo</button>}</div></div>})}
 {!bookings.length&&<p className="muted">Nessuna prenotazione presente.</p>}
 <p className="muted tiny">La cancellazione utilizza la RPC esistente e aggiorna automaticamente la lista d'attesa. Le offerte parziali sono consultabili; non possono essere accettate dall'ADMIN per conto del giocatore.</p></section>
}
