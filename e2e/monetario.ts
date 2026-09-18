// Testes da aritmetica monetaria (Correcao 4). Rodar com: bun e2e/monetario.ts
// Cobre os 10 casos exigidos no documento de correcao, mais as invariantes gerais:
// soma das parcelas = valor original, sem centavo criado ou perdido, sem NaN,
// sem valor negativo e resultado identico entre execucoes (determinismo).

import { paraCentavos, paraReais, ratear } from "../packages/web/src/web/lib/rateio";

const TAXA_SERVICO = 0.1;

let falhas = 0;
let total = 0;

function checar(nome: string, condicao: boolean, detalhe = "") {
  total += 1;
  if (condicao) {
    console.log(`  ok   ${nome}${detalhe ? ` — ${detalhe}` : ""}`);
  } else {
    falhas += 1;
    console.log(`  FALHA ${nome}${detalhe ? ` — ${detalhe}` : ""}`);
  }
}

function soma(v: number[]) {
  return v.reduce((s, n) => s + n, 0);
}

/** Invariantes obrigatorias em toda divisao. */
function invariantes(nome: string, totalCent: number, partes: number[], iguaisEntreSi = true) {
  checar(`${nome}: soma fecha`, soma(partes) === totalCent, `${soma(partes)} vs ${totalCent}`);
  checar(`${nome}: sem NaN`, partes.every((v) => Number.isFinite(v)));
  checar(`${nome}: inteiros`, partes.every((v) => Number.isInteger(v)));
  if (totalCent >= 0) checar(`${nome}: sem negativo`, partes.every((v) => v >= 0));
  if (iguaisEntreSi) {
    // Divisao em partes iguais: ninguem paga mais de um centavo a mais que o outro.
    const diferenca = Math.max(...partes) - Math.min(...partes);
    checar(`${nome}: diferenca maxima de 1 centavo`, diferenca <= 1, `${diferenca}`);
  }
}

function iguais(n: number) {
  return Array.from({ length: n }, () => 1);
}

console.log("\n1. R$ 10,00 dividido por 3");
{
  const cent = paraCentavos(10);
  const partes = ratear(cent, iguais(3));
  invariantes("10,00/3", cent, partes);
  checar("10,00/3 = 334+333+333", JSON.stringify(partes) === "[334,333,333]", JSON.stringify(partes));
  checar(
    "apresentacao em reais",
    partes.map(paraReais).join("|") === "3.34|3.33|3.33",
    partes.map(paraReais).join("|"),
  );
}

console.log("\n2. R$ 0,01 dividido por 2");
{
  const cent = paraCentavos(0.01);
  const partes = ratear(cent, iguais(2));
  invariantes("0,01/2", cent, partes);
  checar("0,01/2 = 1+0", JSON.stringify(partes) === "[1,0]", JSON.stringify(partes));
}

console.log("\n3. R$ 99,99 dividido por 7");
{
  const cent = paraCentavos(99.99);
  const partes = ratear(cent, iguais(7));
  invariantes("99,99/7", cent, partes);
  // 9999 = 7 x 1428 + 3: exatamente tres pessoas recebem o centavo que sobra.
  checar("99,99/7 tem 3 pessoas com centavo extra", partes.filter((v) => v === 1429).length === 3, JSON.stringify(partes));
  checar("99,99/7 = 3x1429 + 4x1428", JSON.stringify(partes) === "[1429,1429,1429,1428,1428,1428,1428]", JSON.stringify(partes));
}

console.log("\n4. Item individual (nao entra em rateio)");
{
  // SASSIONS IPA 18,00 lancado so para Ana: base dela sobe, as demais ficam intactas.
  const chopp = paraCentavos(24.5);
  const individuais = [chopp, 0, 0];
  const rateios = ratear(0, iguais(3));
  const bases = individuais.map((v, i) => v + rateios[i]);
  invariantes("compartilhado zero", 0, rateios);
  checar("base da Ana = 2450", bases[0] === 2450, String(bases[0]));
  checar("soma das bases = item", soma(bases) === chopp, `${soma(bases)} vs ${chopp}`);
}

console.log("\n5. Item compartilhado");
{
  // Porcao de 68,90 dividida entre 3 pessoas.
  const porcao = paraCentavos(68.9);
  const partes = ratear(porcao, iguais(3));
  invariantes("porcao/3", porcao, partes);
  checar("68,90/3 = 2297+2297+2296", JSON.stringify(partes) === "[2297,2297,2296]", JSON.stringify(partes));
}

console.log("\n6. Taxa de servico de 10%");
{
  const subtotal = paraCentavos(10) + paraCentavos(24.5) + paraCentavos(68.9);
  const servico = Math.round(subtotal * TAXA_SERVICO);
  const individuais = [paraCentavos(24.5), 0, 0];
  const rateios = ratear(paraCentavos(68.9) + paraCentavos(10), iguais(3));
  const bases = individuais.map((v, i) => v + rateios[i]);
  const servicos = ratear(servico, bases);
  // Servico e proporcional a base de cada pessoa, portanto as partes sao desiguais de proposito.
  invariantes("servico rateado", servico, servicos, false);
  const totalPessoas = soma(bases.map((b, i) => b + servicos[i]));
  checar("total por pessoa fecha com subtotal+servico", totalPessoas === subtotal + servico, `${totalPessoas} vs ${subtotal + servico}`);
  checar("saldo restante zero", subtotal + servico - totalPessoas === 0);
}

console.log("\n7. Retirada da taxa de servico");
{
  const subtotal = paraCentavos(103.4);
  const servico = 0; // servicoIncluso = false
  const bases = ratear(subtotal, iguais(3));
  const servicos = ratear(servico, bases);
  invariantes("servico retirado", 0, servicos);
  const totalPessoas = soma(bases.map((b, i) => b + servicos[i]));
  checar("total sem servico = subtotal", totalPessoas === subtotal, `${totalPessoas} vs ${subtotal}`);
  checar("nenhum servico cobrado", servicos.every((v) => v === 0));
}

console.log("\n8. Desconto");
{
  // O sistema atual nao tem desconto (limitacao registrada no README). A aritmetica de
  // rateio ja suporta valor negativo de forma determinista, caso o recurso seja criado.
  const estorno = -1000;
  const partes = ratear(estorno, iguais(3));
  checar("estorno soma exato", soma(partes) === estorno, `${soma(partes)} vs ${estorno}`);
  checar("estorno = -334-333-333", JSON.stringify(partes) === "[-334,-333,-333]", JSON.stringify(partes));
}

console.log("\n9. Soma de varios itens compartilhados");
{
  const itens = [paraCentavos(68.9), paraCentavos(10.01), paraCentavos(7.77), paraCentavos(0.01)];
  const compartilhado = soma(itens);
  const partes = ratear(compartilhado, iguais(4));
  invariantes("4 compartilhados/4", compartilhado, partes);
  checar("compartilhado total = 8669", compartilhado === 8669, String(compartilhado));
}

console.log("\n10. Centavos restantes em pessoas diferentes conforme os pesos");
{
  // Pesos diferentes: quem tem o maior resto recebe o centavo, sempre o mesmo.
  const t = 10_000;
  const pesos = [3333, 3333, 3334];
  const a = ratear(t, pesos);
  const b = ratear(t, pesos);
  invariantes("pesos desiguais", t, a, false);
  checar("determinismo entre execucoes", JSON.stringify(a) === JSON.stringify(b), JSON.stringify(a));
  const c = ratear(100, [1, 1, 1]);
  const d = ratear(100, [2, 1, 1]);
  checar("centavo muda de pessoa com o peso", JSON.stringify(c) !== JSON.stringify(d), `${JSON.stringify(c)} / ${JSON.stringify(d)}`);
  checar("ambos fecham em 100", soma(c) === 100 && soma(d) === 100);
}

console.log("\nVarredura exaustiva: 0..2000 centavos x 1..9 pessoas");
{
  let ruins = 0;
  for (let cent = 0; cent <= 2000; cent += 1) {
    for (let n = 1; n <= 9; n += 1) {
      const partes = ratear(cent, iguais(n));
      if (soma(partes) !== cent) ruins += 1;
      if (partes.some((v) => !Number.isInteger(v) || v < 0)) ruins += 1;
      if (Math.max(...partes) - Math.min(...partes) > 1) ruins += 1;
    }
  }
  checar("18.009 divisoes sem centavo perdido", ruins === 0, `${ruins} falhas`);
}

console.log("\nVarredura com pesos aleatorios (5.000 sorteios)");
{
  let ruins = 0;
  let semente = 42;
  const proximo = () => {
    semente = (semente * 1_103_515_245 + 12_345) % 2_147_483_648;
    return semente / 2_147_483_648;
  };
  for (let k = 0; k < 5000; k += 1) {
    const n = 1 + Math.floor(proximo() * 8);
    const pesos = Array.from({ length: n }, () => Math.floor(proximo() * 5000));
    const cent = Math.floor(proximo() * 500_000);
    const partes = ratear(cent, pesos);
    if (soma(partes) !== cent) ruins += 1;
    if (partes.some((v) => !Number.isInteger(v) || v < 0)) ruins += 1;
  }
  checar("5.000 rateios ponderados fecham exatos", ruins === 0, `${ruins} falhas`);
}

console.log(`\n${total - falhas}/${total} verificacoes passaram`);
if (falhas) process.exit(1);
