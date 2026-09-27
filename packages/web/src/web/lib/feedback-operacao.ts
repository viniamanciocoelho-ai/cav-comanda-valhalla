import equal from "fast-deep-equal";
import type { FilaOfflineItem } from "./offline";

export function resumoFeedbackOperacao(registro: FilaOfflineItem) {
  if (registro.acao === "abrir_mesa") {
    const mesa = registro.depois.mesas.find((atual) =>
      atual.ativa && !registro.antes.mesas.some((anterior) =>
        anterior.mesa_id === atual.mesa_id && anterior.ativa,
      ),
    );
    if (!mesa) return null;
    const label = `Mesa ${String(mesa.mesa_id).padStart(2, "0")}`;
    return {
      pendente: `Abrindo ${label}…`,
      confirmado: `${label} aberta e confirmada no servidor.`,
      incerto: `Conferindo a abertura da ${label}…`,
      recusado: `A abertura da ${label} foi recusada. Confira o salão.`,
    };
  }
  if (registro.acao !== "alterar_comanda") return null;
  const anteriores = new Map(registro.antes.itens.map((item) => [item.item_id, item]));
  const alterados = registro.depois.itens.flatMap((item) => {
    if (item.status !== "novo") return [];
    const anterior = anteriores.get(item.item_id);
    const quantidade = item.quantidade - (anterior?.quantidade ?? 0);
    return quantidade > 0 ? [{ item, quantidade }] : [];
  });
  if (!alterados.length) return null;
  const item = alterados[0]!.item;
  const quantidade = alterados.reduce((total, entrada) => total + entrada.quantidade, 0);
  const local = item.mesa_id !== null
    ? `Mesa ${String(item.mesa_id).padStart(2, "0")}`
    : `Balcão ${item.balcao_id}`;
  const resumo = `${quantidade}× ${item.name} · ${local}`;
  return {
    pendente: `Salvando ${resumo}…`,
    confirmado: `Adicionado: ${resumo}.`,
    incerto: `Conferindo ${resumo}…`,
    recusado: `Não foi possível adicionar ${resumo}. Confira a comanda.`,
  };
}

export function entidadeIdDaOperacao(registro: FilaOfflineItem) {
  const mesaAlterada = registro.depois.mesas.find((atual) => {
    const anterior = registro.antes.mesas.find((item) => item.mesa_id === atual.mesa_id);
    return !anterior || !equal(anterior, atual);
  });
  if (mesaAlterada) return String(mesaAlterada.mesa_id);

  const itemAlterado = registro.depois.itens.find((atual) => {
    const anterior = registro.antes.itens.find((item) => item.item_id === atual.item_id);
    return !anterior || !equal(anterior, atual);
  });
  if (itemAlterado?.mesa_id !== null && itemAlterado?.mesa_id !== undefined) {
    return String(itemAlterado.mesa_id);
  }
  if (itemAlterado?.balcao_id !== null && itemAlterado?.balcao_id !== undefined) {
    return String(itemAlterado.balcao_id);
  }

  const balcaoAlterado = registro.depois.balcoes.find((atual) => {
    const anterior = registro.antes.balcoes.find((item) => item.balcao_id === atual.balcao_id);
    return !anterior || !equal(anterior, atual);
  });
  return balcaoAlterado ? String(balcaoAlterado.balcao_id) : undefined;
}
