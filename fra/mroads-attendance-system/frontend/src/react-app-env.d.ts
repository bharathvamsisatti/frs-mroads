declare module '*.png';
declare module '*.svg';
declare module '*.jpeg';
declare module '*.jpg';

interface ImportMetaEnv {
  VITE_LOCAL_BACKEND_URL: string;
  VITE_DEV_SERVER_URL: string;
  readonly VITE_API_BASE_URL: string;
  readonly VITE_WS_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
