import assert from "node:assert/strict";
import test from "node:test";
import {
  calculateTotals,
  canTransitionStatus,
  emptyData,
  formatCurrency,
  formatDate,
  getQuoteStatus,
  nextQuoteNumber,
  todayISO,
} from "./domain";
import type { QuoteStatus } from "./domain";

test("soma os itens com desconto fixo e acréscimo", () => {
  assert.deepEqual(
    calculateTotals(
      [
        { quantity: 2, unitPrice: 150 },
        { quantity: 1.5, unitPrice: 80 },
      ],
      "fixed",
      50,
      30,
    ),
    { subtotal: 420, discountAmount: 50, surcharge: 30, total: 400 },
  );
});

test("arredonda cada item antes de somar e calcula desconto percentual sobre o subtotal", () => {
  assert.deepEqual(
    calculateTotals(
      [
        { quantity: 0.5, unitPrice: 0.67 },
        { quantity: 0.5, unitPrice: 0.67 },
      ],
      "percent",
      10,
      0,
    ),
    { subtotal: 0.68, discountAmount: 0.07, surcharge: 0, total: 0.61 },
  );
  assert.equal(calculateTotals([{ quantity: 1, unitPrice: 1.005 }], "fixed", 0, 0).total, 1.01);
  assert.equal(calculateTotals([{ quantity: 3, unitPrice: 0.1 }], "fixed", 0, 0).total, 0.3);
});

test("desconto acima do valor do orçamento nunca produz total negativo", () => {
  assert.equal(calculateTotals([{ quantity: 1, unitPrice: 50 }], "fixed", 100, 20).total, 0);
  assert.equal(calculateTotals([{ quantity: 1, unitPrice: 50 }], "percent", 200, 20).total, 20);
});

test("arredonda meio centavo mesmo com imprecisão de ponto flutuante", () => {
  assert.equal(calculateTotals([{ quantity: 0.5, unitPrice: 20.15 }], "fixed", 0, 0).total, 10.08);
  assert.equal(calculateTotals([{ quantity: 1.005, unitPrice: 1 }], "fixed", 0, 0).total, 1.01);
  assert.deepEqual(calculateTotals([{ quantity: 1, unitPrice: 2.5 }], "percent", 64.6, 0), {
    subtotal: 2.5,
    discountAmount: 1.62,
    surcharge: 0,
    total: 0.88,
  });
  assert.deepEqual(calculateTotals([{ quantity: 1, unitPrice: 20 }], "fixed", 10.075, 1.005), {
    subtotal: 20,
    discountAmount: 10.08,
    surcharge: 1.01,
    total: 10.93,
  });
});

test("prévia vazia ou com campos incompletos permanece calculável", () => {
  assert.deepEqual(calculateTotals([], "fixed", 0, 0), {
    subtotal: 0,
    discountAmount: 0,
    surcharge: 0,
    total: 0,
  });
  assert.deepEqual(
    calculateTotals(
      [
        { quantity: NaN, unitPrice: 30 },
        { quantity: 2, unitPrice: -5 },
      ],
      "fixed",
      -20,
      Infinity,
    ),
    { subtotal: 0, discountAmount: 0, surcharge: 0, total: 0 },
  );
});

test("orçamento enviado vale até o fim do dia da validade", () => {
  assert.equal(getQuoteStatus({ status: "sent", validUntil: "2026-09-11" }, "2026-09-11"), "sent");
  assert.equal(getQuoteStatus({ status: "sent", validUntil: "2026-09-11" }, "2026-09-12"), "expired");
});

test("vencimento não modifica rascunhos nem decisões já tomadas", () => {
  for (const status of ["draft", "accepted", "rejected", "expired"] as const) {
    assert.equal(getQuoteStatus({ status, validUntil: "2026-01-01" }, "2026-09-11"), status);
  }
});

test("fluxo permite envio e decisão, sem reabrir estados finais", () => {
  const statuses: QuoteStatus[] = ["draft", "sent", "accepted", "rejected", "expired"];
  const allowed = new Set(["draft:sent", "sent:accepted", "sent:rejected", "sent:expired"]);
  for (const from of statuses) {
    for (const to of statuses) {
      assert.equal(canTransitionStatus(from, to), allowed.has(`${from}:${to}`), `${from} → ${to}`);
    }
  }
});

test("numeração conserva sequência e não trunca números grandes", () => {
  assert.equal(nextQuoteNumber(1, 2026), "ORC-2026-0001");
  assert.equal(nextQuoteNumber(12345, 2026), "ORC-2026-12345");
});

test("datas de calendário não sofrem conversão UTC e moeda usa reais", () => {
  assert.equal(formatDate("2026-09-11"), "11/09/2026");
  assert.equal(formatCurrency(1234.5).replace(/\s/g, " "), "R$ 1.234,50");
  const now = new Date();
  assert.equal(
    todayISO(),
    `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`,
  );
});

test("dados iniciais não compartilham referências e começam sem exemplos fictícios", () => {
  const first = emptyData();
  const second = emptyData();
  first.business.name = "Prestador";
  assert.equal(second.business.name, "");
  assert.equal(second.nextQuoteNumber, 1);
  assert.equal(second.version, 1);
  assert.deepEqual(second.clients, []);
  assert.deepEqual(second.services, []);
  assert.deepEqual(second.quotes, []);
});
