import {useCallback,useEffect,useState} from 'react';
import {MapPin,Plus,RefreshCw,Save} from 'lucide-react';
import {supabase} from './supabase';
type Venue={id:string;name:string;active:boolean;address:string|null;city:string|null;notes:string|null;usual_cost:number|null};
const blank={name:'',address:'',city:'Bologna',notes:'',usual_cost:'0'};
const errText=(e:unknown)=>e instanceof Error?e.message:String(e);
export default function VenueManager({onChanged}:{onChanged:()=>void}){
 const [items,setItems]=useState<Venue[]>([]);const [editing,setEditing]=useState<string|null>(null);
 const [form,setForm]=useState(blank);const [busy,setBusy]=useState(false);const [error,setError]=useState('');const [info,setInfo]=useState('');
 const load=useCallback(async()=>{if(!supabase)return;const r=await supabase.from('venues').select('id,name,active,address,city,notes,usual_cost').order('name');if(r.error)setError(r.error.message);else{setError('');setItems((r.data||[]) as Venue[])}},[]);
 useEffect(()=>{void load()},[load]);
 const choose=(v:Venue)=>{setEditing(v.id);setForm({name:v.name,address:v.address||'',city:v.city||'',notes:v.notes||'',usual_cost:String(v.usual_cost||0)});};
 const change=(key:keyof typeof blank,val:string)=>setForm(f=>({...f,[key]:val}));
 const save=async()=>{if(!supabase||busy)return;setError('');setInfo('');if(!form.name.trim()){setError('Inserisci il nome del campo');return}const cost=Number(form.usual_cost);if(!Number.isFinite(cost)||cost<0){setError('Costo non valido');return}setBusy(true);try{
 const args={p_name:form.name.trim(),p_address:form.address.trim()||null,p_city:form.city.trim()||null,p_notes:form.notes.trim()||null,p_usual_cost:cost};
 const r=editing?await supabase.rpc('admin_update_venue',{p_venue_id:editing,...args,p_active:null}):await supabase.rpc('admin_create_venue',args);
 if(r.error)throw r.error;setInfo(editing?'Campo aggiornato':'Campo creato');setEditing(null);setForm(blank);await load();onChanged();
 }catch(e){setError(errText(e))}finally{setBusy(false)}};
 const toggle=async(v:Venue)=>{if(!supabase||busy)return;if(!window.confirm(`${v.active?'Disattivare':'Riattivare'} ${v.name}? Le partite esistenti manterranno il campo.`))return;setBusy(true);setError('');try{const r=await supabase.rpc('admin_update_venue',{p_venue_id:v.id,p_name:v.name,p_address:v.address,p_city:v.city,p_notes:v.notes,p_usual_cost:v.usual_cost||0,p_active:!v.active});if(r.error)throw r.error;await load();onChanged()}catch(e){setError(errText(e))}finally{setBusy(false)}};
 const suggested=Number(form.usual_cost)/10;
 return <div className="venue-management"><h3><MapPin size={18}/> Censimento campi sportivi</h3><p className="muted tiny">I campi disattivati non possono essere scelti per nuove partite. Il costo abituale propone la quota per 10 giocatori.</p>
 {error&&<p className="warn" role="alert">{error}</p>}{info&&<p className="success-line" role="status">{info}</p>}
 <div className="admin-editor"><h4>{editing?'Modifica campo':'Nuovo campo'}</h4><div className="admin-form-grid">
 <label>Nome campo *<input value={form.name} maxLength={100} onChange={e=>change('name',e.target.value)}/></label>
 <label>Indirizzo<input value={form.address} onChange={e=>change('address',e.target.value)}/></label>
 <label>Città<input value={form.city} onChange={e=>change('city',e.target.value)}/></label>
 <label>Costo abituale (€)<input type="number" min="0" step="0.01" value={form.usual_cost} onChange={e=>change('usual_cost',e.target.value)}/></label>
 <label>Note<textarea value={form.notes} rows={2} onChange={e=>change('notes',e.target.value)}/></label>
 </div><p className="muted">Quota suggerita: <b>€ {Number.isFinite(suggested)?suggested.toFixed(2):'0.00'} per giocatore</b> (10 posti)</p>
 <div className="admin-row-actions"><button className="primary" disabled={busy} onClick={()=>void save()}><Save size={16}/> {editing?'Salva campo':'Crea campo'}</button>{editing&&<button className="outline" onClick={()=>{setEditing(null);setForm(blank)}}>Annulla</button>}</div></div>
 <div className="panel-title">Campi censiti <button className="outline" onClick={()=>void load()} disabled={busy}><RefreshCw size={15}/> Aggiorna</button></div>
 {items.map(v=><div className="manage-row" key={v.id}><div><b>{v.name}</b><small>{[v.address,v.city].filter(Boolean).join(', ')||'Indirizzo non specificato'}</small><small>{v.active?'Attivo':'Disattivato'} · € {Number(v.usual_cost||0).toFixed(2)} per campo · quota suggerita € {(Number(v.usual_cost||0)/10).toFixed(2)}</small><div className="admin-row-actions"><button className="outline" disabled={busy} onClick={()=>choose(v)}>Modifica</button><button className="outline" disabled={busy} onClick={()=>void toggle(v)}>{v.active?'Disattiva':'Riattiva'}</button></div></div></div>)}
 {!items.length&&<p className="muted">Non ci sono campi censiti.</p>}</div>;
}
