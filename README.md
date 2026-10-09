# CalcettoMix PWA — versione 0.1

Frontend React + TypeScript + Vite, installabile come PWA. Include dashboard, calendario, schede partite, prenotazione demo, lista d'attesa demo, pagamenti demo, profilo, avatar Storage e backoffice dimostrativo.

## Avvio locale

Serve Node.js 22+. Dal terminale: `npm install` quindi `npm run dev`.

## Modalità demo

Senza `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY`, l'app usa partite e utenti dimostrativi in memoria. Le modifiche demo spariscono ricaricando la pagina.

## Supabase

Copia `.env.example` in `.env.local` e imposta il Project URL esatto e la chiave **publishable**. Non inserire mai `service_role`, credenziali Vault o chiavi VAPID private nel frontend. La connessione reale funzionerà soltanto quando sarà risolto il DNS del progetto (ticket SU-500736).

Sono integrati: Auth login/registrazione; lettura profilo e partite; caricamento avatar con RPC `update_my_avatar`; prenotazione con `create_booking`; annullamento con `cancel_booking`. Alcune funzioni richiedono una verifica dei nomi degli argomenti SQL e delle policy prima dell'uso reale. Il resto (amministrazione CRUD, pagamenti, sottoscrizioni push, offerte parziali di waitlist, contatori ufficiali) rimane esplicitamente da integrare e collaudare. Non presentare questa versione come un sistema di prenotazione in produzione.

## GitHub Pages

La workflow `.github/workflows/deploy.yml` pubblica su GitHub Pages quando esegui push sul branch `main`. In Settings → Pages seleziona **GitHub Actions**. Per il collegamento reale imposta le repository **Variables** `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY` (quest'ultima è una chiave pubblica client). Non utilizzare secrets server nel bundle.

## Da verificare prima del rilascio pubblico

- Confermare le firme RPC con `pg_get_function_arguments`, in particolare `create_booking` e `cancel_booking`.
- Leggere da DB partecipanti con join validi, gestire offerte parziali e pagamenti; confrontare risultati e autorizzazioni RLS.
- Definire e testare archiviazione/retention delle quote, correggere claim job cancellati.
- Ripristinare DNS pubblico del progetto; riattivare Cron solo dopo i test di pg_net.
- Collegare VAPID pubblico, push subscription e permessi notifiche; verificare su Android e iOS.
- Generare icone raster PNG 192/512 per migliore installabilità multipiattaforma; il logo attuale è un SVG **provvisorio**, sostituibile con quello ufficiale.
- La funzionalità `create_booking` del frontend presume parametro `p_guest_names`: verificare firma SQL.
