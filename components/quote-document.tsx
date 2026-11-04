"use client";

import { ArrowLeft, MessageCircle, Printer } from "lucide-react";
import {
  type Business,
  type Quote,
  calculateTotals,
  formatCurrency,
  formatDate,
  getQuoteStatus,
  statusLabels,
} from "@/lib/domain";

export default function QuoteDocument({
  quote,
  business,
  onClose,
}: {
  quote: Quote;
  business: Business;
  onClose: () => void;
}) {
  const totals = calculateTotals(quote.items, quote.discountType, quote.discount, quote.surcharge);
  const client = quote.clientSnapshot;
  const status = getQuoteStatus(quote);
  const digits = client.phone.replace(/\D/g, "");
  const phone =
    digits.length === 10 || digits.length === 11 ? `55${digits}` : /^55\d{10,11}$/.test(digits) ? digits : "";
  const summary = [
    `Resumo do orçamento ${quote.number}`,
    business.name && `Prestador: ${business.name}`,
    `Cliente: ${client.name}`,
    `Situação: ${statusLabels[status]}`,
    "",
    ...quote.items.map(
      (item) =>
        `${item.name} — ${item.quantity.toLocaleString("pt-BR")} ${item.unit} × ${formatCurrency(item.unitPrice)}: ${formatCurrency(calculateTotals([item], "fixed", 0, 0).total)}${item.notes ? ` (${item.notes})` : ""}`,
    ),
    "",
    `Subtotal: ${formatCurrency(totals.subtotal)}`,
    `Desconto: ${formatCurrency(totals.discountAmount)}`,
    `Acréscimo: ${formatCurrency(totals.surcharge)}`,
    `Total: ${formatCurrency(totals.total)}`,
    `Emissão: ${formatDate(quote.issueDate)} · Válido até: ${formatDate(quote.validUntil)}`,
    quote.paymentTerms && `Pagamento: ${quote.paymentTerms}`,
    quote.notes && `Observações: ${quote.notes}`,
  ].join("\n");

  return (
    <div className="quote-document">
      <div className="form-actions no-print">
        <button className="secondary" onClick={onClose}>
          <ArrowLeft size={17} /> Voltar
        </button>
        <a
          className="secondary"
          href={`https://wa.me/${phone}?text=${encodeURIComponent(summary)}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          <MessageCircle size={17} /> Compartilhar no WhatsApp
        </a>
        <button className="primary" onClick={() => window.print()}>
          <Printer size={17} /> Imprimir / salvar PDF
        </button>
      </div>
      <p className="muted no-print">
        Na impressão, escolha “Salvar como PDF”. Envie o PDF pelo WhatsApp e marque o orçamento como enviado
        na lista. O botão WhatsApp prepara um resumo para você revisar e enviar.
      </p>
      <article className="panel print-area">
        <header className="document-header">
          <div>
            <p className="eyebrow">PROPOSTA DE SERVIÇOS</p>
            <h1>Orçamento</h1>
            <p>{quote.number}</p>
            <span className={`badge ${status}`}>{statusLabels[status]}</span>
          </div>
          <div>
            <strong>{business.name || "Prestador de serviços"}</strong>
            {business.document && <p>CPF / CNPJ: {business.document}</p>}
            {business.phone && <p>{business.phone}</p>}
            {business.email && <p>{business.email}</p>}
            {business.address && <p>{business.address}</p>}
          </div>
        </header>
        <div className="document-parties">
          <section>
            <h2>Preparado para</h2>
            <strong>{client.name}</strong>
            <p>{client.phone}</p>
            {client.email && <p>{client.email}</p>}
            {client.address && <p>{client.address}</p>}
          </section>
          <section className="document-meta">
            <p>
              <span>Data de emissão</span>
              <strong>{formatDate(quote.issueDate)}</strong>
            </p>
            <p>
              <span>Válido até</span>
              <strong>{formatDate(quote.validUntil)}</strong>
            </p>
          </section>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Descrição</th>
                <th>Qtd.</th>
                <th>Unidade</th>
                <th>Valor unitário</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              {quote.items.map((item) => (
                <tr key={item.id}>
                  <td>
                    <strong>{item.name}</strong>
                    {item.notes && <p className="muted">{item.notes}</p>}
                  </td>
                  <td>{item.quantity.toLocaleString("pt-BR", { maximumFractionDigits: 3 })}</td>
                  <td>{item.unit}</td>
                  <td>{formatCurrency(item.unitPrice)}</td>
                  <td>{formatCurrency(calculateTotals([item], "fixed", 0, 0).total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="document-totals">
          <p>
            <span>Subtotal</span>
            <strong>{formatCurrency(totals.subtotal)}</strong>
          </p>
          <p>
            <span>
              Desconto
              {quote.discountType === "percent" ? ` (${quote.discount.toLocaleString("pt-BR")}%)` : ""}
            </span>
            <strong>− {formatCurrency(totals.discountAmount)}</strong>
          </p>
          <p>
            <span>Acréscimo</span>
            <strong>{formatCurrency(totals.surcharge)}</strong>
          </p>
          <p className="total-final">
            <span>Total do orçamento</span>
            <strong>{formatCurrency(totals.total)}</strong>
          </p>
        </div>
        <div className="document-notes">
          {quote.paymentTerms && (
            <section>
              <h2>Condições de pagamento</h2>
              <p>{quote.paymentTerms}</p>
            </section>
          )}
          {quote.notes && (
            <section>
              <h2>Observações e prazo de execução</h2>
              <p>{quote.notes}</p>
            </section>
          )}
          <p className="muted">
            Este orçamento é válido até {formatDate(quote.validUntil)}. Alterações no escopo dos serviços
            devem ser combinadas antes da execução.
          </p>
        </div>
      </article>
    </div>
  );
}
