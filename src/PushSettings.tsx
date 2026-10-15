
import { useCallback, useEffect, useState } from 'react';
import {
  BellRing,
  BellOff,
  LoaderCircle
} from 'lucide-react';
import { supabase } from './supabase';

type Props = {
  userId: string;
  showControls?: boolean;
  onError?: (message: string) => void;
};

const VAPID = (
  import.meta.env.VITE_VAPID_PUBLIC_KEY || ''
).trim();

function decodeVapid(
  value: string
): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat(
    (4 - (value.length % 4)) % 4
  );

  const binary = atob(
    (value + padding)
      .replace(/-/g, '+')
      .replace(/_/g, '/')
  );

  const bytes = new Uint8Array(
    new ArrayBuffer(binary.length)
  );

  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }

  return bytes;
}

// Controlla se la sottoscrizione del browser
// è associata alla chiave VAPID attuale.
function sameVapidKey(
  subscription: PushSubscription,
  key: string
): boolean {
  const current =
    subscription.options.applicationServerKey;

  if (!current) return false;

  const expected = decodeVapid(key);
  const actual = new Uint8Array(current);

  return (
    actual.length === expected.length &&
    actual.every(
      (value, index) => value === expected[index]
    )
  );
}

function supported(): boolean {
  return (
    typeof window !== 'undefined' &&
    window.isSecureContext &&
    'Notification' in window &&
    'serviceWorker' in navigator &&
    'PushManager' in window
  );
}

function asText(error: unknown): string {
  return error instanceof Error
    ? error.message
    : String(error);
}

async function registration():
  Promise<ServiceWorkerRegistration> {
  return navigator.serviceWorker.register(
    `${import.meta.env.BASE_URL}sw.js`,
    { scope: import.meta.env.BASE_URL }
  );
}

async function readSubscription() {
  const reg = await registration();

  return {
    reg,
    subscription:
      await reg.pushManager.getSubscription()
  };
}

function isIosBrowser(): boolean {
  return /iPad|iPhone|iPod/.test(
    navigator.userAgent
  );
}

function standalone(): boolean {
  return (
    window.matchMedia(
      '(display-mode: standalone)'
    ).matches ||
    (
      'standalone' in navigator &&
      (
        navigator as Navigator & {
          standalone?: boolean
        }
      ).standalone === true
    )
  );
}

// Rimuove la sottoscrizione del dispositivo.
export async function removePushForCurrentDevice(
  userId: string
): Promise<void> {
  if (!supported() || !supabase) return;

  const { subscription } =
    await readSubscription();

  if (!subscription) return;

  const { error } = await supabase
    .from('push_subscriptions')
    .delete()
    .eq('user_id', userId)
    .eq('endpoint', subscription.endpoint);

  if (error) throw error;

  const removed =
    await subscription.unsubscribe();

  if (!removed) {
    throw new Error(
      'Impossibile disattivare la sottoscrizione push.'
    );
  }
}

export default function PushSettings({
  userId,
  showControls = false,
  onError
}: Props) {
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [ready, setReady] = useState(false);
  const [showPrompt, setShowPrompt] =
    useState(false);

  const available = supported();
  const keyReady = !!VAPID;

  // Verifica che il dispositivo sia iscritto
  // utilizzando la chiave VAPID attuale.
  const refresh = useCallback(async () => {
    if (!available || !supabase) {
      setEnabled(false);
      setReady(true);
      return;
    }

    try {
      const { subscription } =
        await readSubscription();

      if (
        !subscription ||
        !keyReady ||
        !sameVapidKey(subscription, VAPID)
      ) {
        setEnabled(false);
        return;
      }

      const { data, error: dbError } =
        await supabase
          .from('push_subscriptions')
          .select('id')
          .eq('user_id', userId)
          .eq('endpoint', subscription.endpoint)
          .maybeSingle();

      if (dbError) throw dbError;

      setEnabled(!!data);
    } catch (e) {
      setEnabled(false);
      setError(asText(e));
    } finally {
      setReady(true);
    }
  }, [available, keyReady, userId]);

  useEffect(() => {
    setReady(false);
    void refresh();
  }, [refresh]);

  // Mostra la richiesta iniziale di consenso.
  useEffect(() => {
    if (
      !ready ||
      enabled ||
      !available ||
      !keyReady ||
      Notification.permission === 'denied'
    ) {
      return;
    }

    const key =
      `cm-push-onboarding-v1:${userId}`;

    if (window.localStorage.getItem(key)) {
      return;
    }

    if (isIosBrowser() && !standalone()) {
      return;
    }

    setShowPrompt(true);
  }, [
    ready,
    enabled,
    available,
    keyReady,
    userId
  ]);

  function defer(): void {
    window.localStorage.setItem(
      `cm-push-onboarding-v1:${userId}`,
      'dismissed'
    );

    setShowPrompt(false);
  }

  // Attiva oppure rinnova la sottoscrizione.
  async function enable(): Promise<void> {
    if (!supabase || busy) return;

    setBusy(true);
    setError('');

    try {
      if (!available) {
        throw new Error(
          'Questo browser non supporta le notifiche push.'
        );
      }

      if (!keyReady) {
        throw new Error(
          'Chiave VAPID pubblica non configurata nel deploy.'
        );
      }

      const permission =
        await Notification.requestPermission();

      if (permission !== 'granted') {
        throw new Error(
          'Permesso non concesso. Abilita le notifiche dalle impostazioni del browser.'
        );
      }

      const {
        reg,
        subscription: existing
      } = await readSubscription();

      let subscription = existing;

      // Se è stata cambiata la chiave VAPID,
      // elimina la vecchia sottoscrizione.
      if (
        subscription &&
        !sameVapidKey(subscription, VAPID)
      ) {
        const { error: deleteError } =
          await supabase
            .from('push_subscriptions')
            .delete()
            .eq('user_id', userId)
            .eq(
              'endpoint',
              subscription.endpoint
            );

        if (deleteError) {
          throw deleteError;
        }

        const removed =
          await subscription.unsubscribe();

        if (!removed) {
          throw new Error(
            'Impossibile rinnovare la sottoscrizione push.'
          );
        }

        subscription = null;
      }

      // Crea una sottoscrizione con
      // la chiave VAPID aggiornata.
      if (!subscription) {
        subscription =
          await reg.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey:
              decodeVapid(VAPID)
          });
      }

      const json = subscription.toJSON();

      const p256dh = json.keys?.p256dh;
      const authKey = json.keys?.auth;

      if (!p256dh || !authKey) {
        throw new Error(
          'Il browser non ha restituito le chiavi della sottoscrizione.'
        );
      }

      // Salva la sottoscrizione nel database.
      const { error: saveError } =
        await supabase
          .from('push_subscriptions')
          .upsert(
            {
              user_id: userId,
              endpoint: subscription.endpoint,
              p256dh,
              auth_key: authKey
            },
            {
              onConflict: 'endpoint'
            }
          );

      if (saveError) {
        throw saveError;
      }

      setEnabled(true);
      defer();

    } catch (e) {
      const message = asText(e);
      setError(message);
      onError?.(message);
    } finally {
      setBusy(false);
    }
  }

  async function disable(): Promise<void> {
    if (busy) return;

    setBusy(true);
    setError('');

    try {
      await removePushForCurrentDevice(userId);

      setEnabled(false);
      defer();

    } catch (e) {
      const message = asText(e);
      setError(message);
      onError?.(message);
    } finally {
      setBusy(false);
    }
  }

  const blocked =
    available &&
    Notification.permission === 'denied';

  return (
    <>
      {showPrompt && (
        <div
          className="modal-backdrop"
          role="presentation"
        >
          <div
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-label="Attiva notifiche CalcettoMix"
          >
            <BellRing size={34} />

            <h2>
              Non perdere la prossima partita!
            </h2>

            <p className="hint">
              Ricevi un avviso quando si
              aprono le iscrizioni, entri
              nei 10 o vengono pubblicate
              le formazioni, anche con
              l'app chiusa.
            </p>

            <button
              className="primary full"
              onClick={() => void enable()}
              disabled={busy}
            >
              {busy
                ? 'Attivazione...'
                : 'Attiva notifiche'}
            </button>

            <button
              className="outline full"
              style={{ marginTop: 12 }}
              onClick={defer}
              disabled={busy}
            >
              Non adesso
            </button>

            {error && (
              <p
                className="warn"
                role="alert"
              >
                {error}
              </p>
            )}
          </div>
        </div>
      )}

      {showControls && (
        <div className="admin-editor push-settings">
          <div className="panel-title">
            {enabled
              ? <BellRing size={20} />
              : <BellOff size={20} />}
            {' '}Notifiche push
          </div>

          <p className="muted">
            Avvisi anche quando
            CalcettoMix è chiusa.
            Impostazione valida solo
            per questo dispositivo.
          </p>

          <p className="muted tiny">
            Stato:{' '}
            {!ready
              ? 'Controllo...'
              : enabled
                ? 'Attive'
                : blocked
                  ? 'Bloccate dal browser'
                  : 'Non attive'}
          </p>

          {isIosBrowser() &&
            !standalone() && (
              <p className="muted tiny">
                Su iPhone: apri CalcettoMix
                in Safari, scegli
                Condividi → Aggiungi alla
                schermata Home e avvia
                l'app installata.
              </p>
            )}

          {!available && (
            <p className="warn">
              Notifiche push non disponibili
              in questo browser o contesto.
            </p>
          )}

          {available && !keyReady && (
            <p className="warn">
              Configurazione VAPID pubblica
              mancante: chiedi
              all'amministratore di
              completare il deploy.
            </p>
          )}

          {blocked && (
            <p className="warn">
              Notifiche bloccate:
              abilita il permesso per
              CalcettoMix dalle
              impostazioni del browser.
            </p>
          )}

          {error && (
            <p
              className="warn"
              role="alert"
            >
              {error}
            </p>
          )}

          <button
            className={
              enabled ? 'outline' : 'primary'
            }
            disabled={
              !ready ||
              busy ||
              (
                !enabled &&
                (
                  !available ||
                  !keyReady ||
                  blocked
                )
              )
            }
            onClick={() =>
              void (
                enabled
                  ? disable()
                  : enable()
              )
            }
          >
            {busy
              ? <LoaderCircle size={16} />
              : enabled
                ? <BellOff size={16} />
                : <BellRing size={16} />}

            {' '}

            {busy
              ? 'Attendi...'
              : enabled
                ? 'Disattiva notifiche'
                : 'Attiva notifiche'}
          </button>
        </div>
      )}
    </>
  );
}
