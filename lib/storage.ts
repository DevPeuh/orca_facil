import { z } from "zod";
import { emptyData, todayISO, type AppData } from "./domain";

export const STORAGE_KEY = "orcafacil:v1";
const MAX_BACKUP_BYTES = 5 * 1024 * 1024;

const requiredText = z.string().trim().min(1);
const email = z.union([z.literal(""), z.email()]);
const unit = z.enum(["serviço", "hora", "metro", "diária", "peça"]);
const money = z
  .number()
  .nonnegative()
  .max(Number.MAX_SAFE_INTEGER / 100);
const calendarDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => {
    const date = new Date(`${value}T12:00:00Z`);
    return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
  });

const clientSchema = z.object({
  id: requiredText,
  name: requiredText,
  phone: requiredText,
  email,
  address: z.string(),
  notes: z.string(),
});

const serviceSchema = z.object({
  id: requiredText,
  name: requiredText,
  description: z.string(),
  unit,
  price: money.positive(),
});

const itemSchema = z.object({
  id: requiredText,
  serviceId: requiredText.optional(),
  name: requiredText,
  unit,
  quantity: z.number().positive(),
  unitPrice: money.positive(),
  notes: z.string(),
});

function hasUniqueIds(values: { id: string }[]): boolean {
  return new Set(values.map((value) => value.id)).size === values.length;
}

const quoteSchema = z
  .object({
    id: requiredText,
    number: z.string().regex(/^ORC-\d{4}-\d{4,}$/),
    clientId: requiredText,
    clientSnapshot: clientSchema,
    items: z.array(itemSchema).min(1).refine(hasUniqueIds),
    issueDate: calendarDate,
    validUntil: calendarDate,
    paymentTerms: z.string(),
    notes: z.string(),
    discountType: z.enum(["fixed", "percent"]),
    discount: money,
    surcharge: money,
    status: z.enum(["draft", "sent", "accepted", "rejected", "expired"]),
    createdAt: z.iso.datetime(),
  })
  .refine((quote) => quote.validUntil >= quote.issueDate)
  .refine((quote) => quote.discountType !== "percent" || quote.discount <= 100)
  .refine((quote) => quote.clientSnapshot.id === quote.clientId)
  .refine((quote) => {
    const cents = quote.items.reduce(
      (sum, item) => sum + Math.round(item.quantity * item.unitPrice * 100),
      0,
    );
    return Number.isSafeInteger(cents + Math.round(quote.surcharge * 100));
  });

const dataSchema = z
  .object({
    version: z.literal(1),
    clients: z.array(clientSchema).refine(hasUniqueIds),
    services: z.array(serviceSchema).refine(hasUniqueIds),
    quotes: z.array(quoteSchema).refine(hasUniqueIds),
    business: z.object({
      name: z.string(),
      phone: z.string(),
      email,
      address: z.string(),
      document: z.string(),
    }),
    nextQuoteNumber: z
      .number()
      .int()
      .positive()
      .max(Number.MAX_SAFE_INTEGER - 1),
  })
  .refine((data) => new Set(data.quotes.map((quote) => quote.number)).size === data.quotes.length)
  .refine((data) => {
    const clientIds = new Set(data.clients.map((client) => client.id));
    return data.quotes.every((quote) => clientIds.has(quote.clientId));
  });

export function parseBackup(raw: string): AppData {
  if (new TextEncoder().encode(raw).byteLength > MAX_BACKUP_BYTES) {
    throw new Error("O arquivo excede o limite de 5 MB.");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("Não foi possível ler o arquivo. Selecione um backup JSON do OrçaFácil.");
  }

  const result = dataSchema.safeParse(parsed);
  if (!result.success) {
    throw new Error(
      "O backup contém dados inválidos ou uma versão incompatível. Seus dados atuais foram preservados.",
    );
  }

  const data = result.data;
  for (const quote of data.quotes) {
    const sequence = Number(quote.number.split("-")[2]);
    if (!Number.isSafeInteger(sequence) || sequence < 1 || sequence >= Number.MAX_SAFE_INTEGER - 1) {
      throw new Error("O backup contém uma numeração de orçamento inválida.");
    }
    data.nextQuoteNumber = Math.max(data.nextQuoteNumber, sequence + 1);
  }
  return data;
}

export function loadData(): AppData {
  let raw: string | null;
  try {
    raw = localStorage.getItem(STORAGE_KEY);
  } catch {
    throw new Error(
      "Não foi possível acessar os dados deste navegador. Verifique as permissões de armazenamento.",
    );
  }
  return raw === null ? emptyData() : parseBackup(raw);
}

export function saveData(data: AppData): void {
  const validated = parseBackup(JSON.stringify(data));
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(validated));
  } catch {
    throw new Error(
      "Não foi possível salvar. O armazenamento pode estar cheio ou bloqueado. Exporte um backup antes de sair.",
    );
  }
}

export function exportBackup(data: AppData): void {
  const validated = parseBackup(JSON.stringify(data));
  const blob = new Blob([JSON.stringify(validated)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `orcafacil-backup-${todayISO()}.json`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
