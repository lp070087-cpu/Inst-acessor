"use client";

import * as React from "react";
import { Images, RefreshCw, AlertTriangle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { EmptyState } from "@/components/ui/empty-state";
import { MediaGrid, MediaGridSkeleton, LoadMoreButton } from "./media-grid";
import type { MediaAssetView } from "@/lib/media-library";

/**
 * SELETOR DA BIBLIOTECA (usado DENTRO do Preview Social)
 * =====================================================
 * Permite trazer mídias já enviadas em vez de reenviar do dispositivo — é o que
 * fecha o ciclo "enviei uma vez, reutilizo sempre".
 *
 * `multiple` é decidido pelo FORMATO do preview, não pelo usuário:
 *   Post / Story / Reel → uma mídia
 *   Carrossel           → várias
 * Assim não existe a situação de escolher 5 fotos para um Story (onde 4 seriam
 * descartadas em silêncio).
 *
 * A lista é paginada igual à da Biblioteca: 24 por vez, com "carregar mais".
 */

interface MediaPickerProps {
  open: boolean;
  onClose: () => void;
  multiple: boolean;
  /** Restringe a vídeo (Reel). `undefined` = qualquer tipo. */
  onlyType?: "IMAGE" | "VIDEO";
  onConfirm: (items: MediaAssetView[]) => void;
}

export function MediaPicker({
  open,
  onClose,
  multiple,
  onlyType,
  onConfirm,
}: MediaPickerProps) {
  const [items, setItems] = React.useState<MediaAssetView[]>([]);
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [cursor, setCursor] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [loadingMore, setLoadingMore] = React.useState(false);
  const [error, setError] = React.useState(false);

  const loadingRef = React.useRef(false);

  const fetchPage = React.useCallback(
    async (reset: boolean) => {
      if (loadingRef.current) return;
      loadingRef.current = true;
      if (reset) {
        setLoading(true);
        setError(false);
      } else setLoadingMore(true);

      try {
        const params = new URLSearchParams();
        if (onlyType) params.set("type", onlyType);
        if (!reset && cursor) params.set("before", cursor);

        const res = await fetch(`/api/media-library?${params.toString()}`);
        if (!res.ok) throw new Error("falha");
        const data = (await res.json()) as { items: MediaAssetView[]; nextCursor: string | null };

        setItems((prev) => (reset ? data.items : [...prev, ...data.items]));
        setCursor(data.nextCursor);
      } catch {
        setError(true);
      } finally {
        loadingRef.current = false;
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [onlyType, cursor]
  );

  // Só busca quando o modal ABRE — não gasta requisição enquanto está fechado.
  // E recomeça do zero a cada abertura, para refletir mídias recém-enviadas.
  React.useEffect(() => {
    if (!open) return;
    setSelected(new Set());
    setCursor(null);
    setItems([]);
    void fetchPage(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, onlyType]);

  function toggle(id: string) {
    setSelected((prev) => {
      if (!multiple) {
        // Seleção única: escolher outra troca a anterior, em vez de acumular.
        return prev.has(id) ? new Set() : new Set([id]);
      }
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const escolhidos = React.useMemo(
    () => items.filter((i) => selected.has(i.id)),
    [items, selected]
  );

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Escolher da Biblioteca"
      description={
        multiple
          ? "Selecione as mídias que vão compor o carrossel. Você pode reordenar depois."
          : onlyType === "VIDEO"
            ? "Selecione um vídeo para o Reel."
            : "Selecione a mídia do preview."
      }
      size="lg"
    >
      <div className="flex flex-col gap-4">
        {loading ? (
          <MediaGridSkeleton count={9} />
        ) : error ? (
          <div className="flex flex-col items-center gap-3 py-8 text-center">
            <AlertTriangle size={22} className="text-danger" />
            <p className="text-[13px] text-ink-soft">Não foi possível carregar suas mídias.</p>
            <Button variant="outline" onClick={() => void fetchPage(true)} className="gap-2">
              <RefreshCw size={14} /> Tentar novamente
            </Button>
          </div>
        ) : items.length === 0 ? (
          <EmptyState
            icon={Images}
            title="Nenhuma mídia na biblioteca"
            description="Envie fotos e vídeos na Biblioteca de Mídia para reutilizá-los aqui."
          />
        ) : (
          <>
            <div className="max-h-[52vh] overflow-y-auto pr-1">
              <MediaGrid items={items} selectedIds={selected} onToggle={toggle} />
              {cursor && (
                <div className="pt-3">
                  <LoadMoreButton loading={loadingMore} onClick={() => void fetchPage(false)} />
                </div>
              )}
            </div>

            <div className="flex items-center justify-between gap-3 border-t border-border-soft pt-3">
              <span className="text-[12.5px] text-ink-muted">
                {selected.size === 0
                  ? multiple
                    ? "Nenhuma selecionada"
                    : "Nenhuma selecionada"
                  : `${selected.size} ${selected.size === 1 ? "selecionada" : "selecionadas"}`}
              </span>
              <div className="flex items-center gap-2">
                <Button variant="ghost" onClick={onClose}>
                  Cancelar
                </Button>
                <Button
                  onClick={() => {
                    onConfirm(escolhidos);
                    onClose();
                  }}
                  disabled={escolhidos.length === 0}
                >
                  Usar {escolhidos.length > 1 ? `${escolhidos.length} mídias` : "mídia"}
                </Button>
              </div>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
