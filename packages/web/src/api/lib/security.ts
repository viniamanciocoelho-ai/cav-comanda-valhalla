const encoder = new TextEncoder();
const PINS_FRACOS = new Set([
  "0000",
  "1111",
  "2222",
  "3333",
  "4444",
  "5555",
  "6666",
  "7777",
  "8888",
  "9999",
  "0123",
  "1234",
  "2345",
  "3456",
  "4567",
  "5678",
  "6789",
  "9876",
  "8765",
  "7654",
  "6543",
  "5432",
  "4321",
  "3210",
]);

function hex(bytes: Uint8Array): string {
  return [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function bytes(value: string): ArrayBuffer {
  return encoder.encode(value).slice().buffer as ArrayBuffer;
}

export async function sha256(value: string): Promise<string> {
  return hex(new Uint8Array(await crypto.subtle.digest("SHA-256", bytes(value))));
}

export async function gerarHashPin(pin: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16)).slice();
  const chave = await crypto.subtle.importKey("raw", bytes(pin), "PBKDF2", false, [
    "deriveBits",
  ]);
  const derivado = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt: salt.buffer as ArrayBuffer, iterations: 120_000 },
    chave,
    256,
  );
  return `pbkdf2-sha256$120000$${hex(salt)}$${hex(new Uint8Array(derivado))}`;
}

export function pinOperacionalValido(pin: string): boolean {
  return /^\d{4}$/.test(pin) && !PINS_FRACOS.has(pin);
}

export async function conferirPin(pin: string, armazenado: string): Promise<boolean> {
  const [algoritmo, iteracoesTexto, saltHex, hashEsperado] = armazenado.split("$");
  const iteracoes = Number(iteracoesTexto);
  if (
    algoritmo !== "pbkdf2-sha256" ||
    !Number.isInteger(iteracoes) ||
    !saltHex ||
    !hashEsperado
  ) {
    return false;
  }
  const salt = new Uint8Array(
    saltHex.match(/.{2}/g)?.map((parte) => Number.parseInt(parte, 16)) ?? [],
  ).slice();
  const chave = await crypto.subtle.importKey("raw", bytes(pin), "PBKDF2", false, [
    "deriveBits",
  ]);
  const derivado = hex(
    new Uint8Array(
      await crypto.subtle.deriveBits(
        {
          name: "PBKDF2",
          hash: "SHA-256",
          salt: salt.buffer as ArrayBuffer,
          iterations: iteracoes,
        },
        chave,
        256,
      ),
    ),
  );
  if (derivado.length !== hashEsperado.length) return false;
  let diferenca = 0;
  for (let indice = 0; indice < derivado.length; indice += 1) {
    diferenca |= derivado.charCodeAt(indice) ^ hashEsperado.charCodeAt(indice);
  }
  return diferenca === 0;
}

export function novoToken(): string {
  return hex(crypto.getRandomValues(new Uint8Array(32)));
}
