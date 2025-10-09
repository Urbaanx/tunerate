import React from 'react';
import { useEffect, useState }  from 'react';
import { useAuth0 } from '@auth0/auth0-react';

const App: React.FC = () => {
  const {
    loginWithRedirect,
    logout,
    isAuthenticated,
    user,
    isLoading,
    getAccessTokenSilently,
    getIdTokenClaims,
  } = useAuth0();

  const audience = import.meta.env.VITE_AUTH0_AUDIENCE;

  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [idTokenRaw, setIdTokenRaw] = useState<string | null>(null);

  useEffect(() => {
    if (!isAuthenticated) {
      setAccessToken(null);
      setIdTokenRaw(null);
      console.log('User not authenticated');
      return;
    }

    (async () => {
      try {
        console.log('User object:', user);
        console.log('Using audience =', audience);

        const token = await getAccessTokenSilently({
          authorizationParams: {
            audience: audience,
            scope: 'openid profile email',
          },
        });
        console.log('Auth0 access token:', token);
        setAccessToken(token ?? null);

        const idTokenClaims = await getIdTokenClaims();
        const raw = idTokenClaims && (idTokenClaims as any).__raw ? (idTokenClaims as any).__raw : null;
        console.log('Auth0 ID token (raw):', raw);
        setIdTokenRaw(raw);
      } catch (err: any) {
        console.error('Failed to obtain Auth0 token:', err);
        if (err?.error) console.error('error:', err.error);
        if (err?.error_description) console.error('error_description:', err.error_description);
        if (err?.message) console.error('message:', err.message);

        console.error('Sprawdź: VITE_audience musi dokładnie zgadzać się z Identifier w Auth0 → APIs oraz Allowed Callback/Origins w aplikacji.');
        setAccessToken(null);
        setIdTokenRaw(null);
      }
    })();
  }, [isAuthenticated, getAccessTokenSilently, getIdTokenClaims, user, audience]);

  const copyToClipboard = async (text: string | null) => {
    if (!text) return;
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      alert('Token skopiowany do schowka');
    } catch {
      alert('Nie udało się skopiować tokenu');
    }
  };

  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-black text-gray-400">
        Loading...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-r from-purple-900 via-indigo-900 to-black text-white flex flex-col">
      {/* HEADER */}
      <header className="flex justify-between items-center px-8 py-6 bg-black bg-opacity-50 shadow-md">
        <h1 className="text-2xl font-bold text-white">🎵 TuneRate</h1>
        {!isAuthenticated ? (
          <button
            onClick={() => loginWithRedirect()}
            className="px-4 py-2 bg-blue-600 rounded-lg hover:bg-blue-700 transition"
          >
            Log in
          </button>
        ) : (
          <div className="flex items-center gap-4">
            <span className="text-gray-200">Witaj, {user?.name ?? user?.email ?? 'użytkowniku'}</span>
            <button
              onClick={() =>
                // auth0-react v2: logoutParams
                logout({ logoutParams: { returnTo: window.location.origin } })
              }
              className="px-4 py-2 bg-red-600 rounded-lg hover:bg-red-700 transition"
            >
              Log out
            </button>
          </div>
        )}
      </header>

      {/* MAIN CONTENT */}
      <main className="flex flex-col items-center justify-center flex-1 px-6 text-center">
        <h2 className="text-6xl md:text-7xl font-extrabold mb-6 drop-shadow-lg">
          Odkrywaj muzykę
        </h2>
        <p className="text-lg md:text-xl text-gray-300 max-w-2xl mb-10">
          Oceniaj, recenzuj i odkrywaj swoje ulubione albumy. Sztuczna inteligencja pomoże Ci znaleźć kolejne hity dopasowane do Twojego gustu.
        </p>

        {!isAuthenticated ? (
          <button
            onClick={() => loginWithRedirect()}
            className="px-10 py-4 bg-gradient-to-r from-blue-500 to-purple-600 text-white font-semibold rounded-xl shadow-lg hover:scale-105 transition transform"
          >
            Zaloguj się, aby zacząć
          </button>
        ) : (
          <div className="w-full max-w-2xl bg-black bg-opacity-40 p-6 rounded-xl shadow-lg">
            <h3 className="text-2xl font-semibold mb-2">Witaj, {user?.name ?? user?.email}</h3>
            <p className="text-sm text-gray-300 mb-4">
              Masz dostęp do zasobów API — poniżej znajduje się token autoryzacyjny (do użytku w nagłówku Authorization: Bearer &lt;token&gt;).
            </p>

            {accessToken ? (
              <div className="flex flex-col gap-2">
                <pre className="break-words text-sm bg-gray-900 bg-opacity-50 p-3 rounded-md text-left max-h-40 overflow-auto">{accessToken}</pre>
                <div className="flex gap-2 justify-center">
                  <button
                    onClick={() => copyToClipboard(accessToken)}
                    className="px-4 py-2 bg-blue-600 rounded-md hover:bg-blue-700 transition"
                  >
                    Kopiuj access token
                  </button>
                  {idTokenRaw && (
                    <button
                      onClick={() => copyToClipboard(idTokenRaw)}
                      className="px-4 py-2 bg-purple-600 rounded-md hover:bg-purple-700 transition"
                    >
                      Kopiuj ID token
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <p className="text-gray-400">
                Trwa pobieranie tokenu... (jeśli token nie pojawi się, sprawdź konfigurację VITE_audience oraz ustawienia aplikacji w Auth0)
              </p>
            )}
          </div>
        )}
      </main>

      {/* FOOTER */}
      <footer className="text-gray-500 text-sm text-center py-6">
        &copy; 2025 TuneRate. Wszystkie prawa zastrzeżone.
      </footer>
    </div>
  );
};

export default App;