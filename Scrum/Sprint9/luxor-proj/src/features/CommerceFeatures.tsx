import { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { API_URL, authHeaders } from '../services/apiClient';
import { PaymentForm } from '../validation/PaymentForm';
import type { PaymentFormState } from '../validation/usePaymentForm';
import { MainLayout } from '../components/layout/MainLayout';

const panel =
  'mx-auto max-w-3xl rounded-xl border border-yellow-700 bg-stone-950 p-6 text-white';

const input =
  'w-full rounded border border-stone-600 bg-stone-900 p-3 text-white';

const button =
  'rounded bg-yellow-500 px-4 py-2 font-bold text-black disabled:opacity-50';

async function jsonResponse(response: Response) {
  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      data.message || 'No se pudo completar la operación.',
    );
  }

  return data;
}

const message = (error: unknown) =>
  error instanceof Error
    ? error.message
    : 'Error de conexión.';

type GoogleSDK = {
  accounts: {
    id: {
      initialize: (options: {
        client_id: string;
        nonce: string;
        auto_select: boolean;
        callback: (response: {
          credential: string;
        }) => void;
      }) => void;

      renderButton: (
        element: HTMLElement,
        options: {
          theme: string;
          size: string;
          text: string;
        },
      ) => void;
    };
  };
};

const getGoogle = () =>
  (window as Window & { google?: GoogleSDK }).google;

let googleScript: Promise<GoogleSDK> | undefined;

function loadGoogle() {
  if (getGoogle()) {
    return Promise.resolve(getGoogle()!);
  }

  if (!googleScript) {
    googleScript = new Promise<GoogleSDK>((resolve, reject) => {
      const script = document.createElement('script');

      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;

      const timer = window.setTimeout(
        () =>
          reject(
            new Error(
              'Google tardó demasiado. Recarga la página.',
            ),
          ),
        15000,
      );

      script.onload = () => {
        clearTimeout(timer);

        const sdk = getGoogle();

        if (sdk) {
          resolve(sdk);
        } else {
          reject(new Error('Google no está disponible.'));
        }
      };

      script.onerror = () => {
        clearTimeout(timer);
        reject(new Error('No se pudo cargar Google.'));
      };

      document.head.appendChild(script);
    });
  }

  return googleScript;
}

export function GoogleAccess({
  linkMode,
  compact = false,
}: {
  linkMode: boolean;
  compact?: boolean;
}) {
  const { login } = useAuth();

  const target = useRef<HTMLDivElement>(null);
  const password = useRef<HTMLInputElement>(null);

  const loginRef = useRef(login);
  loginRef.current = login;

  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);

  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID as
    | string
    | undefined;

  useEffect(() => {
    if (!clientId || !target.current) return;

    let cancelled = false;
    let sending = false;

    const nonce = crypto.randomUUID();
    const element = target.current;

    void loadGoogle()
      .then(sdk => {
        if (cancelled) return;

        sdk.accounts.id.initialize({
          client_id: clientId,
          nonce,
          auto_select: false,

          callback: async ({ credential }) => {
            if (cancelled || sending) return;

            if (linkMode && !password.current?.value) {
              setStatus(
                'Escribe primero tu contraseña actual y vuelve a pulsar Google.',
              );
              return;
            }

            sending = true;
            setBusy(true);
            setStatus('');

            try {
              const response = await fetch(
                `${API_URL}/auth/google${linkMode ? '/link' : ''}`,
                {
                  method: 'POST',

                  headers: {
                    'Content-Type': 'application/json',
                    ...(linkMode ? authHeaders() : {}),
                  },

                  body: JSON.stringify({
                    credential,
                    nonce,

                    ...(linkMode
                      ? {
                          password: password.current?.value,
                        }
                      : {}),
                  }),
                },
              );

              const data = await jsonResponse(response);

              if (cancelled) return;

              if (linkMode) {
                setStatus(
                  'Google quedó vinculado. Ya puedes usarlo para entrar.',
                );

                if (password.current) {
                  password.current.value = '';
                }
              } else {
                loginRef.current(data.user, data.token);
              }
            } catch (error) {
              if (!cancelled) {
                setStatus(message(error));
              }
            } finally {
              sending = false;

              if (!cancelled) {
                setBusy(false);
              }
            }
          },
        });

        sdk.accounts.id.renderButton(element, {
          theme: 'filled_black',
          size: 'large',
          text: 'continue_with',
        });
      })
      .catch(error => {
        if (!cancelled) {
          setStatus(message(error));
        }
      });

    return () => {
      cancelled = true;
      element.replaceChildren();
    };
  }, [clientId, linkMode]);

  if (compact && !linkMode) {
    return (
      <div className="w-full">
        {!clientId && (
          <p className="text-center text-sm text-primary-champagne/50">
            El acceso con Google todavía no está configurado.
          </p>
        )}

        <div
          className="flex w-full justify-center"
          ref={target}
          aria-busy={busy}
        />

        {busy && (
          <p className="mt-3 text-center text-xs text-primary-champagne/50">
            Verificando…
          </p>
        )}

        {status && (
          <p
            role="status"
            className="mt-3 text-center text-sm text-primary-champagne/70"
          >
            {status}
          </p>
        )}
      </div>
    );
  }

  return (
    <section className={panel}>
      <h2 className="mb-3 text-xl">
        {linkMode
          ? 'Vincular mi cuenta con Google'
          : 'Continuar con Google'}
      </h2>

      {linkMode && (
        <label className="mb-4 block">
          Contraseña actual

          <input
            ref={password}
            className={input}
            type="password"
            autoComplete="current-password"
            maxLength={200}
          />
        </label>
      )}

      {!clientId && (
        <p>
          El acceso con Google todavía no está configurado.
        </p>
      )}

      <div
        ref={target}
        aria-busy={busy}
      />

      {busy && <p>Verificando…</p>}

      <p role="status" className="mt-3">
        {status}
      </p>
    </section>
  );
}

type Alerts = {
  threshold: number;

  lowStock: {
    id: string;
    name: string;
    stock: number;
  }[];

  events: {
    id: string;
    order_id: number;
    total: string;
    created_at: string;
  }[];
};

function AdminAlerts() {
  const [data, setData] = useState<Alerts | null>(null);
  const [error, setError] = useState('');
  const [version, setVersion] = useState(0);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;

    const controller = new AbortController();

    async function update() {
      try {
        const next = await fetch(`${API_URL}/admin/alerts`, {
          headers: authHeaders(),
          signal: controller.signal,
        }).then(jsonResponse);

        if (!cancelled) {
          setData(next);
          setError('');
        }
      } catch (e) {
        if (!cancelled) {
          setError(message(e));
        }
      } finally {
        if (!cancelled) {
          timer = setTimeout(update, 15000);
        }
      }
    }

    void update();

    return () => {
      cancelled = true;
      clearTimeout(timer);
      controller.abort();
    };
  }, [version]);

  async function markRead() {
    setBusy(true);

    try {
      await fetch(`${API_URL}/admin/alerts/read`, {
        method: 'POST',

        headers: {
          'Content-Type': 'application/json',
          ...authHeaders(),
        },

        body: JSON.stringify({
          ids: data?.events.map(event => event.id) || [],
        }),
      }).then(jsonResponse);

      setVersion(value => value + 1);
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section
      className={panel}
      aria-label="Avisos del administrador"
    >
      <h2 className="text-xl">
        Avisos del administrador
      </h2>

      <p role="status">
        {error || (!data ? 'Cargando avisos…' : '')}
      </p>

      {data && (
        <>
          <h3 className="mt-4 font-bold">
            Stock bajo: {data.threshold} unidades o menos
          </h3>

          {!data.lowStock.length && (
            <p>No hay alertas de stock.</p>
          )}

          <ul>
            {data.lowStock.map(product => (
              <li key={product.id}>
                <Link
                  className="underline"
                  to={`/admin/editar/${encodeURIComponent(product.id)}`}
                >
                  {product.name}: {product.stock} unidades
                </Link>
              </li>
            ))}
          </ul>

          <h3 className="mt-4 font-bold">
            Pedidos nuevos sin leer
          </h3>

          {!data.events.length && (
            <p>No hay pedidos nuevos.</p>
          )}

          <ul aria-live="polite">
            {data.events.map(event => (
              <li key={event.id}>
                Pedido #{event.order_id}
                {' · '}Q{Number(event.total).toFixed(2)}
                {' · '}
                {new Date(event.created_at).toLocaleString()}
              </li>
            ))}
          </ul>

          {!!data.events.length && (
            <button
              className={`${button} mt-3`}
              disabled={busy}
              onClick={markRead}
            >
              Marcar estos pedidos como leídos
            </button>
          )}
        </>
      )}
    </section>
  );
}

export function CommerceTools() {
  const { user } = useAuth();
  const { pathname } = useLocation();

  const showGoogle =
    !!user && pathname === '/mi-cuenta';

  const showAlerts =
    user?.role === 'ADMIN' && pathname === '/admin';

  if (!showGoogle && !showAlerts) {
    return null;
  }

  return (
    <div className="bg-stone-950 px-4 pb-6 pt-36">
      {showGoogle && (
        <GoogleAccess linkMode={!!user} />
      )}

      {showAlerts && <AdminAlerts />}
    </div>
  );
}

type Quote = {
  id: string;
  name: string;
  price: number;
  stock: number;
  quantity: number;
};

type Receipt = {
  order: {
    id: number;
    total: number;
  };

  payment: {
    brand: string;
    last4: string;
  };
};

export function GuestCheckoutPage() {
  const { cart, clearCart } = useCart();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [quote, setQuote] = useState<Quote[]>([]);
  const [loadedFor, setLoadedFor] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const [receipt, setReceipt] =
    useState<Receipt | null>(null);

  const sending = useRef(false);
  const clearRef = useRef(clearCart);

  clearRef.current = clearCart;

  // Recupera compras confirmadas cuya respuesta se haya perdido.
  useEffect(() => {
    let cancelled = false;

    const key = sessionStorage.getItem(
      'luxor-guest-purchase',
    );

    if (key) {
      void fetch(`${API_URL}/guest-checkout/status`, {
        method: 'POST',

        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': key,
        },

        body: '{}',
      })
        .then(jsonResponse)
        .then(data => {
          if (!cancelled && data.receipt) {
            setReceipt(data.receipt);

            sessionStorage.removeItem(
              'luxor-guest-purchase',
            );

            clearRef.current();
          }
        })
        .catch(e => {
          if (!cancelled) {
            setError(message(e));
          }
        });
    }

    return () => {
      cancelled = true;
    };
  }, []);

  const itemsJson = JSON.stringify(
    cart.map(item => ({
      product_id: item.product.id,
      quantity: item.quantity,
    })),
  );

  // Consulta precios actuales antes de mostrar el resumen.
  useEffect(() => {
    let cancelled = false;

    const items: {
      product_id: string;
      quantity: number;
    }[] = JSON.parse(itemsJson);

    void fetch(`${API_URL}/products`)
      .then(jsonResponse)
      .then((products: Quote[]) => {
        const next = items.map(item => {
          const product = products.find(
            p => p.id === item.product_id,
          );

          if (
            !product ||
            product.stock < item.quantity
          ) {
            throw new Error(
              'Hay productos sin stock. Revisa el carrito.',
            );
          }

          return {
            ...product,
            price: Number(product.price),
            quantity: item.quantity,
          };
        });

        if (!cancelled) {
          setQuote(next);
          setLoadedFor(itemsJson);
          setError('');
        }
      })
      .catch(e => {
        if (!cancelled) {
          setError(message(e));
        }
      });

    return () => {
      cancelled = true;
    };
  }, [itemsJson]);

  const cents = quote.reduce(
    (sum, item) =>
      sum +
      Math.round(item.price * 100) * item.quantity,
    0,
  );

  async function pay(card: PaymentFormState) {
    if (sending.current) return;

    if (
      name.trim().length < 3 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
    ) {
      setError(
        'Completa tu nombre y un correo válido.',
      );

      return;
    }

    sending.current = true;
    setBusy(true);
    setError('');

    try {
      let key = sessionStorage.getItem(
        'luxor-guest-purchase',
      );

      if (!key) {
        key = crypto.randomUUID();

        sessionStorage.setItem(
          'luxor-guest-purchase',
          key,
        );
      }

      const response = await fetch(
        `${API_URL}/guest-checkout`,
        {
          method: 'POST',

          headers: {
            'Content-Type': 'application/json',
            'Idempotency-Key': key,
          },

          body: JSON.stringify({
            guest: {
              name,
              email,
            },

            items: JSON.parse(itemsJson),

            card,

            expectedCents: cents,
          }),
        },
      );

      const result = await jsonResponse(response);

      setReceipt(result);

      sessionStorage.removeItem(
        'luxor-guest-purchase',
      );

      clearCart();
    } catch (e) {
      setError(message(e));
    } finally {
      sending.current = false;
      setBusy(false);
    }
  }

  return (
    <MainLayout>
      <div className="px-4 pb-16 pt-40">
        <section className={panel}>
          {receipt ? (
            <>
              <h1 className="text-2xl">
                Compra registrada
              </h1>

              <p>
                Pedido #{receipt.order.id}
                {' · '}Q{receipt.order.total.toFixed(2)}
              </p>

              <p>
                {receipt.payment.brand}
                {' ···· '}
                {receipt.payment.last4}
              </p>

              <p>
                Guarda este número de pedido.
                No se ha creado una cuenta.
              </p>

              <Link
                className="underline"
                to="/perfumes"
              >
                Seguir comprando
              </Link>
            </>
          ) : (
            <>
              <h1 className="mb-4 text-2xl">
                Comprar como invitado
              </h1>

              <p className="mb-4">
                Pago de prueba. Usa únicamente tarjetas de prueba.
              </p>

              <Link
                className="underline"
                to="/cart"
              >
                Volver al carrito
              </Link>

              <p
                role="alert"
                className="my-3 text-red-300"
              >
                {error}
              </p>

              {!cart.length ? (
                <p>Tu carrito está vacío.</p>
              ) : loadedFor !== itemsJson ? (
                <p>
                  Comprobando precios y stock…
                </p>
              ) : (
                <>
                  <ul>
                    {quote.map(item => (
                      <li key={item.id}>
                        {item.name} × {item.quantity}
                        {' · '}Q
                        {(item.price * item.quantity).toFixed(2)}
                      </li>
                    ))}
                  </ul>

                  <p className="my-4 font-bold">
                    Total: Q{(cents / 100).toFixed(2)}
                  </p>

                  <fieldset
                    disabled={busy}
                    className="space-y-4"
                  >
                    <label className="block">
                      Nombre completo

                      <input
                        className={input}
                        value={name}
                        onChange={e =>
                          setName(e.target.value)
                        }
                        autoComplete="name"
                        maxLength={100}
                      />
                    </label>

                    <label className="block">
                      Correo electrónico

                      <input
                        className={input}
                        type="email"
                        value={email}
                        onChange={e =>
                          setEmail(e.target.value)
                        }
                        autoComplete="email"
                        maxLength={150}
                      />
                    </label>

                    <PaymentForm
                      isProcessing={busy}
                      onValidSubmit={pay}
                    />
                  </fieldset>
                </>
              )}
            </>
          )}
        </section>
      </div>
    </MainLayout>
  );
}