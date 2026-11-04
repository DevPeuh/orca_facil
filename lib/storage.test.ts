import assert from "node:assert/strict";
import test from "node:test";
import { emptyData, type AppData } from "./domain";
import { loadData, parseBackup, saveData, STORAGE_KEY } from "./storage";

function populatedData(): AppData {
  const data = emptyData();
  const client = { id: "client-1", name: "Cliente de teste", phone: "(00) 00000-0000", email: "", address: "", notes: "" };
  data.clients.push(client);
  data.services.push({ id: "service-1", name: "Instalação", description: "", unit: "serviço", price: 100 });
  data.quotes.push({
    id: "quote-1",
    number: "ORC-2026-0001",
    clientId: client.id,
    clientSnapshot: { ...client },
    items: [
      {
        id: "item-1",
        serviceId: "service-1",
        name: "Instalação",
        unit: "serviço",
        quantity: 2,
        unitPrice: 100,
        notes: "",
      },
    ],
    issueDate: "2026-09-11",
    validUntil: "2026-09-26",
    paymentTerms: "À vista",
    notes: "",
    discountType: "fixed",
    discount: 0,
    surcharge: 0,
    status: "draft",
    createdAt: "2026-09-11T12:00:00.000Z",
  });
  data.nextQuoteNumber = 2;
  return data;
}

test("backup mantém dados válidos, inclusive configuração inicial vazia", () => {
  for (const data of [emptyData(), populatedData()]) {
    assert.deepEqual(parseBackup(JSON.stringify(data)), data);
  }
});

test("rejeita JSON inválido, versões incompatíveis e dados incompletos", () => {
  assert.throws(() => parseBackup("{"), /backup JSON/);
  assert.throws(() => parseBackup(JSON.stringify({ ...emptyData(), version: 2 })), /versão incompatível/);
  assert.throws(() => parseBackup("null"), /dados inválidos/);
  assert.throws(() => parseBackup("{}"), /dados inválidos/);
});

test("limite do arquivo considera bytes UTF-8", () => {
  assert.throws(() => parseBackup(JSON.stringify({ text: "á".repeat(3 * 1024 * 1024) })), /5 MB/);
});

test("rejeita IDs e números duplicados", () => {
  const mutations: ((data: AppData) => void)[] = [
    (data) => data.clients.push({ ...data.clients[0] }),
    (data) => data.services.push({ ...data.services[0] }),
    (data) => data.quotes.push({ ...data.quotes[0], number: "ORC-2026-0002" }),
    (data) => data.quotes.push({ ...data.quotes[0], id: "quote-2" }),
    (data) => data.quotes[0].items.push({ ...data.quotes[0].items[0] }),
  ];
  for (const mutate of mutations) {
    const data = populatedData();
    mutate(data);
    assert.throws(() => parseBackup(JSON.stringify(data)), /dados inválidos/);
  }
});

test("rejeita quantidades, valores, desconto e referências inválidos", () => {
  const mutations: ((data: AppData) => void)[] = [
    (data) => {
      data.quotes[0].items[0].quantity = 0;
    },
    (data) => {
      data.quotes[0].items[0].unitPrice = -1;
    },
    (data) => {
      data.quotes[0].items[0].unitPrice = Infinity;
    },
    (data) => {
      data.quotes[0].discount = -1;
    },
    (data) => {
      data.quotes[0].discountType = "percent";
      data.quotes[0].discount = 101;
    },
    (data) => {
      data.quotes[0].surcharge = -1;
    },
    (data) => {
      data.clients = [];
    },
    (data) => {
      data.quotes[0].clientSnapshot.id = "outro-cliente";
    },
    (data) => {
      data.quotes[0].items = [];
    },
  ];
  for (const mutate of mutations) {
    const data = populatedData();
    mutate(data);
    assert.throws(() => parseBackup(JSON.stringify(data)), /dados inválidos/);
  }
});

test("valida dias reais, anos bissextos e ordem das datas", () => {
  for (const date of ["2026-02-29", "2026-02-30", "2026-13-01", "2026-09-10"]) {
    const data = populatedData();
    data.quotes[0].validUntil = date;
    assert.throws(() => parseBackup(JSON.stringify(data)), /dados inválidos/);
  }
  const data = populatedData();
  data.quotes[0].issueDate = "2024-02-28";
  data.quotes[0].validUntil = "2024-02-29";
  assert.equal(parseBackup(JSON.stringify(data)).quotes[0].validUntil, "2024-02-29");
});

test("ajusta a sequência para impedir colisão após importar", () => {
  const data = populatedData();
  data.quotes[0].number = "ORC-2025-0250";
  data.nextQuoteNumber = 1;
  assert.equal(parseBackup(JSON.stringify(data)).nextQuoteNumber, 251);
  data.nextQuoteNumber = 500;
  assert.equal(parseBackup(JSON.stringify(data)).nextQuoteNumber, 500);
  data.quotes[0].number = "ORC-2026-9007199254740991";
  assert.throws(() => parseBackup(JSON.stringify(data)), /numeração/);
});

test("armazenamento corrompido não é substituído e erro de gravação é informado", () => {
  const original = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  const records = new Map<string, string>();
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: {
      getItem: (key: string) => records.get(key) ?? null,
      setItem: (key: string, value: string) => {
        records.set(key, value);
      },
    },
  });
  try {
    assert.deepEqual(loadData(), emptyData());
    saveData(populatedData());
    assert.deepEqual(loadData(), populatedData());
    records.set(STORAGE_KEY, "conteúdo corrompido");
    assert.throws(loadData, /backup JSON/);
    assert.equal(records.get(STORAGE_KEY), "conteúdo corrompido");
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      value: {
        setItem: () => {
          throw new Error("QuotaExceededError");
        },
      },
    });
    assert.throws(() => saveData(emptyData()), /Não foi possível salvar/);
  } finally {
    if (original) Object.defineProperty(globalThis, "localStorage", original);
    else Reflect.deleteProperty(globalThis, "localStorage");
  }
});
