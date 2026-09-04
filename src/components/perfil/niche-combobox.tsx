"use client";

import * as React from "react";
import { Search, ChevronDown, Check, CornerDownLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { NICHE_OPTIONS, OUTRO_NICHO } from "@/lib/config/niches";

/**
 * COMBOBOX DE NICHOS — roda #291
 * ==============================
 * Campo pesquisável para o "Nicho" do Perfil.
 *
 * - Abre uma lista agrupada com busca (sem acento) sobre NICHE_OPTIONS.
 * - Selecionar um item grava o rótulo (string simples) no estado `niche`.
 * - "Outro" revela um campo de texto livre para nicho personalizado — o valor
 *   digitado é o que será salvo (nunca persiste a palavra "Outro").
 * - O valor salvo continua sendo a MESMA string de UserProfile.niche usada
 *   pela IA (src/lib/ai/context.ts) — sem sistema duplo.
 * - Limite de 80 caracteres alinhado ao validator do PATCH /api/perfil.
 */

interface NicheComboboxProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

const norm = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();

const fieldCls =
  "h-11 w-full rounded-[12px] border border-border bg-bg-ice px-3.5 text-[14px] text-ink placeholder:text-ink-muted focus:border-purple/50 focus:ring-2 focus:ring-purple/20 focus:outline-none transition-shadow";

export function NicheCombobox({
  value,
  onChange,
  placeholder = "Buscar ou digitar nicho…",
}: NicheComboboxProps) {
  const [open, setOpen] = React.useState(false);
  const [custom, setCustom] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const wrapRef = React.useRef<HTMLDivElement>(null);
  const searchRef = React.useRef<HTMLInputElement>(null);

  const trimmedQuery = query.trim();
  const normalizedQuery = norm(trimmedQuery);

  /** Fecha ao clicar fora e com Esc. */
  React.useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent | TouchEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("touchstart", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("touchstart", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  React.useEffect(() => {
    if (open) searchRef.current?.focus();
  }, [open]);

  const filtered = React.useMemo(() => {
    if (!normalizedQuery) return NICHE_OPTIONS;
    return NICHE_OPTIONS.filter((o) => norm(o.label).includes(normalizedQuery));
  }, [normalizedQuery]);

  const groups = React.useMemo(() => {
    const map = new Map<string, typeof filtered>();
    for (const o of filtered) {
      const arr = map.get(o.group) ?? [];
      arr.push(o);
      map.set(o.group, arr);
    }
    return Array.from(map.entries());
  }, [filtered]);

  const hasExactMatch = NICHE_OPTIONS.some((o) => norm(o.label) === normalizedQuery);
  const outroVisible = !filtered.some((o) => o.label === OUTRO_NICHO);

  function openPanel() {
    setQuery(value);
    setOpen(true);
  }

  function selectOption(label: string) {
    onChange(label);
    setQuery(label);
    setOpen(false);
  }

  function chooseOutro() {
    // Se o usuário digitou algo que não existe na lista, reaproveita como prefill.
    const prefill = normalizedQuery && !hasExactMatch ? trimmedQuery : "";
    onChange(prefill);
    setOpen(false);
    setCustom(true);
  }

  // ---- Modo nicho personalizado ("Outro") ----
  if (custom) {
    return (
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center gap-2">
          <input
            autoFocus
            maxLength={80}
            className={fieldCls}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="Digite seu nicho personalizado"
          />
          <button
            type="button"
            onClick={() => {
              setCustom(false);
              setOpen(true);
            }}
            className="h-11 flex-none inline-flex items-center gap-1.5 px-3 rounded-[12px] border border-border bg-surface text-[13px] font-semibold text-ink-soft hover:text-ink hover:border-purple/30 transition-colors cursor-pointer"
            title="Voltar à lista de nichos"
          >
            <Search size={14} />
            <span className="hidden sm:inline">Lista</span>
          </button>
        </div>
        <p className="text-[11.5px] text-ink-muted">
          Nicho personalizado — é usado pela IA e aparece no seu perfil.
        </p>
      </div>
    );
  }

  const triggerValue = value.trim();

  return (
    <div className="relative" ref={wrapRef}>
      {/* Gatilho */}
      <button
        type="button"
        onClick={() => (open ? setOpen(false) : openPanel())}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={cn(
          fieldCls,
          "flex items-center justify-between gap-2 cursor-pointer text-left",
          !triggerValue && "text-ink-muted"
        )}
      >
        <span className="truncate">{triggerValue || placeholder}</span>
        <ChevronDown
          size={16}
          className={cn(
            "text-ink-muted flex-none transition-transform duration-200",
            open && "rotate-180"
          )}
        />
      </button>

      {/* Painel */}
      {open && (
        <div
          role="listbox"
          className="absolute top-full mt-2 z-50 w-full min-w-[260px] bg-card border border-border-soft rounded-xl shadow-lg overflow-hidden animate-[fade-slide_.22s_var(--ease-out)]"
        >
          {/* Busca */}
          <div className="p-2 border-b border-border-soft">
            <div className="relative">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted" />
              <input
                ref={searchRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Filtrar nichos…"
                className="h-10 w-full rounded-lg border border-border bg-bg-ice pl-9 pr-3 text-[13.5px] text-ink placeholder:text-ink-muted focus:border-purple/50 focus:ring-2 focus:ring-purple/20 focus:outline-none"
              />
            </div>
          </div>

          {/* Opções agrupadas */}
          <div className="max-h-64 overflow-y-auto p-1.5">
            {groups.map(([group, options]) => (
              <div key={group} className="flex flex-col">
                <span className="px-2.5 pt-2 pb-1 text-[10.5px] font-bold uppercase tracking-wider text-ink-muted">
                  {group}
                </span>
                {options.map((o) => {
                  const selected = o.label === triggerValue;
                  return (
                    <button
                      key={o.label}
                      type="button"
                      role="option"
                      aria-selected={selected}
                      onClick={() =>
                        o.label === OUTRO_NICHO ? chooseOutro() : selectOption(o.label)
                      }
                      className={cn(
                        "w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-[13px] text-left transition-colors cursor-pointer",
                        selected
                          ? "bg-ai-soft text-purple font-semibold"
                          : "text-ink-soft hover:bg-surface hover:text-ink"
                      )}
                    >
                      <span className="flex-1 truncate">{o.label}</span>
                      {selected && <Check size={15} className="flex-none text-purple" />}
                    </button>
                  );
                })}
              </div>
            ))}

            {filtered.length === 0 && (
              <div className="flex flex-col gap-1 px-2.5 py-3">
                <p className="text-[12.5px] text-ink-muted">
                  Nenhum nicho encontrado para “{trimmedQuery}”.
                </p>
                <button
                  type="button"
                  onClick={chooseOutro}
                  className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-purple hover:text-purple/80 transition-colors cursor-pointer self-start"
                >
                  <CornerDownLeft size={13} />
                  Criar nicho personalizado
                </button>
              </div>
            )}
          </div>

          {/* "Outro" fixo quando o filtro o esconde */}
          {outroVisible && filtered.length > 0 && (
            <div className="border-t border-border-soft p-1.5">
              <button
                type="button"
                onClick={chooseOutro}
                className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-[13px] font-semibold text-ink-soft hover:bg-surface hover:text-purple transition-colors cursor-pointer"
              >
                {OUTRO_NICHO}
                <span className="ml-auto text-[11px] font-medium text-ink-muted">
                  escrever texto livre
                </span>
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
