import {useCallback,useEffect,useState} from 'react';
import {RefreshCw,Users,CalendarDays,MapPin,Shield,Plus,Trash2,UserPlus} from 'lucide-react';
import {supabase} from './supabase';
import AdminMatchDetail from './AdminMatchDetail';

type Venue={id:string;name:string;active:boolean};
type Player={id:string;first_name:string;last_name:string;email:string;role:string;enabled:boolean};
type MatchRow={id:string;starts_at:string;ends_at:string;publish_at:string;status:string;capacity:number;price_per_person:number;payment_mode:string;collector_id:string|null;notes:string|null;venue_id:string|null};
type GameForm={key:number;date:string;start:string;end:string;venue_id:string;capacity:string;price:string;payment_mode:string;collector_id:string;notes:string};
const dateLocal=(d:Date)=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
const localStamp=(value:string)=>{const d=new Date(value);if(!value||Number.isNaN(d.getTime()))throw new Error('Data e ora non valide');return d.toISOString()};
const display=(value:string)=>new Date(value).toLocaleString('it-IT',{dateStyle:'medium',timeStyle:'short'});
const newGame=(key:number):GameForm=>({key,date:'',start:'20:30',end:'22:00',venue_id:'',capacity:'10',price:'7',payment_mode:'INDIVIDUAL',collector_id:'',notes:''});
const errorText=(e:unknown)=>e instanceof Error?e.message:String(e);

export default function AdminPanel({onRefresh}:{onRefresh:()=>void}){
 const [view,setView]=useState<'matches'|'players'|'venues'>('matches');
 const [players,setPlayers]=useState<Player[]>([]);const [venues,setVenues]=useState<Venue[]>([]);const [matches,setMatches]=useState<MatchRow[]>([]);
 const [counts,setCounts]=useState<Record<string,number>>({});const [busy,setBusy]=useState(false);const [error,setError]=useState('');const [info,setInfo]=useState('');
 const [games,setGames]=useState<GameForm[]>([newGame(1)]);const [publishAt,setPublishAt]=useState('');const [bookingMatch,setBookingMatch]=useState('');
 const [bookingKind,setBookingKind]=useState<'registered'|'external'>('registered');const [bookingUser,setBookingUser]=useState('');const [externalName,setExternalName]=useState('');const [guests,setGuests]=useState('');
 const [managerMatch,setManagerMatch]=useState('');const [managerUser,setManagerUser]=useState('');const [editingMatch,setEditingMatch]=useState('');const [search,setSearch]=useState('');
 const [nextKey,setNextKey]=useState(2);const [detailId,setDetailId]=useState('');
 const refresh=useCallback(async()=>{
  if(!supabase)return;setBusy(true);setError('');try{
   const [p,v,m]=await Promise.all([
    supabase.from('profiles').select('id,first_name,last_name,email,role,enabled').order('first_name').limit(500),
    supabase.from('venues').select('id,name,active').order('name'),
    supabase.from('matches').select('id,starts_at,ends_at,publish_at,status,capacity,price_per_person,payment_mode,collector_id,notes,venue_id').order('starts_at',{ascending:false}).limit(100)]);
   const err=p.error||v.error||m.error;if(err)throw err;
   setPlayers((p.data||[]) as Player[]);setVenues((v.data||[]) as Venue[]);setMatches((m.data||[]) as MatchRow[]);
   const ids=(m.data||[]).map(x=>x.id);const next:Record<string,number>={};
   if(ids.length){const b=await supabase.from('bookings').select('id,match_id').in('match_id',ids).neq('status','CANCELLED');if(b.error)throw b.error;
    if(b.data?.length){const bp=await supabase.from('booking_participants').select('booking_id,status').in('booking_id',b.data.map(x=>x.id)).eq('status','ACTIVE');if(bp.error)throw bp.error;
     const map=new Map(b.data.map(x=>[x.id,x.match_id]));for(const row of bp.data||[]){const id=map.get(row.booking_id);if(id)next[id]=(next[id]||0)+1;}}}
   setCounts(next);
  }catch(e){setError(errorText(e))}finally{setBusy(false)}
 },[]);
 useEffect(()=>{void refresh()},[refresh]);
 const reload=async()=>{await refresh();onRefresh()};
 const venueName=(id:string|null)=>venues.find(v=>v.id===id)?.name||'Campo non assegnato';
 const updateGame=(key:number,patch:Partial<GameForm>)=>setGames(old=>old.map(g=>g.key===key?{...g,...patch}:g));
 const addGame=()=>{setGames(old=>[...old,newGame(nextKey)]);setNextKey(x=>x+1)};
 const save=async(task:()=>Promise<void>,description:string)=>{if(!supabase||busy)return;setBusy(true);setError('');setInfo('');try{await task();setInfo(description);await reload()}catch(e){setError(errorText(e))}finally{setBusy(false)}};
 const argsFor=(g:GameForm)=>{
  if(!g.date||!g.venue_id)throw new Error('Imposta data e campo per ogni partita');
  const starts_at=localStamp(`${g.date}T${g.start}`),ends_at=localStamp(`${g.date}T${g.end}`);
  if(new Date(ends_at)<=new Date(starts_at))throw new Error('La fine deve essere successiva all’inizio');
  const capacity=Number(g.capacity),price_per_person=Number(g.price);
  if(!Number.isInteger(capacity)||capacity<1||capacity>100)throw new Error('Capienza ammessa: 1–100');
  if(!Number.isFinite(price_per_person)||price_per_person<0)throw new Error('Quota non valida');
  if(g.payment_mode==='COLLECTOR'&&!g.collector_id)throw new Error('Scegli chi raccoglie i pagamenti');
  return {venue_id:g.venue_id,starts_at,ends_at,capacity,price_per_person,payment_mode:g.payment_mode,collector_id:g.payment_mode==='COLLECTOR'?g.collector_id:null,notes:g.notes.trim()||null};
 };
 const createWeekly=()=>void save(async()=>{
  if(!publishAt)throw new Error('Imposta la pubblicazione delle partite');
  const date=localStamp(publishAt);if(new Date(date)<=new Date())throw new Error('La pubblicazione deve essere futura');
  if(games.length<1||games.length>14)throw new Error('Inserisci da 1 a 14 partite');
  const payload=games.map(argsFor);
  if(payload.some(g=>new Date(g.starts_at)<=new Date(date)))throw new Error('Le partite devono iniziare dopo la pubblicazione');
  if(!window.confirm(`Creare ${payload.length} partit${payload.length===1?'a':'e'} con pubblicazione ${display(date)}?`))throw new Error('Operazione non confermata');
  const {error}=await supabase!.rpc('admin_create_weekly_matches',{p_publish_at:date,p_matches:payload});if(error)throw error;
  setGames([newGame(1)]);setNextKey(2);
 },'Partite programmate correttamente. Potrai inserire gli iscritti prima della pubblicazione.');
 const createBooking=()=>void save(async()=>{
  if(!bookingMatch)throw new Error('Scegli la partita');
  const names=guests.split('\n').map(x=>x.trim()).filter(Boolean);
  if(names.length>3)throw new Error('Massimo 3 amici per prenotazione');
  const args=bookingKind==='registered'?{p_match_id:bookingMatch,p_user_id:bookingUser,p_guest_names:names}:{p_match_id:bookingMatch,p_player_name:externalName.trim(),p_guest_names:names};
  if(bookingKind==='registered'&&!bookingUser)throw new Error('Scegli un giocatore');
  if(bookingKind==='external'&&externalName.trim().length<2)throw new Error('Inserisci il nome del giocatore esterno');
  const {error}=await supabase!.rpc(bookingKind==='registered'?'admin_book_user':'admin_book_external',args);if(error)throw error;
  setGuests('');setExternalName('');
 },'Prenotazione inserita. Il sistema ha aggiornato posti e lista d’attesa.');
 const changeUser=(p:Player,kind:'role'|'enabled')=>{
  const role=kind==='role'?(p.role==='ADMIN'?'USER':'ADMIN'):null;
  const enabled=kind==='enabled'?!p.enabled:null;
  const question=kind==='role'?`Cambiare il ruolo di ${p.first_name} ${p.last_name} in ${role}?`:enabled?`Riabilitare ${p.first_name} ${p.last_name}?`:`Bannare ${p.first_name} ${p.last_name}? Verranno annullate TUTTE le prenotazioni future e quelle degli amici associati, liberando i posti. I pagamenti già dichiarati resteranno a storico.`;
  if(!window.confirm(question))return;
  void save(async()=>{const {error}=await supabase!.rpc('admin_manage_user',{p_user_id:p.id,p_role:role,p_enabled:enabled});if(error)throw error},kind==='role'?'Ruolo aggiornato':enabled?'Account riattivato':'Utente bannato e prenotazioni future annullate');
 };
 const assignManager=()=>void save(async()=>{if(!managerMatch||!managerUser)throw new Error('Seleziona partita e responsabile');const {error}=await supabase!.rpc('assign_formation_manager',{p_match_id:managerMatch,p_manager_id:managerUser});if(error)throw error},'Responsabile delle formazioni assegnato');
 const cancelMatch=(m:MatchRow)=>{const reason=window.prompt(`Motivo dell'annullamento della partita del ${display(m.starts_at)}:`);if(reason===null)return;if(!window.confirm('Confermi l’annullamento? Tutte le iscrizioni saranno cancellate.'))return;void save(async()=>{const {error}=await supabase!.rpc('admin_cancel_match',{p_match_id:m.id,p_reason:reason});if(error)throw error},'Partita annullata e notifiche accodate')};
 const edit=(m:MatchRow)=>{const local=(iso:string)=>{const d=new Date(iso);return `${dateLocal(d)}T${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`};setEditingMatch(m.id);setPublishAt(local(m.publish_at));setGames([{...newGame(1),date:dateLocal(new Date(m.starts_at)),start:local(m.starts_at).slice(11),end:local(m.ends_at).slice(11),venue_id:m.venue_id||'',capacity:String(m.capacity),price:String(m.price_per_person),payment_mode:m.payment_mode,collector_id:m.collector_id||'',notes:m.notes||''}]);window.scrollTo({top:0,behavior:'smooth'})};
 const updateMatch=()=>void save(async()=>{const g=argsFor(games[0]);const {error}=await supabase!.rpc('update_match',{p_match_id:editingMatch,p_venue_id:g.venue_id,p_starts_at:g.starts_at,p_ends_at:g.ends_at,p_publish_at:localStamp(publishAt),p_capacity:g.capacity,p_price:g.price_per_person,p_payment_mode:g.payment_mode,p_collector_id:g.collector_id,p_notes:g.notes});if(error)throw error;setEditingMatch('');setGames([newGame(1)]);},'Partita modificata');
 const activeMatches=matches.filter(m=>m.status!=='CANCELLED'&&m.status!=='COMPLETED'&&new Date(m.starts_at)>new Date());
 const validPlayers=players.filter(p=>p.enabled);const filteredPlayers=players.filter(p=>`${p.first_name} ${p.last_name} ${p.email}`.toLowerCase().includes(search.toLowerCase()));
 return <section className="panel admin-real"><div className="panel-title"><Shield size={20}/> Backoffice v0.6 <button className="mini-primary" disabled={busy} onClick={()=>void reload()}><RefreshCw size={15}/> Aggiorna</button></div>
 <div className="admin-tabs"><button className={view==='matches'?'active':''} onClick={()=>setView('matches')}><CalendarDays size={16}/> Partite</button><button className={view==='players'?'active':''} onClick={()=>setView('players')}><Users size={16}/> Utenti</button><button className={view==='venues'?'active':''} onClick={()=>setView('venues')}><MapPin size={16}/> Campi</button></div>
 {error&&<p className="warn" role="alert">{error}</p>}{info&&<p className="success-line" role="status">{info}</p>}
 {view==='matches'&&<>
  <h3>{editingMatch?'Modifica partita':'Programma le partite della settimana'}</h3><p className="muted tiny">Le date e gli orari sono locali (Italia). Scegli un'unica pubblicazione per tutte le partite; puoi riservare posti prima dell'apertura.</p>
  <div className="admin-form-grid"><label>Pubblicazione iscrizioni (data e ora)<input type="datetime-local" value={publishAt} onChange={e=>setPublishAt(e.target.value)}/></label></div>
  {games.map((g,i)=><div className="admin-editor" key={g.key}><div className="panel-title">Partita {i+1}{!editingMatch&&games.length>1&&<button className="outline" onClick={()=>setGames(old=>old.filter(x=>x.key!==g.key))}><Trash2 size={15}/> Elimina</button>}</div>
   <div className="admin-form-grid"><label>Giorno<input type="date" value={g.date} onChange={e=>updateGame(g.key,{date:e.target.value})}/></label><label>Campo<select value={g.venue_id} onChange={e=>updateGame(g.key,{venue_id:e.target.value})}><option value="">Seleziona campo</option>{venues.filter(v=>v.active).map(v=><option value={v.id} key={v.id}>{v.name}</option>)}</select></label><label>Inizio<input type="time" value={g.start} onChange={e=>updateGame(g.key,{start:e.target.value})}/></label><label>Fine<input type="time" value={g.end} onChange={e=>updateGame(g.key,{end:e.target.value})}/></label><label>Posti<input type="number" min="1" max="100" value={g.capacity} onChange={e=>updateGame(g.key,{capacity:e.target.value})}/></label><label>Quota (€)<input type="number" min="0" step="0.5" value={g.price} onChange={e=>updateGame(g.key,{price:e.target.value})}/></label><label>Modalità pagamento<select value={g.payment_mode} onChange={e=>updateGame(g.key,{payment_mode:e.target.value})}><option value="INDIVIDUAL">Individuale</option><option value="COLLECTOR">Responsabile incasso</option></select></label>{g.payment_mode==='COLLECTOR'&&<label>Chi raccoglie i soldi<select value={g.collector_id} onChange={e=>updateGame(g.key,{collector_id:e.target.value})}><option value="">Seleziona</option>{validPlayers.map(p=><option key={p.id} value={p.id}>{p.first_name} {p.last_name}</option>)}</select></label>}<label>Nome / note<input value={g.notes} onChange={e=>updateGame(g.key,{notes:e.target.value})} placeholder="Es. Calcetto del lunedì"/></label></div>
  </div>)}
  <div className="formation-actions">{!editingMatch&&games.length<14&&<button className="outline" disabled={busy} onClick={addGame}><Plus size={16}/> Aggiungi partita</button>}<button className="primary" disabled={busy} onClick={editingMatch?updateMatch:createWeekly}>{editingMatch?'Salva modifiche':`Programma ${games.length} partit${games.length===1?'a':'e'}`}</button>{editingMatch&&<button className="outline" onClick={()=>{setEditingMatch('');setGames([newGame(1)])}}>Annulla modifica</button>}</div>
  <h3>Inserimento anticipato di giocatori</h3><div className="admin-form-grid"><label>Partita<select value={bookingMatch} onChange={e=>setBookingMatch(e.target.value)}><option value="">Seleziona partita</option>{activeMatches.map(m=><option key={m.id} value={m.id}>{display(m.starts_at)} · {venueName(m.venue_id)}</option>)}</select></label><label>Tipo prenotazione<select value={bookingKind} onChange={e=>setBookingKind(e.target.value as 'registered'|'external')}><option value="registered">Utente registrato</option><option value="external">Persona esterna</option></select></label>{bookingKind==='registered'?<label>Utente<select value={bookingUser} onChange={e=>setBookingUser(e.target.value)}><option value="">Seleziona giocatore</option>{validPlayers.map(p=><option key={p.id} value={p.id}>{p.first_name} {p.last_name}</option>)}</select></label>:<label>Nome e cognome esterno<input value={externalName} onChange={e=>setExternalName(e.target.value)} placeholder="Nome Cognome"/></label>}<label>Amici (uno per riga, max 3)<textarea rows={3} value={guests} onChange={e=>setGuests(e.target.value)} placeholder={'Mario Rossi\nLuigi Verdi'}/></label></div><button className="outline" disabled={busy} onClick={createBooking}><UserPlus size={16}/> Inserisci prenotazione</button>
  <h3>Responsabile delle formazioni</h3><div className="admin-form-grid"><label>Partita<select value={managerMatch} onChange={e=>setManagerMatch(e.target.value)}><option value="">Seleziona partita</option>{activeMatches.map(m=><option key={m.id} value={m.id}>{display(m.starts_at)} · {venueName(m.venue_id)}</option>)}</select></label><label>Responsabile<select value={managerUser} onChange={e=>setManagerUser(e.target.value)}><option value="">Seleziona utente</option>{validPlayers.map(p=><option key={p.id} value={p.id}>{p.first_name} {p.last_name}</option>)}</select></label></div><button className="outline" disabled={busy} onClick={assignManager}>Assegna responsabile</button>
  <h3>Partite registrate</h3>{detailId&&<AdminMatchDetail matchId={detailId} onClose={()=>setDetailId('')} onChanged={()=>void reload()}/>} {matches.map(m=><div className="manage-row" key={m.id}><div><b>{m.notes||'Partita di calcetto'}</b><small>{display(m.starts_at)} · {venueName(m.venue_id)}</small><small>{m.status} · Pubblicazione {display(m.publish_at)} · € {Number(m.price_per_person).toFixed(2)}</small><small>{counts[m.id]||0}/{m.capacity} iscritti</small><button className="outline" onClick={()=>setDetailId(m.id)}>Apri iscritti e coda</button>{activeMatches.some(x=>x.id===m.id)&&<div className="admin-row-actions"><button className="outline" onClick={()=>setDetailId(m.id)}>Dettaglio / Iscritti</button><button className="outline" disabled={busy} onClick={()=>edit(m)}>Modifica</button><button className="outline" disabled={busy} onClick={()=>cancelMatch(m)}>Annulla partita</button></div>}</div></div>)}{!matches.length&&<p className="muted">Nessuna partita trovata.</p>}
 </>}
 {view==='players'&&<><p className="muted tiny">La disabilitazione annulla automaticamente le prenotazioni future dell'utente e dei suoi ospiti. I pagamenti già dichiarati restano registrati.</p><input placeholder="Cerca nome o email" aria-label="Cerca utente" value={search} onChange={e=>setSearch(e.target.value)}/>{filteredPlayers.map(p=><div className="manage-row" key={p.id}><div><b>{p.first_name} {p.last_name}</b><small>{p.email}</small><small>{p.role} · {p.enabled?'Abilitato':'Bannato'}</small><div className="admin-row-actions"><button className="outline" disabled={busy} onClick={()=>changeUser(p,'role')}>{p.role==='ADMIN'?'Revoca ADMIN':'Rendi ADMIN'}</button><button className="outline" disabled={busy} onClick={()=>changeUser(p,'enabled')}>{p.enabled?'Banna':'Riabilita'}</button></div></div></div>)}{!filteredPlayers.length&&<p className="muted">Nessun utente trovato.</p>}</>}
 {view==='venues'&&<><p className="muted tiny">Campi esistenti. La creazione e modifica dei campi richiederanno una RPC dedicata: per sicurezza non scriviamo direttamente nella tabella.</p>{venues.map(v=><div className="manage-row" key={v.id}><div><b>{v.name}</b><small>{v.active?'Attivo':'Disattivato'}</small></div><MapPin size={17}/></div>)}{!venues.length&&<p className="muted">Nessun campo disponibile.</p>}</>}
 </section>;
}
