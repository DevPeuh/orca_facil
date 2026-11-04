"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Pencil, Plus, Search, Trash2, Users, Wrench } from "lucide-react";
import { type AppData, type Business, type Client, type Service, formatCurrency } from "@/lib/domain";

interface Props {
  data: AppData;
  onChange: (next: AppData) => boolean;
}

const optionalEmail = z.string().trim().email("Informe um e-mail válido.").or(z.literal(""));
const clientSchema = z.object({
  name: z.string().trim().min(1, "Informe o nome do cliente."),
  phone: z.string().trim().min(1, "Informe o telefone."),
  email: optionalEmail,
  address: z.string().trim(),
  notes: z.string().trim(),
});
const serviceSchema = z.object({
  name: z.string().trim().min(1, "Informe o nome do serviço."),
  description: z.string().trim(),
  unit: z.enum(["serviço", "hora", "metro", "diária", "peça"]),
  price: z.number({ error: "Informe um preço válido." }).min(0.01, "O preço deve ser de pelo menos R$ 0,01."),
});
const businessSchema = z.object({
  name: z.string().trim().min(1, "Informe seu nome ou o nome da empresa."),
  phone: z.string().trim(),
  email: optionalEmail,
  address: z.string().trim(),
  document: z.string().trim(),
});
type ClientForm = z.infer<typeof clientSchema>;
type ServiceForm = z.infer<typeof serviceSchema>;
const emptyClient: ClientForm = { name: "", phone: "", email: "", address: "", notes: "" };
const emptyService: ServiceForm = { name: "", description: "", unit: "serviço", price: 0 };

export function Clients({ data, onChange }: Props) {
  const [search, setSearch] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [deleteError, setDeleteError] = useState("");
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ClientForm>({
    resolver: zodResolver(clientSchema),
    defaultValues: emptyClient,
  });
  const query = search.trim().toLocaleLowerCase("pt-BR");
  const clients = data.clients.filter((client) =>
    `${client.name} ${client.phone} ${client.email}`.toLocaleLowerCase("pt-BR").includes(query),
  );

  function openForm(client?: Client) {
    setEditingId(client?.id ?? null);
    reset(client ?? emptyClient);
    setMessage("");
    setDeleteError("");
    setFormOpen(true);
  }

  function save(values: ClientForm) {
    const client: Client = { ...values, id: editingId ?? crypto.randomUUID() };
    const saved = onChange({
      ...data,
      clients: editingId
        ? data.clients.map((current) => (current.id === editingId ? client : current))
        : [...data.clients, client],
    });
    if (!saved) return;
    setMessage(editingId ? "Cliente atualizado." : "Cliente cadastrado.");
    setFormOpen(false);
    setEditingId(null);
    reset(emptyClient);
  }

  function remove(client: Client) {
    setMessage("");
    if (data.quotes.some((quote) => quote.clientId === client.id)) {
      setDeleteError("Este cliente possui orçamentos e não pode ser excluído. Você pode editar seus dados.");
      return;
    }
    if (!window.confirm(`Excluir o cliente ${client.name}? Esta ação não pode ser desfeita.`)) return;
    const saved = onChange({ ...data, clients: data.clients.filter((current) => current.id !== client.id) });
    if (!saved) return;
    if (editingId === client.id) setFormOpen(false);
    setDeleteError("");
    setMessage("Cliente excluído.");
  }

  return (
    <>
      <div className="toolbar">
        <label className="search-field">
          <Search size={18} aria-hidden="true" />
          <input
            aria-label="Buscar clientes"
            placeholder="Buscar por nome, telefone ou e-mail"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </label>
        <button className="primary" onClick={() => openForm()}>
          <Plus size={18} /> Novo cliente
        </button>
      </div>
      {message && (
        <p className="success-message" role="status">
          {message}
        </p>
      )}
      {deleteError && (
        <p className="error-text" role="alert">
          {deleteError}
        </p>
      )}
      {formOpen && (
        <section className="panel">
          <div className="panel-heading">
            <h2>{editingId ? "Editar cliente" : "Novo cliente"}</h2>
            <p className="muted">Salve os contatos para os próximos orçamentos.</p>
          </div>
          <form className="form-grid" onSubmit={handleSubmit(save)} noValidate>
            <label className="field">
              Nome *<input {...register("name")} autoComplete="name" aria-invalid={!!errors.name} />
              {errors.name && <span className="error-text">{errors.name.message}</span>}
            </label>
            <label className="field">
              Telefone *
              <input
                {...register("phone")}
                type="tel"
                autoComplete="tel"
                placeholder="(82) 99999-9999"
                aria-invalid={!!errors.phone}
              />
              {errors.phone && <span className="error-text">{errors.phone.message}</span>}
            </label>
            <label className="field">
              E-mail
              <input {...register("email")} type="email" autoComplete="email" aria-invalid={!!errors.email} />
              {errors.email && <span className="error-text">{errors.email.message}</span>}
            </label>
            <label className="field">
              Endereço
              <input {...register("address")} autoComplete="street-address" />
            </label>
            <label className="field full-width">
              Observações
              <textarea {...register("notes")} rows={3} placeholder="Informações úteis sobre o cliente" />
            </label>
            <div className="form-actions full-width">
              <button className="secondary" type="button" onClick={() => setFormOpen(false)}>
                Cancelar
              </button>
              <button className="primary" type="submit">
                Salvar cliente
              </button>
            </div>
          </form>
        </section>
      )}
      <section className="panel">
        <div className="panel-heading">
          <h2>
            Seus clientes <span className="badge">{data.clients.length}</span>
          </h2>
        </div>
        {clients.length === 0 ? (
          <div className="empty">
            <Users size={32} />
            <h3>{query ? "Nenhum cliente encontrado" : "Seu primeiro cliente começa aqui"}</h3>
            <p>
              {query
                ? "Tente buscar por outro nome ou telefone."
                : "Cadastre os contatos e agilize a criação de orçamentos."}
            </p>
            {!query && (
              <button className="secondary" onClick={() => openForm()}>
                Cadastrar cliente
              </button>
            )}
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Cliente</th>
                  <th>Telefone</th>
                  <th>E-mail</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {clients.map((client) => (
                  <tr key={client.id}>
                    <td>
                      <strong>{client.name}</strong>
                      {client.address && <small className="muted">{client.address}</small>}
                    </td>
                    <td>{client.phone}</td>
                    <td>{client.email || "—"}</td>
                    <td>
                      <div className="row-actions">
                        <button
                          className="secondary"
                          onClick={() => openForm(client)}
                          aria-label={`Editar ${client.name}`}
                        >
                          <Pencil size={16} />
                        </button>
                        <button
                          className="danger"
                          onClick={() => remove(client)}
                          aria-label={`Excluir ${client.name}`}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}

export function Services({ data, onChange }: Props) {
  const [search, setSearch] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ServiceForm>({
    resolver: zodResolver(serviceSchema),
    defaultValues: emptyService,
  });
  const query = search.trim().toLocaleLowerCase("pt-BR");
  const services = data.services.filter((service) =>
    `${service.name} ${service.description}`.toLocaleLowerCase("pt-BR").includes(query),
  );

  function openForm(service?: Service) {
    setEditingId(service?.id ?? null);
    reset(service ?? emptyService);
    setMessage("");
    setFormOpen(true);
  }

  function save(values: ServiceForm) {
    const service: Service = {
      ...values,
      price: Math.round(values.price * 100) / 100,
      id: editingId ?? crypto.randomUUID(),
    };
    const saved = onChange({
      ...data,
      services: editingId
        ? data.services.map((current) => (current.id === editingId ? service : current))
        : [...data.services, service],
    });
    if (!saved) return;
    setMessage(editingId ? "Serviço atualizado." : "Serviço cadastrado.");
    setFormOpen(false);
    setEditingId(null);
    reset(emptyService);
  }

  function remove(service: Service) {
    if (!window.confirm(`Excluir ${service.name} do catálogo? Os orçamentos existentes serão preservados.`))
      return;
    setMessage("");
    const saved = onChange({
      ...data,
      services: data.services.filter((current) => current.id !== service.id),
    });
    if (!saved) return;
    if (editingId === service.id) setFormOpen(false);
    setMessage("Serviço excluído.");
  }

  return (
    <>
      <div className="toolbar">
        <label className="search-field">
          <Search size={18} aria-hidden="true" />
          <input
            aria-label="Buscar serviços"
            placeholder="Buscar serviço ou produto"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </label>
        <button className="primary" onClick={() => openForm()}>
          <Plus size={18} /> Novo serviço
        </button>
      </div>
      {message && (
        <p className="success-message" role="status">
          {message}
        </p>
      )}
      {formOpen && (
        <section className="panel">
          <div className="panel-heading">
            <h2>{editingId ? "Editar serviço" : "Novo serviço ou produto"}</h2>
            <p className="muted">Monte um catálogo com os itens que você mais utiliza.</p>
          </div>
          <form className="form-grid" onSubmit={handleSubmit(save)} noValidate>
            <label className="field full-width">
              Nome *
              <input
                {...register("name")}
                placeholder="Ex.: instalação de tomada"
                aria-invalid={!!errors.name}
              />
              {errors.name && <span className="error-text">{errors.name.message}</span>}
            </label>
            <label className="field">
              Unidade *
              <select {...register("unit")} aria-invalid={!!errors.unit}>
                {serviceSchema.shape.unit.options.map((unit) => (
                  <option key={unit} value={unit}>
                    {unit}
                  </option>
                ))}
              </select>
              {errors.unit && <span className="error-text">{errors.unit.message}</span>}
            </label>
            <label className="field">
              Preço unitário (R$) *
              <input
                {...register("price", { valueAsNumber: true })}
                type="number"
                min="0.01"
                step="0.01"
                inputMode="decimal"
                aria-invalid={!!errors.price}
              />
              {errors.price && <span className="error-text">{errors.price.message}</span>}
            </label>
            <label className="field full-width">
              Descrição
              <textarea {...register("description")} rows={3} placeholder="Descreva o que está incluído" />
            </label>
            <div className="form-actions full-width">
              <button className="secondary" type="button" onClick={() => setFormOpen(false)}>
                Cancelar
              </button>
              <button className="primary" type="submit">
                Salvar serviço
              </button>
            </div>
          </form>
        </section>
      )}
      <section className="panel">
        <div className="panel-heading">
          <h2>
            Seu catálogo <span className="badge">{data.services.length}</span>
          </h2>
        </div>
        {services.length === 0 ? (
          <div className="empty">
            <Wrench size={32} />
            <h3>{query ? "Nenhum serviço encontrado" : "Seus serviços, prontos para orçar"}</h3>
            <p>
              {query
                ? "Tente buscar por outro nome."
                : "Cadastre serviços e produtos para reutilizar os preços."}
            </p>
            {!query && (
              <button className="secondary" onClick={() => openForm()}>
                Cadastrar serviço
              </button>
            )}
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Serviço / produto</th>
                  <th>Unidade</th>
                  <th>Preço unitário</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {services.map((service) => (
                  <tr key={service.id}>
                    <td>
                      <strong>{service.name}</strong>
                      {service.description && <small className="muted">{service.description}</small>}
                    </td>
                    <td>{service.unit}</td>
                    <td>{formatCurrency(service.price)}</td>
                    <td>
                      <div className="row-actions">
                        <button
                          className="secondary"
                          onClick={() => openForm(service)}
                          aria-label={`Editar ${service.name}`}
                        >
                          <Pencil size={16} />
                        </button>
                        <button
                          className="danger"
                          onClick={() => remove(service)}
                          aria-label={`Excluir ${service.name}`}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}

export function BusinessSettings({ data, onChange }: Props) {
  const [saved, setSaved] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<Business>({
    resolver: zodResolver(businessSchema),
    defaultValues: data.business,
  });

  function save(business: Business) {
    setSaved(false);
    if (!onChange({ ...data, business })) return;
    setSaved(true);
  }

  return (
    <section className="panel">
      <div className="panel-heading">
        <h2>Dados do prestador</h2>
        <p className="muted">Estas informações aparecem no documento do orçamento.</p>
      </div>
      <form className="form-grid" onSubmit={handleSubmit(save)} onChange={() => setSaved(false)} noValidate>
        <label className="field full-width">
          Seu nome ou nome da empresa *
          <input {...register("name")} autoComplete="organization" aria-invalid={!!errors.name} />
          {errors.name && <span className="error-text">{errors.name.message}</span>}
        </label>
        <label className="field">
          Telefone
          <input {...register("phone")} type="tel" autoComplete="tel" placeholder="(82) 99999-9999" />
        </label>
        <label className="field">
          E-mail
          <input {...register("email")} type="email" autoComplete="email" aria-invalid={!!errors.email} />
          {errors.email && <span className="error-text">{errors.email.message}</span>}
        </label>
        <label className="field">
          CPF / CNPJ (opcional)
          <input {...register("document")} />
        </label>
        <label className="field">
          Endereço
          <input {...register("address")} autoComplete="street-address" />
        </label>
        <div className="form-actions full-width">
          {saved && (
            <span className="success-message" role="status">
              Dados salvos.
            </span>
          )}
          <button className="primary" type="submit">
            Salvar dados
          </button>
        </div>
      </form>
    </section>
  );
}
