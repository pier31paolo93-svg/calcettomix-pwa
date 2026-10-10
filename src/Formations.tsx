import {useCallback,useEffect,useState} from 'react';
import {Shield,Check,RefreshCw,Send,Clock3} from 'lucide-react';
import {supabase} from './supabase';
type Participant={id:string;display_name:string;status:string};
type Formation={match_id:string;manager_id:string;team_one_label:string;team_two_label:string;state:string;revision:number};
type TeamRow={participant_id:string;team_no:number};
type Match={id:string;name:string;starts_at:string};
type Person={id:string;first_name:string;last_name:string;enabled:boolean};
export default function Formations({matches,userId,isAdmin}:{matches:Match[];userId:string;isAdmin:boolean}){
 const [matchId,setMatchId]=useState('');const [formation,setFormation]=useState<Formation|null>(null);
 const [participants,setParticipants]=useState<Participant[]>([]);const [team,setTeam]=useState<Record<string,number>>({});
 const [one,setOne]=useState('Maglia');const [two,setTwo]=useState('Senza maglia');
 const [manager,setManager]=useState('');const [people,setPeople]=useState<Person[]>([]);const [busy,setBusy]=useState(false);const [error,setError]=useState('');const [success,setSuccess]=useState('');
 useEffect(()=>{if(matches.length&&!matches.some(m=>m.id===matchId))setMatchId(matches[0].id)},[matches,matchId]);
 const reload=useCallback(async()=>{
  if(!supabase||!matchId)return;setError('');const [f,rows,bs,profiles]=await Promise.all([
   supabase.from('match_formations').select('match_id,manager_id,team_one_label,team_two_label,state,revision').eq('match_id',matchId).maybeSingle(),
   supabase.from('match_formation_players').select('participant_id,team_no').eq('match_id',matchId),
   supabase.from('bookings').select('id').eq('match_id',matchId).neq('status','CANCELLED'),
   isAdmin?supabase.from('profiles').select('id,first_name,last_name,enabled').eq('enabled',true).order('first_name'):{data:[],error:null}
  ]);
  const firstError=f.error||rows.error||bs.error||profiles.error;if(firstError){setError(firstError.message);return}
  const cfg=f.data as Formation|null;setFormation(cfg);setOne(cfg?.team_one_label||'Maglia');setTwo(cfg?.team_two_label||'Senza maglia');setManager(cfg?.manager_id||'');setPeople((profiles.data||[]) as Person[]);
  const ids=(bs.data||[]).map(b=>b.id);if(!ids.length){setParticipants([]);setTeam({});return}
  const res=await supabase.from('booking_participants').select('id,display_name,status').in('booking_id',ids).eq('status','ACTIVE');if(res.error){setError(res.error.message);return}
  setParticipants((res.data||[]) as Participant[]);const mapped:Record<string,number>={};((rows.data||[]) as TeamRow[]).forEach(x=>mapped[x.participant_id]=x.team_no);setTeam(mapped);
 },[matchId,isAdmin]);
 useEffect(()=>{void reload()},[reload]);
 const canEdit=isAdmin||formation?.manager_id===userId;
 const sizes=[1,2].map(n=>Object.values(team).filter(v=>v===n).length);
 async function run(action:'assign'|'save'|'publish'){
  if(!supabase||busy||!matchId)return;setBusy(true);setError('');setSuccess('');try{
   if(action==='save' && (sizes[0]!==5||sizes[1]!==5||participants.length!==10))throw new Error('Occorrono esattamente 10 confermati, divisi 5 contro 5.');
   let result;
   if(action==='assign')result=await supabase.rpc('assign_formation_manager',{p_match_id:matchId,p_manager_id:manager});
   else if(action==='save')result=await supabase.rpc('save_match_formation',{p_match_id:matchId,p_team_one_label:one.trim(),p_team_two_label:two.trim(),p_team_one:Object.keys(team).filter(k=>team[k]===1),p_team_two:Object.keys(team).filter(k=>team[k]===2)});
   else {if(!window.confirm('Pubblicare le formazioni e accodare le notifiche?'))return;result=await supabase.rpc('publish_match_formation',{p_match_id:matchId})}
   if(result.error)throw result.error;setSuccess(action==='assign'?'Responsabile assegnato':action==='save'?'Bozza salvata':'Formazioni pubblicate; notifiche accodate');await reload();
  }catch(e){setError(e instanceof Error?e.message:String(e))}finally{setBusy(false)}
 }
 if(!matches.length)return <section className="panel"><p className="muted">Le formazioni saranno disponibili quando ci saranno partite reali.</p></section>;
 return <section className="panel formations"><div className="panel-title"><Shield size={19}/> Formazioni <button className="mini-primary" onClick={()=>void reload()}><RefreshCw size={15}/> Aggiorna</button></div>
 <label>Partita<select value={matchId} onChange={e=>setMatchId(e.target.value)}>{matches.map(m=><option key={m.id} value={m.id}>{m.name} · {new Date(m.starts_at).toLocaleDateString('it-IT')}</option>)}</select></label>
 {isAdmin&&<div className="formation-manager"><label>Responsabile formazioni<select value={manager} onChange={e=>setManager(e.target.value)}><option value="">Scegli un utente</option>{people.map(p=><option value={p.id} key={p.id}>{p.first_name} {p.last_name}</option>)}</select></label><button className="outline" disabled={!manager||busy} onClick={()=>void run('assign')}>Assegna responsabile</button></div>}
 {formation&&<p className="muted">Stato: <strong>{formation.state==='PUBLISHED'?'Pubblicata':'Bozza'}</strong> · Revisione {formation.revision}</p>}
 {error&&<p role="alert" className="warn">{error}</p>}{success&&<p role="status" className="success-line"><Check size={16}/>{success}</p>}
 {!formation&&!isAdmin&&<p className="muted">Il responsabile non è ancora stato nominato.</p>}
 {(formation?.state==='PUBLISHED'||canEdit)&&<div className="team-grid">{[1,2].map(n=><div className="team-panel" key={n}><label>{n===1?'Squadra 1':'Squadra 2'}<input maxLength={50} readOnly={!canEdit} value={n===1?one:two} onChange={e=>n===1?setOne(e.target.value):setTwo(e.target.value)}/></label><small>{sizes[n-1]}/5 giocatori</small>{participants.filter(p=>team[p.id]===n).map(p=><div className="team-person" key={p.id}>{p.display_name}{canEdit&&<button title="Rimuovi dalla squadra" onClick={()=>setTeam(old=>({...old,[p.id]:0}))}>×</button>}</div>)}</div>)}</div>}
 {canEdit&&<><h3>Giocatori confermati ({participants.length}/10)</h3><p className="muted tiny">Seleziona la squadra per ciascun giocatore. I giocatori in attesa non sono assegnabili.</p>{participants.map(p=><div className="manage-row" key={p.id}><b>{p.display_name}</b><select aria-label={`Squadra di ${p.display_name}`} value={team[p.id]||0} onChange={e=>setTeam(old=>({...old,[p.id]:Number(e.target.value)}))}><option value={0}>Da assegnare</option><option value={1}>{one}</option><option value={2}>{two}</option></select></div>)}<div className="formation-actions"><button className="outline" disabled={busy||!formation} onClick={()=>void run('save')}><Check size={16}/> Salva bozza</button><button className="primary" disabled={busy||!formation||formation.state!=='DRAFT'} onClick={()=>void run('publish')}><Send size={16}/> Pubblica</button></div><p className="muted tiny"><Clock3 size={14}/> La pubblicazione è consentita dal backend dalle 06:00 del giorno della partita. Per aggiornare una formazione già pubblicata, salva una nuova bozza e pubblicala di nuovo.</p></>}
 </section>
}
