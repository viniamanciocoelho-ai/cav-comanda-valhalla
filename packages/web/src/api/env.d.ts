declare global {
  namespace NodeJS {
    interface ProcessEnv {
      DATABASE_URL?: string;
      DATABASE_AUTH_TOKEN?: string;
      CAV_ORGANIZACAO_CODIGO?: string;
      CAV_BOOTSTRAP_PIN_GERENCIA?: string;
      CAV_ALLOWED_ORIGINS?: string;
      CAV_TIMEZONE?: string;
      WEBSITE_URL?: string;
      PORT?: string;
      CAV_BACKUP_DIR?: string;
      CAV_BACKUP_RETENTION?: string;
      S3_ENDPOINT?: string;
      S3_BUCKET?: string;
      S3_REGION?: string;
      S3_ACCESS_KEY_ID?: string;
      S3_SECRET_ACCESS_KEY?: string;
      S3_FORCE_PATH_STYLE?: string;
    }
  }
}

export {};
