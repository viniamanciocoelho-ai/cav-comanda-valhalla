import assert from "node:assert/strict";
import {
  codificarPagina,
  quebrarTextoTermico,
  serializarEscPos,
} from "../packages/web/src/web/lib/recibo";
import {
  enviarEmBlocos,
  fatiarBytes,
  montarIntentRawBt,
} from "../packages/web/src/web/lib/impressao-local";

const acentos = "áàâãéêíóôõúüçÁÀÂÃÉÊÍÓÔÕÚÜÇ";
assert.deepEqual(
  [...codificarPagina(acentos, 3)],
  [
    0xa0, 0x85, 0x83, 0x84, 0x82, 0x88, 0xa1, 0xa2, 0x93, 0x94, 0xa3, 0x81, 0x87, 0x86, 0x91, 0x8f,
    0x8e, 0x90, 0x89, 0x8b, 0x9f, 0x8c, 0x99, 0x96, 0x9a, 0x80,
  ],
);
assert.deepEqual([...codificarPagina("a\u0301", 3)], [...codificarPagina("á", 3)]);
assert.deepEqual([...codificarPagina("€", 16)], [0x80]);
assert.deepEqual([...codificarPagina("€", 19)], [0xd5]);

const desconhecido = codificarPagina("Preço € 10,00", 3);
assert.deepEqual(
  [...desconhecido],
  [0x50, 0x72, 0x65, 0x87, 0x6f, 0x20, 0x3f, 0x20, 0x31, 0x30, 0x2c, 0x30, 0x30],
);

const recibo = serializarEscPos(
  "VALHALLA CHOPERIA\nÁgua com gás e limão em uma linha deliberadamente longa",
  3,
);
assert.equal(
  quebrarTextoTermico("Água com gás e limão em uma linha deliberadamente longa")
    .split("\n")
    .every((linha) => linha.length <= 32),
  true,
);
assert.deepEqual(
  recibo.slice(0, 8),
  new Uint8Array([0x1b, 0x40, 0x1b, 0x74, 0x03, 0x1b, 0x61, 0x00]),
);
assert.deepEqual(recibo.slice(-3), new Uint8Array([0x1b, 0x64, 0x04]));

const blocos = fatiarBytes(
  Uint8Array.from({ length: 205 }, (_, indice) => indice),
  100,
);
assert.deepEqual(
  blocos.map((bloco) => bloco.length),
  [100, 100, 5],
);
assert.deepEqual([...blocos[2]], [200, 201, 202, 203, 204]);

const tentativas: number[] = [];
const gravacoes: number[] = [];
await enviarEmBlocos(
  {
    uuid: "teste",
    properties: { writeWithoutResponse: true },
    async writeValueWithoutResponse(valor) {
      const tamanho = new Uint8Array(valor as ArrayBuffer).length;
      tentativas.push(tamanho);
      if (tamanho > 20) {
        throw new DOMException("Attribute value too long", "DataError");
      }
      gravacoes.push(tamanho);
    },
  },
  new Uint8Array(45),
  100,
  0,
);
assert.deepEqual(tentativas, [45, 20, 20, 5]);
assert.deepEqual(gravacoes, [20, 20, 5]);

const intent = montarIntentRawBt(new Uint8Array([0x1b, 0x40, 0x0a]));
assert.match(intent, /^intent:base64,/);
assert.match(intent, /scheme=rawbt/);
assert.match(intent, /package=ru\.a402d\.rawbtprinter/);
assert.match(intent, /browser_fallback_url=/);

console.log("Impressão local: CP860, ESC/POS sem corte, blocos BLE e intent RawBT aprovados.");
