import { useState, useEffect, useCallback, useMemo } from "react";
import { useLocation } from "wouter";
import {
  Maximize2,
  Minimize2,
  Plus,
  X,
  Grid2x2,
  Columns2,
  LayoutGrid,
  ArrowLeft,
  AlertCircle,
} from "lucide-react";
import { GoldButton } from "@/components/premium/PremiumComponents";

// ─── Types ───────────────────────────────────────────────────────────────────

type LayoutMode = "2-col" | "3-asym" | "4-grid";

interface TableSlot {
  id: string;
  name: string;
  maximized: boolean;
}

// ─── Layout helpers ──────────────────────────────────────────────────────────

function getLayoutClass(layout: LayoutMode, tableCount: number): string {
  if (tableCount === 1) return "grid-cols-1 grid-rows-1";
  switch (layout) {
    case "2-col":
      return "grid-cols-2 grid-rows-1";
    case "3-asym":
      return "grid-cols-2 grid-rows-2";
    case "4-grid":
      return "grid-cols-2 grid-rows-2";
    default:
      return "grid-cols-2 grid-rows-1";
  }
}

function getCellClass(layout: LayoutMode, index: number): string {
  if (layout === "3-asym" && index === 0) {
    return "row-span-2";
  }
  return "";
}

function autoLayout(count: number): LayoutMode {
  if (count <= 2) return "2-col";
  if (count === 3) return "3-asym";
  return "4-grid";
}

// ─── Mini Lobby Picker ──────────────────────────────────────────────────────

function AddTablePicker({
  onAdd,
  onClose,
  existingIds,
}: {
  onAdd: (id: string, name: string) => void;
  onClose: () => void;
  existingIds: Set<string>;
}) {
  const [tables, setTables] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/tables")
      .then((r) => r.json())
      .then((data) => {
        setTables(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const available = tables.filter((t) => !existingIds.has(String(t.id)));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-xl border border-amber-500/30 bg-zinc-900 p-6 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-amber-400">Add Table</h3>
          <button onClick={onClose} className="text-zinc-400 hover:text-white">
            <X size={20} />
          </button>
        </div>

        {loading ? (
          <p className="py-8 text-center text-zinc-500">Loading tables...</p>
        ) : available.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-8 text-zinc-500">
            <AlertCircle size={24} />
            <p>No available tables to join</p>
          </div>
        ) : (
          <div className="max-h-64 space-y-2 overflow-y-auto pr-1">
            {available.map((table) => (
              <button
                key={table.id}
                onClick={() => onAdd(String(table.id), table.name || `Table #${String(table.id).slice(0, 6)}`)}
                className="flex w-full items-center justify-between rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-3 text-left transition hover:border-amber-500/50 hover:bg-zinc-700"
              >
                <div>
                  <p className="font-medium text-white">
                    {table.name || `Table #${String(table.id).slice(0, 6)}`}
                  </p>
                  <p className="text-xs text-zinc-400">
                    {table.playerCount ?? 0}/{table.maxPlayers ?? 9} players
                    {table.smallBlind && table.bigBlind
                      ? ` · ${table.smallBlind}/${table.bigBlind}`
                      : ""}
                  </p>
                </div>
                <Plus size={16} className="text-amber-400" />
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Table Cell ──────────────────────────────────────────────────────────────

function TableCell({
  table,
  onToggleMaximize,
  onRemove,
  isMaximized,
  cellClass,
}: {
  table: TableSlot;
  onToggleMaximize: () => void;
  onRemove: () => void;
  isMaximized: boolean;
  cellClass: string;
}) {
  return (
    <div
      className={`relative overflow-hidden border border-zinc-800 bg-black ${cellClass} ${
        isMaximized ? "fixed inset-0 z-40" : ""
      }`}
    >
      {/* Toolbar */}
      <div className="absolute left-0 right-0 top-0 z-10 flex items-center justify-between bg-gradient-to-b from-black/80 to-transparent px-3 py-1.5">
        <span className="text-xs font-medium text-zinc-400 truncate max-w-[60%]">
          {table.name}
        </span>
        <div className="flex items-center gap-1">
          <button
            onClick={onToggleMaximize}
            className="rounded p-1 text-zinc-500 hover:bg-zinc-800 hover:text-white"
            title={isMaximized ? "Restore" : "Maximize"}
          >
            {isMaximized ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
          </button>
          <button
            onClick={onRemove}
            className="rounded p-1 text-zinc-500 hover:bg-red-900/60 hover:text-red-400"
            title="Remove table"
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {/* Game iframe */}
      <iframe
        src={`/game/${table.id}?compact=true`}
        className="h-full w-full border-0"
        title={`Table ${table.name}`}
        allow="autoplay"
      />
    </div>
  );
}

// ─── Main Multi-Table Page ──────────────────────────────────────────────────

export default function MultiTable({ maxTables: maxTablesProp }: { maxTables?: number } = {}) {
  const [, navigate] = useLocation();
  const [maxTables, setMaxTables] = useState(maxTablesProp || 4);

  // Fetch user's multi-table limit from server if not provided via prop
  useEffect(() => {
    if (maxTablesProp) return;
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((data) => {
        if (data?.multiTableLimit && typeof data.multiTableLimit === "number") {
          setMaxTables(data.multiTableLimit);
        }
      })
      .catch(() => {});
  }, [maxTablesProp]);

  // Parse table IDs from query string
  const initialTableIds = useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    const raw = params.get("tables") || "";
    return raw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  }, []);

  const [tables, setTables] = useState<TableSlot[]>(() =>
    initialTableIds.map((id) => ({
      id,
      name: `Table #${id.slice(0, 6).toUpperCase()}`,
      maximized: false,
    }))
  );

  const [layout, setLayout] = useState<LayoutMode>(() => autoLayout(initialTableIds.length));
  const [showPicker, setShowPicker] = useState(false);
  const [maximizedId, setMaximizedId] = useState<string | null>(null);

  // Fetch real table names
  useEffect(() => {
    tables.forEach((t) => {
      fetch(`/api/tables/${t.id}`)
        .then((r) => r.json())
        .then((info) => {
          if (info?.name) {
            setTables((prev) =>
              prev.map((s) => (s.id === t.id ? { ...s, name: info.name } : s))
            );
          }
        })
        .catch(() => {});
    });
    // Only on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update URL when tables change
  useEffect(() => {
    const ids = tables.map((t) => t.id).join(",");
    const url = ids ? `/multi-table?tables=${ids}` : "/multi-table";
    window.history.replaceState(null, "", url);
  }, [tables]);

  const addTable = useCallback(
    (id: string, name: string) => {
      if (tables.length >= maxTables) return;
      const next = [...tables, { id, name, maximized: false }];
      setTables(next);
      setLayout(autoLayout(next.length));
      setShowPicker(false);
    },
    [tables, maxTables]
  );

  const removeTable = useCallback(
    (id: string) => {
      const next = tables.filter((t) => t.id !== id);
      setTables(next);
      setLayout(autoLayout(next.length));
      if (maximizedId === id) setMaximizedId(null);
    },
    [tables, maximizedId]
  );

  const toggleMaximize = useCallback(
    (id: string) => {
      setMaximizedId((prev) => (prev === id ? null : id));
    },
    []
  );

  const existingIds = useMemo(() => new Set(tables.map((t) => t.id)), [tables]);

  const layoutOptions: { mode: LayoutMode; icon: React.ReactNode; label: string; min: number }[] = [
    { mode: "2-col", icon: <Columns2 size={16} />, label: "2 Side by Side", min: 2 },
    { mode: "3-asym", icon: <LayoutGrid size={16} />, label: "1 + 2 Stacked", min: 3 },
    { mode: "4-grid", icon: <Grid2x2 size={16} />, label: "2x2 Grid", min: 4 },
  ];

  // If no tables and nothing to show, prompt user
  if (tables.length === 0 && !showPicker) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-6 bg-zinc-950 text-white">
        <h1 className="text-2xl font-bold text-amber-400">Multi-Table Mode</h1>
        <p className="max-w-sm text-center text-zinc-400">
          Play up to {maxTables} tables simultaneously. Add your first table to get started.
        </p>
        <div className="flex gap-3">
          <button
            onClick={() => navigate("/")}
            className="flex items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-2 text-sm text-zinc-300 hover:bg-zinc-700"
          >
            <ArrowLeft size={16} /> Back to Lobby
          </button>
          <button
            onClick={() => setShowPicker(true)}
            className="flex items-center gap-2 rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-black hover:bg-amber-500"
          >
            <Plus size={16} /> Add Table
          </button>
        </div>
        {showPicker && (
          <AddTablePicker onAdd={addTable} onClose={() => setShowPicker(false)} existingIds={existingIds} />
        )}
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col bg-zinc-950">
      {/* ── Top Bar ─────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 border-b border-zinc-800 bg-zinc-900 px-3 py-2">
        {/* Back */}
        <button
          onClick={() => navigate("/")}
          className="mr-1 rounded p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-white"
          title="Back to lobby"
        >
          <ArrowLeft size={18} />
        </button>

        {/* Table tabs */}
        <div className="flex flex-1 items-center gap-1 overflow-x-auto">
          {tables.map((t) => (
            <button
              key={t.id}
              onClick={() => toggleMaximize(t.id)}
              className={`flex items-center gap-1.5 whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-medium transition ${
                maximizedId === t.id
                  ? "bg-amber-600/20 text-amber-400 ring-1 ring-amber-500/40"
                  : "text-zinc-400 hover:bg-zinc-800 hover:text-white"
              }`}
            >
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              {t.name}
            </button>
          ))}
        </div>

        {/* Layout selector */}
        <div className="flex items-center gap-1 border-l border-zinc-700 pl-2">
          {layoutOptions
            .filter((lo) => lo.min <= Math.max(tables.length, 2))
            .map((lo) => (
              <button
                key={lo.mode}
                onClick={() => setLayout(lo.mode)}
                className={`rounded p-1.5 transition ${
                  layout === lo.mode
                    ? "bg-amber-600/20 text-amber-400"
                    : "text-zinc-500 hover:bg-zinc-800 hover:text-white"
                }`}
                title={lo.label}
              >
                {lo.icon}
              </button>
            ))}
        </div>

        {/* Add table */}
        {tables.length < maxTables && (
          <button
            onClick={() => setShowPicker(true)}
            className="ml-1 flex items-center gap-1 rounded-md bg-amber-600/20 px-2.5 py-1.5 text-xs font-medium text-amber-400 hover:bg-amber-600/30"
          >
            <Plus size={14} /> Add
          </button>
        )}
      </div>

      {/* ── Grid Area ───────────────────────────────────────────────────── */}
      <div className={`grid flex-1 gap-px bg-zinc-800 ${getLayoutClass(layout, tables.length)}`}>
        {tables.map((t, i) => (
          <TableCell
            key={t.id}
            table={t}
            isMaximized={maximizedId === t.id}
            onToggleMaximize={() => toggleMaximize(t.id)}
            onRemove={() => removeTable(t.id)}
            cellClass={getCellClass(layout, i)}
          />
        ))}
      </div>

      {/* ── Picker modal ────────────────────────────────────────────────── */}
      {showPicker && (
        <AddTablePicker onAdd={addTable} onClose={() => setShowPicker(false)} existingIds={existingIds} />
      )}
    </div>
  );
}
