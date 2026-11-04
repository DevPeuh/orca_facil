"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  Check,
  ChevronRight,
  Copy,
  FileText,
  LayoutDashboard,
  Plus,
  Search,
  Settings,
  Users,
  Wrench,
  X,
} from "lucide-react";
import {
  type AppData,
  type Quote,
  type QuoteStatus,
  calculateTotals,
  canTransitionStatus,
  formatCurrency,
  formatDate,
  getQuoteStatus,
  nextQuoteNumber,
  statusLabels,
  todayISO,
} from "@/lib/domain";
import { exportBackup, loadData, parseBackup, saveData } from "@/lib/storage";
import { Clients, Services, BusinessSettings } from "@/components/catalogs";
import QuoteEditor from "@/components/quote-editor";
import QuoteDocument from "@/components/quote-document";

type Page = "dashboard" | "quotes" | "clients" | "services" | "settings";
const navigation = [
  { id: "dashboard", label: "Visão geral", icon: LayoutDashboard },
  { id: "quotes", label: "Orçamentos", icon: FileText },
  { id: "clients", label: "Clientes", icon: Users },
  { id: "services", label: "Serviços", icon: Wrench },
  { id: "settings", label: "Meu negócio", icon: Settings },
] as const;
const totalOf = (quote: Quote) =>
  calculateTotals(quote.items, quote.discountType, quote.discount, quote.surcharge).total;

export default function Home() {
  const [data, setData] = useState<AppData | null>(null);
  const [page, setPage] = useState<Page>("dashboard");
  const [editor, setEditor] = useState<Quote | "new" | null>(null);
  const [previewQuote, setPreviewQuote] = useState<Quote | null>(null);
  const [message, setMessage] = useState("");
  const [loadError, setLoadError] = useState("");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<QuoteStatus | "all">("all");
  const [today, setToday] = useState(todayISO);
  const importInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- Lê o localStorage após a hidratação.
      setData(loadData());
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Não foi possível ler os dados locais.");
    }
    const refreshDate = () => setToday(todayISO());
    const timer = window.setInterval(refreshDate, 60_000);
    window.addEventListener("focus", refreshDate);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", refreshDate);
    };
  }, []);

  function persist(next: AppData) {
    try {
      saveData(next);
      setData(next);
      return true;
    } catch {
      setMessage(
        "Não foi possível salvar. Verifique o espaço e as permissões do navegador. Seus dados anteriores foram mantidos.",
      );
      return false;
    }
  }

  function navigate(next: Page) {
    setPage(next);
    setEditor(null);
    setPreviewQuote(null);
    setMessage("");
  }

  function newQuote() {
    if (!data?.clients.length) {
      navigate("clients");
      setMessage("Cadastre um cliente para criar seu primeiro orçamento.");
      return;
    }
    setEditor("new");
    setPreviewQuote(null);
    setPage("quotes");
    setMessage("");
  }

  function saveQuote(quote: Quote) {
    if (!data) return;
    const exists = data.quotes.some((item) => item.id === quote.id);
    const next = {
      ...data,
      quotes: exists
        ? data.quotes.map((item) => (item.id === quote.id ? quote : item))
        : [quote, ...data.quotes],
      nextQuoteNumber: data.nextQuoteNumber + (exists ? 0 : 1),
    };
    if (persist(next)) {
      setEditor(null);
      setPage("quotes");
      setMessage("Orçamento salvo.");
    }
  }

  function changeStatus(quote: Quote, nextStatus: QuoteStatus) {
    if (!data || !canTransitionStatus(getQuoteStatus(quote, today), nextStatus)) return;
    if (nextStatus === "sent" && quote.validUntil < today) {
      setMessage("A validade já passou. Edite o rascunho antes de marcar como enviado.");
      return;
    }
    if (
      !window.confirm(
        `Marcar ${quote.number} como ${statusLabels[nextStatus].toLowerCase()}? Depois de enviado, o orçamento não poderá ser editado. Você poderá duplicá-lo.`,
      )
    )
      return;
    if (
      persist({
        ...data,
        quotes: data.quotes.map((item) => (item.id === quote.id ? { ...item, status: nextStatus } : item)),
      })
    )
      setMessage("Status atualizado.");
  }

  function duplicateQuote(quote: Quote) {
    if (!data) return;
    const validUntil = new Date(`${today}T12:00:00`);
    validUntil.setDate(validUntil.getDate() + 15);
    const date = `${validUntil.getFullYear()}-${String(validUntil.getMonth() + 1).padStart(2, "0")}-${String(validUntil.getDate()).padStart(2, "0")}`;
    const copy: Quote = {
      ...quote,
      id: crypto.randomUUID(),
      number: nextQuoteNumber(data.nextQuoteNumber),
      status: "draft",
      issueDate: today,
      validUntil: date,
      createdAt: new Date().toISOString(),
      items: quote.items.map((item) => ({ ...item, id: crypto.randomUUID() })),
    };
    if (persist({ ...data, nextQuoteNumber: data.nextQuoteNumber + 1, quotes: [copy, ...data.quotes] })) {
      setEditor(copy);
      setMessage("Cópia criada como rascunho.");
    }
  }

  async function restoreBackup(file?: File) {
    if (!file) return;
    try {
      if (file.size > 5 * 1024 * 1024) throw new Error("O backup deve ter no máximo 5 MB.");
      const restored = parseBackup(await file.text());
      if (
        !window.confirm(
          `Restaurar ${restored.clients.length} clientes, ${restored.services.length} serviços e ${restored.quotes.length} orçamentos? Isso substituirá os dados deste navegador.`,
        )
      )
        return;
      if (persist(restored)) {
        setLoadError("");
        setPage("dashboard");
        setEditor(null);
        setPreviewQuote(null);
        setMessage("Backup restaurado.");
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Não foi possível restaurar o arquivo.");
    } finally {
      if (importInput.current) importInput.current.value = "";
    }
  }

  function quoteRows(quotes: Quote[]) {
    return (
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Orçamento / cliente</th>
              <th>Emissão</th>
              <th>Valor</th>
              <th>Status</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {quotes.map((quote) => {
              const effectiveStatus = getQuoteStatus(quote, today);
              return (
                <tr key={quote.id}>
                  <td>
                    <button className="text-button quote-link" onClick={() => setPreviewQuote(quote)}>
                      {quote.number}
                    </button>
                    <small>{quote.clientSnapshot.name}</small>
                  </td>
                  <td>{formatDate(quote.issueDate)}</td>
                  <td className="amount">{formatCurrency(totalOf(quote))}</td>
                  <td>
                    <span className={`badge ${effectiveStatus}`}>{statusLabels[effectiveStatus]}</span>
                  </td>
                  <td>
                    <div className="row-actions">
                      <button className="text-button" onClick={() => setPreviewQuote(quote)}>
                        Ver
                      </button>
                      {effectiveStatus === "draft" && (
                        <>
                          <button
                            className="text-button"
                            onClick={() => {
                              setEditor(quote);
                              setPage("quotes");
                            }}
                          >
                            Editar
                          </button>
                          <button className="text-button" onClick={() => changeStatus(quote, "sent")}>
                            Marcar enviado
                          </button>
                        </>
                      )}
                      {effectiveStatus === "sent" && (
                        <>
                          <button
                            title="Marcar como aceito"
                            aria-label={`Aceitar ${quote.number}`}
                            className="icon-button"
                            onClick={() => changeStatus(quote, "accepted")}
                          >
                            <Check size={16} />
                          </button>
                          <button
                            title="Marcar como recusado"
                            aria-label={`Recusar ${quote.number}`}
                            className="icon-button"
                            onClick={() => changeStatus(quote, "rejected")}
                          >
                            <X size={16} />
                          </button>
                        </>
                      )}
                      <button
                        title="Duplicar orçamento"
                        aria-label={`Duplicar ${quote.number}`}
                        className="icon-button"
                        onClick={() => duplicateQuote(quote)}
                      >
                        <Copy size={15} />
                      </button>
                      <button
                        className="text-button danger-text"
                        onClick={() => {
                          if (
                            data &&
                            window.confirm(`Excluir ${quote.number}? Esta ação não pode ser desfeita.`)
                          )
                            persist({ ...data, quotes: data.quotes.filter((item) => item.id !== quote.id) });
                        }}
                      >
                        Excluir
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  }

  const monthQuotes = data?.quotes.filter((quote) => quote.issueDate.startsWith(today.slice(0, 7))) ?? [];
  const search = query.toLocaleLowerCase("pt-BR");
  const filteredQuotes =
    data?.quotes.filter(
      (quote) =>
        (status === "all" || getQuoteStatus(quote, today) === status) &&
        `${quote.number} ${quote.clientSnapshot.name}`
          .toLocaleLowerCase("pt-BR")
          .includes(search),
    ) ?? [];
  const heading = {
    dashboard: "Seu negócio, em dia.",
    quotes: "Orçamentos",
    clients: "Clientes",
    services: "Serviços e produtos",
    settings: "Meu negócio",
  }[page];

  return (
    <div className="app-shell">
      <aside className="no-print">
        <Link className="brand" href="/">
          <span className="brand-icon">
            <FileText size={22} />
          </span>
          <span>
            OrçaFácil<span className="brand-dot">.</span>
          </span>
        </Link>
        <p className="nav-label">SEU NEGÓCIO</p>
        <nav aria-label="Navegação principal">
          {navigation.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              className={page === id ? "active" : ""}
              aria-current={page === id ? "page" : undefined}
              onClick={() => navigate(id)}
            >
              <Icon size={18} />
              {label}
            </button>
          ))}
        </nav>
        <div className="local-note">
          Seu trabalho merece
          <br />
          <strong>um bom orçamento.</strong>
          <p>Organize hoje. Cresça no seu ritmo.</p>
          <span className="local-tag">● Salvo neste navegador</span>
        </div>
      </aside>
      <main>
        <header className="no-print">
          <span>
            {data?.business.name || "Seu espaço de trabalho"} <ChevronRight size={12} />{" "}
            {navigation.find((item) => item.id === page)?.label}
          </span>
          <span className="version-pill">Versão local · MVP</span>
        </header>
        <section className="page-content">
          <input
            ref={importInput}
            type="file"
            accept="application/json,.json"
            hidden
            onChange={(event) => void restoreBackup(event.target.files?.[0])}
          />
          {message && (
            <div className="notice no-print" role="status">
              <span>{message}</span>
              <button aria-label="Fechar aviso" onClick={() => setMessage("")}>
                <X size={16} />
              </button>
            </div>
          )}
          {loadError ? (
            <section className="panel empty">
              <h1>Seus dados precisam de atenção</h1>
              <p>{loadError}</p>
              <p>
                Os dados salvos foram preservados. Você pode restaurar um backup ou tentar recarregar a
                página.
              </p>
              <button className="primary" onClick={() => importInput.current?.click()}>
                Restaurar backup
              </button>
              <button className="secondary" onClick={() => window.location.reload()}>
                Tentar novamente
              </button>
            </section>
          ) : !data ? (
            <div className="empty" role="status">
              Carregando seus orçamentos…
            </div>
          ) : previewQuote ? (
            <QuoteDocument quote={previewQuote} business={data.business} onClose={() => setPreviewQuote(null)} />
          ) : editor ? (
            <QuoteEditor
              data={data}
              quote={editor === "new" ? undefined : editor}
              onSave={saveQuote}
              onCancel={() => setEditor(null)}
            />
          ) : (
            <>
              <div className="page-heading">
                <div>
                  {page === "dashboard" && <p className="eyebrow">MENOS PAPELADA, MAIS TRABALHO</p>}
                  <h1>{heading}</h1>
                  <p>
                    {
                      {
                        dashboard: "Crie, organize e acompanhe seus orçamentos em um só lugar.",
                        quotes: "Do primeiro contato ao próximo trabalho fechado.",
                        clients: "Quem confia no seu trabalho, sempre por perto.",
                        services: "Seus preços organizados. Seus próximos orçamentos mais rápidos.",
                        settings: "Seus dados aparecem no documento que você entrega ao cliente.",
                      }[page]
                    }
                  </p>
                </div>
                {(page === "dashboard" || page === "quotes") && (
                  <button className="primary" onClick={newQuote}>
                    <Plus size={17} /> Novo orçamento
                  </button>
                )}
              </div>
              {page === "dashboard" && (
                <>
                  <div className="stats">
                    <article className="stat">
                      <p>
                        Total orçado no mês <FileText size={16} />
                      </p>
                      <strong>
                        {formatCurrency(monthQuotes.reduce((sum, quote) => sum + totalOf(quote), 0))}
                      </strong>
                      <small>Inclui rascunhos e todos os status</small>
                    </article>
                    {(["accepted", "sent", "rejected"] as const).map((item) => (
                      <article className="stat" key={item}>
                        <p>
                          {
                            {
                              accepted: "Aceitos no mês",
                              sent: "Aguardando resposta",
                              rejected: "Recusados no mês",
                            }[item]
                          }
                          <span className={`stat-dot ${item}`} />
                        </p>
                        <strong>
                          {
                            (item === "sent" ? data.quotes : monthQuotes).filter(
                              (quote) => getQuoteStatus(quote, today) === item,
                            ).length
                          }
                        </strong>
                        <small>
                          {item === "sent"
                            ? "Enviados dentro da validade"
                            : "Por mês de emissão do orçamento"}
                        </small>
                      </article>
                    ))}
                  </div>
                  <section className="panel">
                    <div className="panel-heading">
                      <h2>Últimos orçamentos</h2>
                      <button className="text-button" onClick={() => navigate("quotes")}>
                        Ver todos <ChevronRight size={14} />
                      </button>
                    </div>
                    {data.quotes.length ? (
                      quoteRows(data.quotes.slice(0, 5))
                    ) : (
                      <div className="empty">
                        <div className="empty-symbol">
                          <FileText size={27} />
                        </div>
                        <h2>Seu próximo trabalho começa aqui</h2>
                        <p>
                          Cadastre um cliente, adicione os serviços e transforme sua proposta em um orçamento
                          profissional.
                        </p>
                        <button className="primary" onClick={newQuote}>
                          Criar meu primeiro orçamento <Plus size={16} />
                        </button>
                      </div>
                    )}
                  </section>
                  <div className="getting-started">
                    <div>
                      <span>01</span>
                      <h3>Cadastre seus clientes</h3>
                      <p>Reaproveite os dados a cada novo pedido.</p>
                      <button className="text-button" onClick={() => navigate("clients")}>
                        Ir para clientes <ChevronRight size={14} />
                      </button>
                    </div>
                    <div>
                      <span>02</span>
                      <h3>Organize seus serviços</h3>
                      <p>Deixe seus preços prontos para usar.</p>
                      <button className="text-button" onClick={() => navigate("services")}>
                        Ir para serviços <ChevronRight size={14} />
                      </button>
                    </div>
                    <div>
                      <span>03</span>
                      <h3>Apresente seu trabalho</h3>
                      <p>Inclua seus dados no orçamento impresso.</p>
                      <button className="text-button" onClick={() => navigate("settings")}>
                        Completar meu negócio <ChevronRight size={14} />
                      </button>
                    </div>
                  </div>
                </>
              )}
              {page === "quotes" && (
                <>
                  <div className="toolbar">
                    <label className="search-field">
                      <Search size={17} />
                      <input
                        aria-label="Buscar orçamento por número ou cliente"
                        placeholder="Buscar número ou cliente…"
                        value={query}
                        onChange={(event) => setQuery(event.target.value)}
                      />
                    </label>
                    <select
                      aria-label="Filtrar por status"
                      value={status}
                      onChange={(event) => setStatus(event.target.value as typeof status)}
                    >
                      <option value="all">Todos os status</option>
                      {Object.entries(statusLabels).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                    <span className="muted">{filteredQuotes.length} orçamento(s)</span>
                  </div>
                  <section className="panel">
                    {filteredQuotes.length ? (
                      quoteRows(filteredQuotes)
                    ) : (
                      <div className="empty">
                        <h2>
                          {data.quotes.length
                            ? "Nenhum orçamento encontrado"
                            : "Tudo pronto para o primeiro orçamento"}
                        </h2>
                        <p>
                          {data.quotes.length
                            ? "Tente outro cliente, número ou status."
                            : "Comece com um cliente e os itens do serviço."}
                        </p>
                        {!data.quotes.length && (
                          <button className="primary" onClick={newQuote}>
                            Novo orçamento
                          </button>
                        )}
                      </div>
                    )}
                  </section>
                </>
              )}
              {page === "clients" && <Clients data={data} onChange={persist} />}
              {page === "services" && <Services data={data} onChange={persist} />}
              {page === "settings" && (
                <>
                  <BusinessSettings data={data} onChange={persist} />
                  <section className="panel backup-panel">
                    <h2>Seus dados, com você</h2>
                    <p>
                      Os cadastros ficam neste navegador. Exporte um backup regularmente para não perder seus
                      dados ao limpar o navegador ou trocar de computador. Use uma aba por vez para editar.
                    </p>
                    <div className="form-actions">
                      <button className="secondary" onClick={() => exportBackup(data)}>
                        <ArrowDownToLine size={16} /> Exportar backup
                      </button>
                      <button className="secondary" onClick={() => importInput.current?.click()}>
                        <ArrowUpFromLine size={16} /> Restaurar backup
                      </button>
                    </div>
                  </section>
                </>
              )}
            </>
          )}
          <footer className="no-print">
            OrçaFácil <span>Feito para valorizar o seu trabalho.</span>
          </footer>
        </section>
      </main>
    </div>
  );
}
