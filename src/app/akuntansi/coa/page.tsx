"use client";
import React from "react";
import AkShell, { glass, pill } from "@/components/AkShell";
import {
  ListTree, Plus, Pencil, Trash2, RotateCcw, Check, Search,
  ChevronDown, ChevronRight, GripVertical, Undo2, Minimize2, Maximize2
} from "lucide-react";
import useToast from "@/components/Toast";

/* ================= Types ================= */
type Pos = "DEBIT" | "KREDIT";
type TipeAkun = "ASET" | "KEWAJIBAN" | "EKUITAS" | "PENDAPATAN" | "BEBAN";

type APINode = {
  id: number; kode: string; nama: string; pos: Pos; tipe: TipeAkun;
  isPosting: boolean; isActive: boolean; level: number; parentId: number | null;
  children?: APINode[];
};

type Node = {
  id: number; kode: string; nama: string; pos: Pos; tipe: TipeAkun;
  isPosting: boolean; isActive: boolean; level: number; parentId: number | null;
  children: Node[];
};

/* ================= Utils ================= */
const cx = (...cls: Array<string | false | null | undefined>) => cls.filter(Boolean).join(" ");
const mapAPINode = (n: APINode): Node => ({
  id: n.id, kode: n.kode, nama: n.nama, pos: n.pos, tipe: n.tipe,
  isPosting: n.isPosting, isActive: n.isActive, level: n.level,
  parentId: n.parentId, children: (n.children || []).map(mapAPINode),
});
const byIdMap = (roots: Node[]) => {
  const m = new Map<number, Node>();
  const walk = (n: Node) => { m.set(n.id, n); n.children.forEach(walk); };
  roots.forEach(walk);
  return m;
};
const isDescendant = (tree: Map<number, Node>, parentId: number, childId: number): boolean => {
  const p = tree.get(parentId); if (!p) return false;
  const st: Node[] = [...p.children];
  while (st.length) { const c = st.pop()!; if (c.id === childId) return true; st.push(...c.children); }
  return false;
};

/* =============== Pretty Select =============== */
function Select({
  value, onChange, children, className = "", disabled = false, title,
}: {
  value: string | number;
  onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  children: React.ReactNode;
  className?: string; disabled?: boolean; title?: string;
}) {
  return (
    <div className="relative">
      <select
        title={title} value={value} onChange={onChange} disabled={disabled}
        className={cx(
          "h-10 w-full appearance-none rounded-lg border px-3 pr-9 text-sm outline-none",
          "border-white/12 bg-slate-900/40 text-slate-100 placeholder:text-slate-400",
          "focus:ring-2 focus:ring-indigo-400/30 disabled:opacity-60", className
        )}
      >
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-300/80" />
    </div>
  );
}

/* ============== Small helpers ============== */
const ghostBtn =
  "rounded-md border border-white/10 bg-white/5 hover:bg-white/10 p-1.5 transition";
const iconSm = "h-4 w-4";

/* ================= Page ================= */
export default function CoAPage() {
  const { push, View } = useToast();

  const [tree, setTree] = React.useState<Node[]>([]);
  const [expanded, setExpanded] = React.useState<Set<number>>(new Set());
  const [selected, setSelected] = React.useState<Node | null>(null);
  const [q, setQ] = React.useState("");
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);

  const [form, setForm] = React.useState<{
    id?: number; kode: string; nama: string; pos: Pos; tipe: TipeAkun;
    isPosting: boolean; isActive: boolean; parentId: number | null;
  }>({ kode: "", nama: "", pos: "DEBIT", tipe: "ASET", isPosting: true, isActive: true, parentId: null });

  const loadTree = React.useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/akuntansi/coa?tree=1");
    const data = (await res.json()) as { rows?: APINode[]; error?: string };
    if (data.error) { push(`❌ ${data.error}`, "err"); setTree([]); }
    else { setTree((data.rows || []).map(mapAPINode)); }
    setLoading(false);
  }, [push]);

  React.useEffect(() => { loadTree(); }, [loadTree]);

  const expandAll = React.useCallback(() => {
    const all = new Set<number>();
    const walk = (n: Node) => { if (n.children.length) all.add(n.id); n.children.forEach(walk); };
    tree.forEach(walk);
    setExpanded(all);
  }, [tree]);
  const collapseAll = React.useCallback(() => setExpanded(new Set()), []);

  const pick = (n: Node) => {
    setSelected(n);
    setForm({ id: n.id, kode: n.kode, nama: n.nama, pos: n.pos, tipe: n.tipe,
      isPosting: n.isPosting, isActive: n.isActive, parentId: n.parentId });
  };

  const newChildOf = (parent: Node | null) => {
    setSelected(null);
    setForm({
      id: undefined, kode: "", nama: "", pos: parent?.pos ?? "DEBIT", tipe: parent?.tipe ?? "ASET",
      isPosting: true, isActive: true, parentId: parent ? parent.id : null,
    });
    if (parent) { const next = new Set(expanded); next.add(parent.id); setExpanded(next); }
  };

  const save = async () => {
    if (!form.kode.trim() || !form.nama.trim()) { push("❌ Kode & Nama wajib diisi", "err"); return; }
    setSaving(true);
    try {
      if (form.id) {
        const res = await fetch(`/api/akuntansi/coa/${form.id}`, {
          method: "PUT", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            kode: form.kode.trim(), nama: form.nama.trim(), pos: form.pos, tipe: form.tipe,
            isPosting: form.isPosting, isActive: form.isActive, parentId: form.parentId,
          }),
        });
        const j = await res.json(); if (!res.ok) throw new Error(j?.error || "Gagal update akun");
        push("✅ Akun diperbarui", "ok");
      } else {
        const res = await fetch(`/api/akuntansi/coa`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            kode: form.kode.trim(), nama: form.nama.trim(), pos: form.pos, tipe: form.tipe,
            isPosting: form.isPosting, parentId: form.parentId ?? null, isActive: form.isActive,
          }),
        });
        const j = await res.json(); if (!res.ok) throw new Error(j?.error || "Gagal membuat akun");
        push("✅ Akun dibuat", "ok");
        setSelected(null);
        setForm({ id: j.id, kode: j.kode, nama: j.nama, pos: j.pos, tipe: j.tipe,
          isPosting: j.isPosting, isActive: j.isActive, parentId: j.parentId });
      }
      await loadTree();
    } catch (e: unknown) {
      push(`❌ ${(e as Error).message}`, "err");
    } finally { setSaving(false); }
  };

  const toggleActive = async (n: Node) => {
    try {
      const res = await fetch(`/api/akuntansi/coa/${n.id}`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !n.isActive }),
      });
      const j = await res.json(); if (!res.ok) throw new Error(j?.error || "Gagal mengubah status");
      push(`✅ ${!n.isActive ? "Diaktifkan" : "Dinonaktifkan"}`, "ok");
      await loadTree(); if (selected?.id === n.id) pick({ ...n, isActive: !n.isActive });
    } catch (e: unknown) { push(`❌ ${(e as Error).message}`, "err"); }
  };

  const onDropMove = async (dragId: number, targetId: number | null) => {
    const map = byIdMap(tree);
    if (targetId && (dragId === targetId || isDescendant(map, dragId, targetId))) {
      push("❌ Tidak boleh menjadikan anak sebagai parent-nya sendiri", "err"); return;
    }
    try {
      const res = await fetch(`/api/akuntansi/coa/${dragId}`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ parentId: targetId }),
      });
      const j = await res.json(); if (!res.ok) throw new Error(j?.error || "Gagal memindah akun");
      push("✅ Struktur diperbarui", "ok");
      const next = new Set(expanded); if (targetId) next.add(targetId); setExpanded(next);
      await loadTree();
    } catch (e: unknown) { push(`❌ ${(e as Error).message}`, "err"); }
  };

  const matchQ = (n: Node) =>
    !q.trim() || n.kode.toLowerCase().includes(q.toLowerCase()) || n.nama.toLowerCase().includes(q.toLowerCase());

  /* ============== Tree Node ============== */
  function TreeNode({ n }: { n: Node }) {
    const opened = expanded.has(n.id);
    const toggle = () => {
      const next = new Set(expanded);
      opened ? next.delete(n.id) : next.add(n.id);
      setExpanded(next);
    };

    return (
      <li
        className="group"
        draggable
        onDragStart={(e) => { e.dataTransfer.setData("text/plain", String(n.id)); (e.currentTarget as HTMLLIElement).style.opacity = "0.6"; }}
        onDragEnd={(e) => { (e.currentTarget as HTMLLIElement).style.opacity = ""; }}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => { e.preventDefault(); const dragId = Number(e.dataTransfer.getData("text/plain")); if (Number.isFinite(dragId)) onDropMove(dragId, n.id); }}
      >
        <div
          className={cx(
            "flex items-center gap-2 rounded-lg px-2 py-1 hover:bg-white/5",
            selected?.id === n.id && "bg-white/10 ring-1 ring-white/15"
          )}
        >
          <div className="flex items-center gap-1 text-slate-300/80">
            <button
              onClick={toggle}
              className="h-5 w-5 rounded hover:bg-white/10 flex items-center justify-center"
              title={opened ? "Collapse" : "Expand"}
            >
              {n.children.length > 0 ? (
                opened ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />
              ) : (
                <span className="inline-block w-4" />
              )}
            </button>
            <GripVertical className="h-3.5 w-3.5 opacity-60" />
          </div>

          <button onClick={() => pick(n)} className="min-w-0 flex-1 text-left">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-[13px] font-semibold">{n.kode}</span>
              <span className="truncate text-[13px] text-slate-300/85">{n.nama}</span>
              {!n.isPosting && <span className={`${pill} bg-white/10 ring-white/15 text-slate-200`}>Group</span>}
              <span className={`${pill} bg-indigo-400/10 ring-indigo-400/20 text-indigo-200`}>{n.tipe}</span>
              {!n.isActive && <span className={`${pill} bg-rose-400/10 ring-rose-400/20 text-rose-200`}>Nonaktif</span>}
            </div>
          </button>

          <div className="ml-1 flex items-center gap-1 opacity-0 transition group-hover:opacity-100 focus-within:opacity-100">
            <button onClick={() => newChildOf(n)} className={ghostBtn} title="Tambah sub-akun">
              <Plus className={iconSm} />
            </button>
            <button onClick={() => pick(n)} className={ghostBtn} title="Edit">
              <Pencil className={iconSm} />
            </button>
            <button onClick={() => toggleActive(n)} className={ghostBtn} title={n.isActive ? "Nonaktifkan" : "Aktifkan"}>
              {n.isActive ? <Trash2 className="h-4 w-4 text-rose-300" /> : <Undo2 className={iconSm} />}
            </button>
          </div>
        </div>

        {n.children.length > 0 && opened && (
          <ul className="ml-5 border-l border-white/10 pl-3">
            {n.children.filter(matchQ).map((c) => (<TreeNode key={c.id} n={c} />))}
          </ul>
        )}
      </li>
    );
  }

  const RootDrop = () => (
    <div
      className="rounded-lg border border-dashed border-white/15 p-2 text-xs text-slate-300/70"
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => { const dragId = Number(e.dataTransfer.getData("text/plain")); if (Number.isFinite(dragId)) onDropMove(dragId, null); }}
    >
      Drop di sini untuk jadikan root
    </div>
  );

  /* ================= Render ================= */
  return (
    <AkShell title="CoA (Chart of Accounts)" subtitle="Kelola struktur akun" full>
      <View />

      <div className="grid grid-cols-12 gap-4">
        {/* LEFT: TREE */}
        <section className={cx("col-span-12 xl:col-span-5", glass, "p-0 overflow-hidden")}>
          {/* sticky header */}
          <div className="sticky top-0 z-10 flex items-center justify-between border-b border-white/10 bg-white/5 px-4 py-3 backdrop-blur-md">
            <div className="flex items-center gap-2">
              <ListTree className="h-5 w-5 text-indigo-300" />
              <div className="font-semibold">Struktur Akun</div>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={expandAll} className={`${ghostBtn} px-2`} title="Expand all">
                <Maximize2 className={iconSm} /><span className="ml-1 text-xs">Expand</span>
              </button>
              <button onClick={collapseAll} className={`${ghostBtn} px-2`} title="Collapse all">
                <Minimize2 className={iconSm} /><span className="ml-1 text-xs">Collapse</span>
              </button>
              <button onClick={() => newChildOf(null)} className={`${ghostBtn} px-2`} title="Akun baru (root)">
                <Plus className={iconSm} /><span className="ml-1 text-xs">Akun Baru</span>
              </button>
            </div>
          </div>

          {/* search */}
          <div className="px-4 pt-3">
            <div className="relative">
              <input
                value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari kode/nama…"
                className="h-10 w-full rounded-lg border border-white/12 bg-slate-900/40 pl-9 pr-3 text-sm text-slate-100 outline-none placeholder:text-slate-400 focus:ring-2 focus:ring-indigo-400/30"
              />
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-300/80" />
            </div>
          </div>

          {/* list */}
          <div className="relative mt-3 max-h-[calc(100vh-320px)] overflow-auto px-4 pb-4">
            {/* top/bottom fade */}
            <div className="pointer-events-none sticky top-0 -mt-3 h-3 bg-gradient-to-b from-slate-900/40 to-transparent" />
            {loading ? (
              <div className="mx-1 h-24 animate-pulse rounded-lg bg-white/5" />
            ) : tree.length === 0 ? (
              <div className="mx-1 text-sm text-slate-300/80">Belum ada akun.</div>
            ) : (
              <ul className="space-y-0.5">
                {tree.filter(matchQ).map((n) => (<TreeNode key={n.id} n={n} />))}
              </ul>
            )}
            <div className="mt-3">
              <RootDrop />
            </div>
            <div className="pointer-events-none sticky bottom-0 -mb-3 h-3 bg-gradient-to-t from-slate-900/40 to-transparent" />
          </div>
        </section>

        {/* RIGHT: FORM */}
        <section className={cx("col-span-12 xl:col-span-7", glass, "p-4")}>
          <div className="mb-3 flex items-center justify-between">
            <div>
              <div className="font-semibold">{form.id ? "Edit Akun" : "Akun Baru"}</div>
              <div className="text-xs text-slate-300/80">{form.parentId ? `Parent ID: ${form.parentId}` : "Root"}</div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setForm({ id: undefined, kode: "", nama: "", pos: "DEBIT", tipe: "ASET", isPosting: true, isActive: true, parentId: null })}
                className={`${ghostBtn} px-3`} title="Reset form"
              >
                <RotateCcw className={iconSm} /><span className="ml-1 text-sm">Reset</span>
              </button>
              <button
                onClick={save} disabled={saving}
                className="inline-flex items-center gap-2 rounded-lg border border-indigo-300/20 bg-indigo-400/20 px-3 py-1.5 text-sm text-indigo-100 hover:bg-indigo-400/30 disabled:opacity-50"
              >
                <Check className={iconSm} />{saving ? "Menyimpan…" : "Simpan"}
              </button>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-12">
            <div className="md:col-span-3">
              <label className="mb-1 block text-xs text-slate-300/80">Kode</label>
              <input
                value={form.kode} onChange={(e) => setForm((f) => ({ ...f, kode: e.target.value }))}
                className="h-10 w-full rounded-lg border border-white/12 bg-slate-900/40 px-3 text-sm text-slate-100 outline-none placeholder:text-slate-400 focus:ring-2 focus:ring-indigo-400/30"
                placeholder="cth: 1101"
              />
            </div>

            <div className="md:col-span-5">
              <label className="mb-1 block text-xs text-slate-300/80">Nama</label>
              <input
                value={form.nama} onChange={(e) => setForm((f) => ({ ...f, nama: e.target.value }))}
                className="h-10 w-full rounded-lg border border-white/12 bg-slate-900/40 px-3 text-sm text-slate-100 outline-none placeholder:text-slate-400 focus:ring-2 focus:ring-indigo-400/30"
                placeholder="Kas"
              />
            </div>

            <div className="md:col-span-4">
              <label className="mb-1 block text-xs text-slate-300/80">Kategori (Tipe Akun)</label>
              <Select value={form.tipe} onChange={(e) => setForm((f) => ({ ...f, tipe: e.target.value as TipeAkun }))}>
                <option value="ASET">ASET</option>
                <option value="KEWAJIBAN">KEWAJIBAN</option>
                <option value="EKUITAS">EKUITAS</option>
                <option value="PENDAPATAN">PENDAPATAN</option>
                <option value="BEBAN">BEBAN</option>
              </Select>
            </div>

            <div className="md:col-span-3">
              <label className="mb-1 block text-xs text-slate-300/80">Pos</label>
              <Select value={form.pos} onChange={(e) => setForm((f) => ({ ...f, pos: e.target.value as Pos }))}>
                <option value="DEBIT">DEBIT</option>
                <option value="KREDIT">KREDIT</option>
              </Select>
            </div>

            <div className="md:col-span-3">
              <label className="mb-1 block text-xs text-slate-300/80">Type</label>
              <Select
                value={form.isPosting ? "DETAIL" : "GROUP"}
                onChange={(e) => setForm((f) => ({ ...f, isPosting: e.target.value === "DETAIL" }))}
              >
                <option value="DETAIL">Detail (Posting)</option>
                <option value="GROUP">Group (Non-posting)</option>
              </Select>
            </div>

            <div className="md:col-span-3">
              <label className="mb-1 block text-xs text-slate-300/80">Status</label>
              <Select
                value={form.isActive ? "ACTIVE" : "INACTIVE"}
                onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.value === "ACTIVE" }))}
              >
                <option value="ACTIVE">Aktif</option>
                <option value="INACTIVE">Nonaktif</option>
              </Select>
            </div>

            <div className="md:col-span-3">
              <label className="mb-1 block text-xs text-slate-300/80">Parent ID (opsional)</label>
              <input
                type="number" value={form.parentId ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, parentId: e.target.value === "" ? null : Number(e.target.value) }))}
                className="h-10 w-full rounded-lg border border-white/12 bg-slate-900/40 px-3 text-sm text-slate-100 outline-none placeholder:text-slate-400 focus:ring-2 focus:ring-indigo-400/30"
                placeholder="null = root"
              />
            </div>
          </div>

          {selected && (
            <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-slate-300/75">
              <span className={`${pill} bg-white/10 ring-white/15`}>Dipilih: {selected.kode}</span>
              <button onClick={() => newChildOf(selected)} className={`${ghostBtn} px-2`}>
                <Plus className="h-3.5 w-3.5" /> <span className="ml-1">Sub-akun</span>
              </button>
            </div>
          )}
        </section>
      </div>
    </AkShell>
  );
}
