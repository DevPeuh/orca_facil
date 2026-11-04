export type Unit = "serviço" | "hora" | "metro" | "diária" | "peça";
export type QuoteStatus = "draft" | "sent" | "accepted" | "rejected" | "expired";
export type DiscountType = "fixed" | "percent";

export const statusLabels: Record<QuoteStatus, string> = {
  draft: "Rascunho",
  sent: "Enviado",
  accepted: "Aceito",
  rejected: "Recusado",
  expired: "Expirado",
};

export interface Client {
  id: string;
  name: string;
  phone: string;
  email: string;
  address: string;
  notes: string;
}

export interface Service {
  id: string;
  name: string;
  description: string;
  unit: Unit;
  price: number;
}

export interface QuoteItem {
  id: string;
  serviceId?: string;
  name: string;
  unit: Unit;
  quantity: number;
  unitPrice: number;
  notes: string;
}

export interface Quote {
  id: string;
  number: string;
  clientId: string;
  clientSnapshot: Client;
  items: QuoteItem[];
  issueDate: string;
  validUntil: string;
  paymentTerms: string;
  notes: string;
  discountType: DiscountType;
  discount: number;
  surcharge: number;
  status: QuoteStatus;
  createdAt: string;
}

export interface Business {
  name: string;
  phone: string;
  email: string;
  address: string;
  document: string;
}

export interface AppData {
  version: 1;
  clients: Client[];
  services: Service[];
  quotes: Quote[];
  business: Business;
  nextQuoteNumber: number;
}

export function emptyData(): AppData {
  return {
    version: 1,
    clients: [],
    services: [],
    quotes: [],
    business: { name: "", phone: "", email: "", address: "", document: "" },
    nextQuoteNumber: 1,
  };
}

function nonNegative(value: number): number {
  return Number.isFinite(value) ? Math.max(0, value) : 0;
}

function roundCents(value: number): number {
  return Math.round(value + Number.EPSILON * value);
}

function toCents(value: number): number {
  return roundCents(value * 100);
}

export function calculateTotals(
  items: Pick<QuoteItem, "quantity" | "unitPrice">[],
  discountType: DiscountType,
  discount: number,
  surcharge: number,
) {
  // Arredonda cada item antes da soma para coincidir com o documento.
  const subtotalCents = items.reduce(
    (sum, item) => sum + toCents(nonNegative(item.quantity) * nonNegative(item.unitPrice)),
    0,
  );
  const discountCents =
    discountType === "percent"
      ? roundCents((subtotalCents * Math.min(100, nonNegative(discount))) / 100)
      : toCents(nonNegative(discount));
  const surchargeCents = toCents(nonNegative(surcharge));

  return {
    subtotal: subtotalCents / 100,
    discountAmount: discountCents / 100,
    surcharge: surchargeCents / 100,
    total: Math.max(0, subtotalCents - discountCents + surchargeCents) / 100,
  };
}

export function todayISO(): string {
  const date = new Date();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

export function getQuoteStatus(quote: Pick<Quote, "status" | "validUntil">, today = todayISO()): QuoteStatus {
  return quote.status === "sent" && quote.validUntil < today ? "expired" : quote.status;
}

export function canTransitionStatus(from: QuoteStatus, to: QuoteStatus): boolean {
  if (from === "draft") return to === "sent";
  if (from === "sent") return to === "accepted" || to === "rejected" || to === "expired";
  return false;
}

export function nextQuoteNumber(sequence: number, year = new Date().getFullYear()): string {
  return `ORC-${year}-${String(sequence).padStart(4, "0")}`;
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

export function formatDate(value: string): string {
  const [year, month, day] = value.slice(0, 10).split("-");
  return year && month && day ? `${day}/${month}/${year}` : "—";
}
