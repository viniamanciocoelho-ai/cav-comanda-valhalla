// Aritmetica da divisao de conta em centavos. Objetivo: a soma das partes fecha EXATAMENTE
// com o total da mesa, sem centavo sobrando nem inventado.

export function paraCentavos(valor: number): number {
  const convertido = Math.round(valor * 100);
  if (!Number.isFinite(valor) || !Number.isSafeInteger(convertido)) {
    throw new RangeError("O valor monetário excede a precisão segura em centavos.");
  }
  return convertido;
}

export function paraReais(centavos: number): number {
  if (!Number.isSafeInteger(centavos)) {
    throw new RangeError("O valor em centavos deve ser um inteiro seguro.");
  }
  return centavos / 100;
}

/**
 * Distribui um total (em centavos) entre N partes conforme pesos, usando maior resto.
 * Sem pesos (ou todos zerados) divide igualmente. A soma do retorno e sempre igual ao total.
 */
export function ratear(totalCentavos: number, pesos: number[]): number[] {
  const n = pesos.length;
  if (!Number.isSafeInteger(totalCentavos)) {
    throw new RangeError("O total do rateio deve ser um inteiro seguro em centavos.");
  }
  if (n === 0) {
    if (totalCentavos !== 0) {
      throw new RangeError("Não é possível ratear um valor sem destinatários.");
    }
    return [];
  }
  if (pesos.some((peso) => !Number.isSafeInteger(peso) || peso < 0)) {
    throw new RangeError("Os pesos do rateio devem ser inteiros seguros e não negativos.");
  }

  const somaPesos = pesos.reduce((s, p) => s + p, 0);
  if (!Number.isSafeInteger(somaPesos)) {
    throw new RangeError("A soma dos pesos excede a precisão segura de inteiros.");
  }
  const base = somaPesos > 0 ? pesos : pesos.map(() => 1);
  const soma = somaPesos > 0 ? somaPesos : n;

  // Tudo em inteiro. O sinal sai fora da divisao e volta no fim, para que um total
  // negativo (estorno) distribua igual ao positivo, sem depender de arredondamento.
  const sinal = totalCentavos < 0 ? -1 : 1;
  const total = Math.abs(Math.trunc(totalCentavos));

  // piso = floor(total * peso / soma) e resto = (total * peso) % soma, ambos exatos:
  // produto e soma sao inteiros, e (produto - resto) e divisivel por soma.
  const partes = base.map((peso, indice) => {
    if (!Number.isSafeInteger(total * peso)) {
      throw new RangeError("O rateio excede a precisão segura de inteiros.");
    }
    const produto = total * peso;
    const resto = produto % soma;
    return { indice, piso: (produto - resto) / soma, resto };
  });

  let sobra = total - partes.reduce((s, p) => s + p.piso, 0);

  // Maior resto primeiro; empate resolvido pelo indice. Ordenacao estavel e deterministica:
  // a mesma entrada devolve sempre a mesma saida, em qualquer renderizacao.
  const ordem = [...partes].sort((a, b) => b.resto - a.resto || a.indice - b.indice);

  const resultado = partes.map((p) => p.piso);
  for (let i = 0; sobra > 0 && i < ordem.length; i += 1) {
    resultado[ordem[i].indice] += 1;
    sobra -= 1;
  }
  return resultado.map((v) => v * sinal);
}
