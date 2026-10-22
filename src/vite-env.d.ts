/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL?: string;
  readonly VITE_PLAUSIBLE_DOMAIN?: string;
  readonly VITE_SITE_URL?: string;
}
interface ImportMeta {
  readonly env: ImportMetaEnv;
}
