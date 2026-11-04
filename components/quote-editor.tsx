"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, Save, Trash2 } from "lucide-react";
import { useFieldArray, useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import {
  type AppData,
  type Quote,
  type QuoteItem,
  calculateTotals,
  formatCurrency,
  nextQuoteNumber,
  todayISO,
} from "@/lib/domain";

const units = ["serviço", "hora", "metro", "diária", "peça"] as const;
const dateSchema = z.string().refine((value) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T12:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}, "Informe uma data válida.");

const schema = z
  .object({
    clientId: z.string().min(1, "Selecione um cliente."),
    issueDate: dateSchema,
    validUntil: dateSchema,
    paymentTerms: z.string().trim(),
    notes: z.string().trim(),
    items: z
      .array(
        z.object({
          id: z.string(),
          serviceId: z.string().optional(),
          name: z.string().trim().min(1, "Informe o serviço ou produto."),
          unit: z.enum(units),
          quantity: z
            .number({ error: "Informe uma quantidade válida." })
            .positive("A quantidade deve ser maior que zero.")
            .multipleOf(0.001, "Use até 3 casas decimais."),
          unitPrice: z
            .number({ error: "Informe um preço válido." })
            .positive("O preço deve ser maior que zero.")
            .multipleOf(0.01, "Use até 2 casas decimais."),
          notes: z.string().trim(),
        }),
      )
      .min(1, "Adicione pelo menos um item."),
    discountType: z.enum(["fixed", "percent"]),
    discount: z
      .number({ error: "Informe um desconto válido." })
      .min(0, "O desconto não pode ser negativo.")
      .multipleOf(0.01, "Use até 2 casas decimais."),
    surcharge: z
      .number({ error: "Informe um acréscimo válido." })
      .min(0, "O acréscimo não pode ser negativo.")
      .multipleOf(0.01, "Use até 2 casas decimais."),
  })
  .superRefine((values, context) => {
    if (values.validUntil < values.issueDate) {
      context.addIssue({
        code: "custom",
        path: ["validUntil"],
        message: "A validade deve ser igual ou posterior à emissão.",
      });
    }
    if (values.discountType === "percent" && values.discount > 100) {
      context.addIssue({
        code: "custom",
        path: ["discount"],
        message: "O desconto percentual deve ser de até 100%.",
      });
    }
  });

type FormValues = z.infer<typeof schema>;

function newItem(): QuoteItem {
  return { id: crypto.randomUUID(), name: "", unit: "serviço", quantity: 1, unitPrice: 0, notes: "" };
}

function defaultValidity(): string {
  const date = new Date();
  date.setDate(date.getDate() + 15);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function ErrorText({ message }: { message?: string }) {
  return message ? (
    <span className="error-text" role="alert">
      {message}
    </span>
  ) : null;
}

export default function QuoteEditor({
  data,
  quote,
  onSave,
  onCancel,
}: {
  data: AppData;
  quote?: Quote;
  onSave: (quote: Quote) => void;
  onCancel: () => void;
}) {
  const {
    register,
    control,
    handleSubmit,
    setValue,
    setError,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: quote
      ? {
          clientId: quote.clientId,
          issueDate: quote.issueDate,
          validUntil: quote.validUntil,
          paymentTerms: quote.paymentTerms,
          notes: quote.notes,
          items: quote.items,
          discountType: quote.discountType,
          discount: quote.discount,
          surcharge: quote.surcharge,
        }
      : {
          clientId: "",
          issueDate: todayISO(),
          validUntil: defaultValidity(),
          paymentTerms: "",
          notes: "",
          items: [newItem()],
          discountType: "fixed",
          discount: 0,
          surcharge: 0,
        },
  });
  const { fields, append, remove } = useFieldArray({ control, name: "items" });
  const values = useWatch({ control });
  const totals = calculateTotals(
    (values.items ?? []).map((item) => ({ quantity: item.quantity ?? 0, unitPrice: item.unitPrice ?? 0 })),
    values.discountType ?? "fixed",
    values.discount ?? 0,
    values.surcharge ?? 0,
  );

  function save(values: FormValues) {
    const client = data.clients.find((entry) => entry.id === values.clientId);
    if (!client) {
      setError("clientId", { message: "Selecione um cliente cadastrado." });
      return;
    }
    if (quote && quote.status !== "draft") return;
    onSave({
      ...values,
      id: quote?.id ?? crypto.randomUUID(),
      number: quote?.number ?? nextQuoteNumber(data.nextQuoteNumber),
      clientSnapshot: { ...client },
      status: "draft",
      createdAt: quote?.createdAt ?? new Date().toISOString(),
    });
  }

  if (quote && quote.status !== "draft") {
    return (
      <div className="panel empty">
        <p>Apenas rascunhos podem ser editados.</p>
        <button className="secondary" onClick={onCancel}>
          Voltar
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(save)} noValidate>
      <div className="page-heading">
        <div>
          <p className="eyebrow">ORÇAMENTOS</p>
          <h1>{quote ? "Editar orçamento" : "Novo orçamento"}</h1>
          <p className="muted">Organize os serviços, confira os valores e prepare sua proposta.</p>
        </div>
      </div>
      <div className="editor-layout">
        <div>
          <section className="panel">
            <div className="panel-heading">
              <h2>Informações do orçamento</h2>
              <span className="muted">{quote?.number ?? nextQuoteNumber(data.nextQuoteNumber)}</span>
            </div>
            <div className="form-grid">
              <label className="field full-width">
                Cliente *
                <select {...register("clientId")} aria-invalid={!!errors.clientId}>
                  <option value="">Selecione um cliente</option>
                  {data.clients.map((client) => (
                    <option key={client.id} value={client.id}>
                      {client.name}
                    </option>
                  ))}
                </select>
                <ErrorText message={errors.clientId?.message} />
              </label>
              <label className="field">
                Data de emissão *
                <input type="date" {...register("issueDate")} aria-invalid={!!errors.issueDate} />
                <ErrorText message={errors.issueDate?.message} />
              </label>
              <label className="field">
                Válido até *
                <input type="date" {...register("validUntil")} aria-invalid={!!errors.validUntil} />
                <ErrorText message={errors.validUntil?.message} />
              </label>
            </div>
          </section>

          <section className="panel">
            <div className="panel-heading">
              <h2>Serviços e produtos</h2>
              <span className="muted">
                {fields.length} {fields.length === 1 ? "item" : "itens"}
              </span>
            </div>
            <div className="quote-items">
              {fields.map((field, index) => (
                <div className="quote-item" key={field.id}>
                  <div className="panel-heading">
                    <strong>Item {index + 1}</strong>
                    <button
                      className="secondary"
                      type="button"
                      onClick={() => remove(index)}
                      aria-label={`Remover item ${index + 1}`}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                  <div className="form-grid">
                    <label className="field full-width">
                      Usar um serviço cadastrado
                      <select
                        value={values.items?.[index]?.serviceId ?? ""}
                        onChange={(event) => {
                          const service = data.services.find((entry) => entry.id === event.target.value);
                          setValue(`items.${index}.serviceId`, service?.id, { shouldDirty: true });
                          if (service) {
                            setValue(`items.${index}.name`, service.name, {
                              shouldDirty: true,
                              shouldValidate: true,
                            });
                            setValue(`items.${index}.unit`, service.unit, { shouldDirty: true });
                            setValue(`items.${index}.unitPrice`, service.price, {
                              shouldDirty: true,
                              shouldValidate: true,
                            });
                            setValue(`items.${index}.notes`, service.description, { shouldDirty: true });
                          }
                        }}
                      >
                        <option value="">Digitar manualmente</option>
                        {data.services.map((service) => (
                          <option key={service.id} value={service.id}>
                            {service.name} · {formatCurrency(service.price)}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="field full-width">
                      Descrição do serviço ou produto *
                      <input
                        {...register(`items.${index}.name`)}
                        placeholder="Ex.: instalação de tomada"
                        aria-invalid={!!errors.items?.[index]?.name}
                      />
                      <ErrorText message={errors.items?.[index]?.name?.message} />
                    </label>
                    <label className="field">
                      Quantidade *
                      <input
                        type="number"
                        min="0.001"
                        step="0.001"
                        {...register(`items.${index}.quantity`, { valueAsNumber: true })}
                        aria-invalid={!!errors.items?.[index]?.quantity}
                      />
                      <ErrorText message={errors.items?.[index]?.quantity?.message} />
                    </label>
                    <label className="field">
                      Unidade
                      <select {...register(`items.${index}.unit`)}>
                        {units.map((unit) => (
                          <option key={unit}>{unit}</option>
                        ))}
                      </select>
                    </label>
                    <label className="field">
                      Preço unitário (R$) *
                      <input
                        type="number"
                        min="0.01"
                        step="0.01"
                        {...register(`items.${index}.unitPrice`, { valueAsNumber: true })}
                        aria-invalid={!!errors.items?.[index]?.unitPrice}
                      />
                      <ErrorText message={errors.items?.[index]?.unitPrice?.message} />
                    </label>
                    <div className="field">
                      <span>Total do item</span>
                      <strong>
                        {formatCurrency(
                          calculateTotals(
                            [
                              {
                                quantity: values.items?.[index]?.quantity ?? 0,
                                unitPrice: values.items?.[index]?.unitPrice ?? 0,
                              },
                            ],
                            "fixed",
                            0,
                            0,
                          ).total,
                        )}
                      </strong>
                    </div>
                    <label className="field full-width">
                      Observação do item
                      <input
                        {...register(`items.${index}.notes`)}
                        placeholder="Detalhes, materiais ou condições específicas"
                      />
                    </label>
                  </div>
                </div>
              ))}
            </div>
            <ErrorText message={errors.items?.root?.message ?? errors.items?.message} />
            <button className="secondary" type="button" onClick={() => append(newItem())}>
              <Plus size={17} /> Adicionar item
            </button>
          </section>

          <section className="panel">
            <div className="panel-heading">
              <h2>Condições e observações</h2>
            </div>
            <div className="form-grid">
              <label className="field full-width">
                Condições de pagamento
                <textarea
                  rows={2}
                  {...register("paymentTerms")}
                  placeholder="Ex.: 50% na aprovação e 50% na entrega. Pix ou transferência."
                />
              </label>
              <label className="field full-width">
                Observações e prazo de execução
                <textarea
                  rows={3}
                  {...register("notes")}
                  placeholder="Ex.: execução em até 5 dias úteis após a aprovação. Materiais inclusos."
                />
              </label>
            </div>
          </section>
        </div>

        <aside className="panel quote-totals">
          <div className="panel-heading">
            <h2>Resumo dos valores</h2>
          </div>
          <div className="field">
            <span>Subtotal</span>
            <strong>{formatCurrency(totals.subtotal)}</strong>
          </div>
          <label className="field">
            Tipo de desconto
            <select {...register("discountType")}>
              <option value="fixed">Valor fixo (R$)</option>
              <option value="percent">Percentual (%)</option>
            </select>
          </label>
          <label className="field">
            Desconto {values.discountType === "percent" ? "(%)" : "(R$)"}
            <input
              type="number"
              min="0"
              max={values.discountType === "percent" ? 100 : undefined}
              step="0.01"
              {...register("discount", { valueAsNumber: true })}
              aria-invalid={!!errors.discount}
            />
            <ErrorText message={errors.discount?.message} />
          </label>
          <label className="field">
            Acréscimo (R$)
            <input
              type="number"
              min="0"
              step="0.01"
              {...register("surcharge", { valueAsNumber: true })}
              aria-invalid={!!errors.surcharge}
            />
            <ErrorText message={errors.surcharge?.message} />
          </label>
          <div className="total-final">
            <span>Total do orçamento</span>
            <strong aria-live="polite">{formatCurrency(totals.total)}</strong>
          </div>
          <p className="muted">Salvo como rascunho. Revise o documento antes de enviar ao cliente.</p>
          <div className="form-actions">
            <button type="submit" className="primary">
              <Save size={17} /> Salvar orçamento
            </button>
            <button type="button" className="secondary" onClick={onCancel}>
              Cancelar
            </button>
          </div>
        </aside>
      </div>
    </form>
  );
}
