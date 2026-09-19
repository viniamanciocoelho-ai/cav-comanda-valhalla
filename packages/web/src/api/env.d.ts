declare global {
  namespace NodeJS {
    interface ProcessEnv {
      DATABASE_URL?: string;
      DATABASE_AUTH_TOKEN?: string;
      CAV_ORGANIZACAO_CODIGO?: string;
      CAV_BOOTSTRAP_PIN_GERENCIA?: string;
      CAV_ALLOWED_ORIGINS?: string;
    }
  }
}

export {};
