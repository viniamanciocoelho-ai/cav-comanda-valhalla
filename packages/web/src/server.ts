// Deploy-compat entrypoint: valida ambiente e banco antes do servidor protegido.
import { validarConfiguracaoAmbiente } from "./api/lib/configuracao";

validarConfiguracaoAmbiente();
const { garantirBanco } = await import("./api/database/bootstrap");
await garantirBanco();
await import("./__server");
