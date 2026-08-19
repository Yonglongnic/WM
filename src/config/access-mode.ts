/**
 * Access mode for the self-hosted local Docker build.
 *
 * The hosted deployment keeps its normal account and subscription behavior.
 * The local stack is intentionally public: it is only enabled when the UI is
 * served from localhost, while the backend has its own explicit Docker env
 * switch (`WM_LOCAL_PUBLIC_ACCESS`).
 */
const browserHostname =
  typeof window !== 'undefined' && typeof window.location?.hostname === 'string'
    ? window.location.hostname
    : '';

export const LOCAL_PUBLIC_ACCESS =
  browserHostname === 'localhost'
  || browserHostname === '127.0.0.1'
  // Vite variant hosts are served as e.g. finance.localhost during local
  // browser QA. They are still loopback-only and must receive the same local
  // public/free-source behavior as the root localhost host.
  || browserHostname.endsWith('.localhost');
