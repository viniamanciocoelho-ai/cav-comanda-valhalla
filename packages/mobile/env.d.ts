declare namespace NodeJS {
  interface ProcessEnv {
    NODE_ENV?: string;
    DATABASE_URL?: string;
    DATABASE_AUTH_TOKEN?: string;
    CAV_ORGANIZACAO_CODIGO?: string;
    CAV_BOOTSTRAP_PIN_GERENCIA?: string;
    CAV_BOOTSTRAP_PIN_GARCOM?: string;
    CAV_BOOTSTRAP_PIN_PRODUCAO?: string;
    CAV_BOOTSTRAP_PIN_CAIXA?: string;
    CAV_DEMO_MODE?: string;
    CAV_ALLOWED_ORIGINS?: string;
  }
}
