import { useCallback, useEffect, useState } from 'react';
import { Clock3, Users, Check, X } from 'lucide-react';
import { supabase } from './supabase';

type Offer = { id:string; booking_id:string; offered_seats:number; expires_at:string; match_id:string; status:string };
type Participant = { id:string; display_name:string; is_holder:boolean; status:string };
type OfferWithPeople = Offer & { people:Participant[] };

export default function WaitlistOffers({userId, onChanged}:{userId:string; onChanged:()=>void}) {
  const [offers,setOffers] = useState<OfferWithPeople[]>([]);
  const [selected,setSelected] = useState<Record<string,string[]>>({});
  const [busy,setBusy] = useState<string|null>(null);
  const [error,setError] = useState('');
  const [now,setNow] = useState(Date.now());

  const reload = useCallback(async()=>{
    if (!supabase) return;
    const {data:bookings,error:bookingError}=await supabase.from('bookings').select('id').eq('user_id',userId).neq('status','CANCELLED');
    if (bookingError) {setError('Impossibile leggere le prenotazioni.');return;}
    const ids=(bookings||[]).map(b=>b.id);
    if(!ids.length){setOffers([]);return;}
    const {data:raw,error:offerError}=await supabase.from('waitlist_offers').select('id,booking_id,match_id,offered_seats,expires_at,status').in('booking_id',ids).eq('status','PENDING').order('created_at',{ascending:true});
    if (offerError){setError('Offerte non disponibili: verifica le policy di lettura.');return;}
    const items:OfferWithPeople[]=[];
    for (const offer of raw||[]){
      const {data:people,error:peopleError}=await supabase.from('booking_participants').select('id,display_name,is_holder,status').eq('booking_id',offer.booking_id).eq('status','WAITLISTED');
      if (peopleError){setError('Impossibile leggere i partecipanti in attesa.');return;}
      items.push({...offer,people:people||[]});
    }
    setOffers(items);
    setSelected(prev=>{
      const next={...prev};
      items.forEach(o=>{
        if(next[o.id])return;
        const holder=o.people.find(p=>p.is_holder);
        next[o.id]=holder?[holder.id]:[];
      });
      return next;
    });
    setError('');
  },[userId]);

  useEffect(()=>{void reload(); const timer=window.setInterval(()=>{setNow(Date.now());void reload()},30000);return()=>window.clearInterval(timer)},[reload]);

  async function respond(offer:OfferWithPeople,accept:boolean){
    if(!supabase || busy)return;
    if(Date.parse(offer.expires_at)<=Date.now()){setError('Offerta scaduta. Aggiorna la lista.');await reload();return;}
    const chosen=selected[offer.id]||[];
    if(accept && (!chosen.length || chosen.length>offer.offered_seats || (offer.people.some(p=>p.is_holder)&&!chosen.includes(offer.people.find(p=>p.is_holder)!.id)))){
      setError(`Seleziona da 1 a ${offer.offered_seats} partecipanti, includendo il titolare.`);return;
    }
    setBusy(offer.id);setError('');
    try{
      const {error:rpcError}=await supabase.rpc('respond_waitlist_offer',{p_offer:offer.id,p_accept:accept,p_selected_participants:accept?chosen:[]});
      if(rpcError)throw rpcError;
      await reload();onChanged();
    }catch(e){setError(e instanceof Error?e.message:'Operazione non riuscita.')}finally{setBusy(null)}
  }

  if(!offers.length && !error)return null;
  return <section className="panel" aria-label="Offerte lista d'attesa">
    <div className="panel-title"><Clock3 size={19}/> Le tue offerte dalla lista d'attesa</div>
    {error&&<p role="alert" style={{color:'#ff8c9a'}}>{error}</p>}
    {offers.map(offer=>{
      const remaining=Math.max(0,Math.ceil((Date.parse(offer.expires_at)-now)/1000));
      const mins=String(Math.floor(remaining/60)).padStart(2,'0');const secs=String(remaining%60).padStart(2,'0');
      const chosen=selected[offer.id]||[];
      return <div key={offer.id} style={{borderTop:'1px solid rgba(255,255,255,.14)',padding:'16px 0'}}>
        <p><Users size={16} style={{verticalAlign:'middle'}}/> <strong>{offer.offered_seats} posti disponibili</strong></p>
        <p><Clock3 size={16} style={{verticalAlign:'middle'}}/> Tempo restante: <strong aria-live="off">{mins}:{secs}</strong></p>
        <p className="muted">Scegli chi confermare. Il titolare deve essere incluso; gli altri restano in attesa.</p>
        {offer.people.map(person=><label key={person.id} style={{display:'flex',alignItems:'center',gap:10,padding:'8px 0'}}>
          <input type="checkbox" checked={chosen.includes(person.id)} disabled={remaining===0 || !!busy || person.is_holder} onChange={e=>setSelected(prev=>({...prev,[offer.id]:e.target.checked?[...chosen,person.id]:chosen.filter(id=>id!==person.id)}))}/>
          <span>{person.display_name}{person.is_holder?' (titolare)':''}</span>
        </label>)}
        <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
          <button className="primary" disabled={remaining===0||!!busy} onClick={()=>void respond(offer,true)}><Check size={16}/> Accetta</button>
          <button className="outline" disabled={remaining===0||!!busy} onClick={()=>void respond(offer,false)}><X size={16}/> Rifiuta</button>
        </div>
      </div>
    })}
  </section>
}
