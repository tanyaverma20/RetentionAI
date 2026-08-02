import React, { useEffect, useState } from 'react';
import api from '../services/api';

/**
 * Renders an image from an endpoint that requires the Authorization header.
 *
 * A plain <img src="/api/..."> cannot carry one — the browser issues that
 * request without any header the app controls — so every protected image URL
 * comes back 401 and the element silently renders at 0x0. The SHAP plot
 * endpoints are exactly this case: they returned valid PNGs to an
 * authenticated client while the page showed empty panels.
 *
 * So the bytes are fetched through the shared axios instance (which attaches
 * the bearer token via its request interceptor) and handed to the <img> as an
 * object URL instead.
 */
export default function AuthenticatedImage({ path, alt, className, fallbackLabel = 'Plot unavailable' }) {
  const [objectUrl, setObjectUrl] = useState(null);
  const [status, setStatus] = useState('loading'); // loading | ready | error

  useEffect(() => {
    let cancelled = false;
    let created = null;

    setStatus('loading');
    setObjectUrl(null);

    api
      .get(path, { responseType: 'blob' })
      .then((response) => {
        if (cancelled) return;
        created = URL.createObjectURL(response.data);
        setObjectUrl(created);
        setStatus('ready');
      })
      .catch(() => {
        if (!cancelled) setStatus('error');
      });

    return () => {
      cancelled = true;
      // Object URLs pin their blob in memory until explicitly revoked; these
      // plots are ~50-90 KB each and the dependence plot is re-fetched on
      // every feature change, so leaking them adds up over a session.
      if (created) URL.revokeObjectURL(created);
    };
  }, [path]);

  if (status === 'loading') {
    return (
      <div className="w-full h-64 flex items-center justify-center text-slate-400 text-sm animate-pulse">
        Generating plot…
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="w-full h-64 flex items-center justify-center text-slate-400 text-sm">
        {fallbackLabel}
      </div>
    );
  }

  return <img src={objectUrl} alt={alt} className={className} />;
}
