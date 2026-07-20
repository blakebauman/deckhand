import fs from "node:fs";

const path = new URL("../src/routes/pages.tsx", import.meta.url);
let src = fs.readFileSync(path, "utf8");

// Icons
src = src.replace(
  `import { FolderPlus, ListFilter, Plus, RefreshCw } from "lucide-react";`,
  `import Filter from "@react-spectrum/s2/icons/Filter";
import FolderAdd from "@react-spectrum/s2/icons/FolderAdd";
import Add from "@react-spectrum/s2/icons/Add";
import DataRefresh from "@react-spectrum/s2/icons/DataRefresh";`,
);
src = src.replaceAll("ListFilter", "Filter");
src = src.replaceAll("FolderPlus", "FolderAdd");
src = src.replaceAll("RefreshCw", "DataRefresh");
src = src.replaceAll(/<Plus className="[^"]*"\s*\/>/g, "<Add />");
src = src.replaceAll(/<Plus className="[^"]*" \/>/g, "<Add />");
src = src.replace(
  `<Plus className="mr-1 h-3.5 w-3.5" />`,
  `<Add />`,
);

// Import style macro if missing
if (!src.includes("@react-spectrum/s2/style")) {
  src = src.replace(
    `import type { ComposeProject } from "@/lib/api";`,
    `import type { ComposeProject } from "@/lib/api";
import { style } from "@react-spectrum/s2/style" with { type: "macro" };`,
  );
}

const replacements = [
  [
    `className="glass mb-5 flex items-center justify-between gap-4 rounded-[1.75rem] px-5 py-4"`,
    `className={style({ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, marginBottom: 20, paddingX: 20, paddingY: 16, backgroundColor: "layer-1", borderRadius: "xl" })}`,
  ],
  [
    `className="hidden max-w-sm text-right text-xs text-muted-foreground md:block"`,
    `className={style({ font: "body-xs", color: "neutral-subdued", textAlign: "end", maxWidth: 384 })}`,
  ],
  [
    `className="space-y-6"`,
    `className={style({ display: "flex", flexDirection: "column", gap: 24 })}`,
  ],
  [
    `className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5"`,
    `className={style({ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 12 })}`,
  ],
  [
    `className="glass-soft rounded-[1.75rem] px-5 py-4"`,
    `className={style({ backgroundColor: "layer-1", borderRadius: "xl", paddingX: 20, paddingY: 16 })}`,
  ],
  [
    `className="mb-2 flex items-center justify-between"`,
    `className={style({ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 })}`,
  ],
  [
    `className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground"`,
    `className={style({ display: "flex", alignItems: "center", gap: 6, font: "detail-xs", color: "neutral-subdued" })}`,
  ],
  [
    `className="text-xs text-muted-foreground"`,
    `className={style({ font: "body-xs", color: "neutral-subdued" })}`,
  ],
  [
    `className="grid gap-6 lg:grid-cols-2"`,
    `className={style({ display: "grid", gridTemplateColumns: "1fr", gap: 24 })}`,
  ],
  [
    `className="mb-3 flex items-center justify-between gap-2"`,
    `className={style({ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 12 })}`,
  ],
  [
    `className="flex items-center gap-1.5"`,
    `className={style({ display: "flex", alignItems: "center", gap: 6 })}`,
  ],
  [
    `className="text-lg font-semibold tracking-tight"`,
    `className={style({ font: "title" })}`,
  ],
  [
    `className="flex h-full min-h-0 gap-6"`,
    `className={style({ display: "flex", height: "full", minHeight: 0, gap: 24 })}`,
  ],
  [
    `className="flex items-center gap-2"`,
    `className={style({ display: "flex", alignItems: "center", gap: 8 })}`,
  ],
  [
    `className="flex items-center justify-between gap-2"`,
    `className={style({ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 })}`,
  ],
  [
    `className="flex min-w-0 items-center gap-2"`,
    `className={style({ display: "flex", alignItems: "center", gap: 8, minWidth: 0 })}`,
  ],
  [
    `className="flex shrink-0 items-center gap-1"`,
    `className={style({ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 })}`,
  ],
  [
    `className="truncate font-medium"`,
    `className={style({ font: "body", fontWeight: "medium", truncate: true })}`,
  ],
  [
    `className="truncate text-xs text-muted-foreground"`,
    `className={style({ font: "body-xs", color: "neutral-subdued", truncate: true })}`,
  ],
  [
    `className="space-y-4 pb-6"`,
    `className={style({ display: "flex", flexDirection: "column", gap: 16, paddingBottom: 24 })}`,
  ],
  [
    `className="space-y-3 pb-6"`,
    `className={style({ display: "flex", flexDirection: "column", gap: 12, paddingBottom: 24 })}`,
  ],
  [
    `className="space-y-5 pb-2"`,
    `className={style({ display: "flex", flexDirection: "column", gap: 20, paddingBottom: 8 })}`,
  ],
  [
    `className="flex flex-wrap items-center gap-2"`,
    `className={style({ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8 })}`,
  ],
  [
    `className="flex flex-wrap items-start justify-between gap-2"`,
    `className={style({ display: "flex", flexWrap: "wrap", alignItems: "start", justifyContent: "space-between", gap: 8 })}`,
  ],
  [
    `className="flex flex-wrap items-center justify-between gap-2"`,
    `className={style({ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 8 })}`,
  ],
  [
    `className="flex flex-wrap gap-2"`,
    `className={style({ display: "flex", flexWrap: "wrap", gap: 8 })}`,
  ],
  [
    `className="flex flex-wrap gap-1.5"`,
    `className={style({ display: "flex", flexWrap: "wrap", gap: 6 })}`,
  ],
  [
    `className="text-xl font-semibold"`,
    `className={style({ font: "heading" })}`,
  ],
  [
    `className="truncate text-xl font-semibold"`,
    `className={style({ font: "heading", truncate: true })}`,
  ],
  [
    `className="relative"`,
    `className={style({ position: "relative" })}`,
  ],
  [
    `className="absolute right-3 top-3 z-10"`,
    `className={style({ position: "absolute", top: 12, end: 12, zIndex: 10 })}`,
  ],
  [
    `className="glass-soft max-h-[60vh] overflow-auto rounded-[1.25rem] p-4 font-mono text-xs leading-relaxed"`,
    `className={style({ backgroundColor: "layer-1", borderRadius: "xl", padding: 16, font: "code-xs", maxHeight: "[60vh]", overflow: "auto" })}`,
  ],
  [
    `className="glass-soft max-h-[40vh] overflow-auto rounded-[1.25rem] p-4 font-mono text-xs leading-relaxed"`,
    `className={style({ backgroundColor: "layer-1", borderRadius: "xl", padding: 16, font: "code-xs", maxHeight: "[40vh]", overflow: "auto" })}`,
  ],
  [
    `className="glass-soft space-y-3 rounded-[1.5rem] p-4"`,
    `className={style({ display: "flex", flexDirection: "column", gap: 12, backgroundColor: "layer-1", borderRadius: "xl", padding: 16 })}`,
  ],
  [
    `className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground"`,
    `className={style({ font: "detail-xs", color: "neutral-subdued" })}`,
  ],
  [
    `className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground"`,
    `className={style({ font: "detail-xs", color: "neutral-subdued" })}`,
  ],
  [
    `className="flex gap-2"`,
    `className={style({ display: "flex", gap: 8 })}`,
  ],
  [
    `className="mt-1 font-mono text-xs text-muted-foreground"`,
    `className={style({ font: "code-xs", color: "neutral-subdued", marginTop: 4 })}`,
  ],
  [
    `className="mt-1 text-sm text-muted-foreground"`,
    `className={style({ font: "body-sm", color: "neutral-subdued", marginTop: 4 })}`,
  ],
  [
    `className="space-y-2"`,
    `className={style({ display: "flex", flexDirection: "column", gap: 8 })}`,
  ],
  [
    `className="space-y-1.5"`,
    `className={style({ display: "flex", flexDirection: "column", gap: 6 })}`,
  ],
  [
    `className="space-y-3"`,
    `className={style({ display: "flex", flexDirection: "column", gap: 12 })}`,
  ],
  [
    `className="flex items-center justify-between gap-2 rounded-[1rem] bg-muted/35 px-3 py-2 text-sm"`,
    `className={style({ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, backgroundColor: "layer-2", borderRadius: "lg", paddingX: 12, paddingY: 8, font: "body-sm" })}`,
  ],
  [
    `className="shrink-0 font-mono text-[11px] text-muted-foreground"`,
    `className={style({ font: "code-xs", color: "neutral-subdued", flexShrink: 0 })}`,
  ],
  [
    `className="flex h-full min-h-0"`,
    `className={style({ display: "flex", height: "full", minHeight: 0 })}`,
  ],
  [
    `className="flex min-h-0 min-w-0 flex-1 flex-col"`,
    `className={style({ display: "flex", flexDirection: "column", flexGrow: 1, minWidth: 0, minHeight: 0 })}`,
  ],
  [
    `className="shrink-0 border-t border-border/60 px-1 py-4"`,
    `className={style({ flexShrink: 0, paddingX: 4, paddingY: 16, marginTop: 8 })}`,
  ],
  [
    `className="h-full"`,
    `className={style({ height: "full" })}`,
  ],
  [
    `className="mb-4 flex flex-wrap items-center gap-3"`,
    `className={style({ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 12, marginBottom: 16 })}`,
  ],
  [
    `className="flex h-[calc(100%-3rem)] min-h-0 gap-6"`,
    `className={style({ display: "flex", height: "full", minHeight: 0, gap: 24 })}`,
  ],
  [
    `className="grid grid-cols-2 gap-3 md:grid-cols-4"`,
    `className={style({ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 12 })}`,
  ],
  [
    `className="glass-soft rounded-[1.35rem]"`,
    `className={style({ backgroundColor: "layer-1", borderRadius: "xl" })}`,
  ],
  [
    `className="mb-4 grid gap-2 md:grid-cols-3"`,
    `className={style({ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginBottom: 16 })}`,
  ],
  [
    `className="mb-4 h-32 font-mono text-xs"`,
    `className={style({ marginBottom: 16, font: "code-xs" })}`,
  ],
  [
    `className="mb-4 space-y-2"`,
    `className={style({ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 })}`,
  ],
  [
    `className="flex items-center justify-between glass-soft rounded-[1.25rem] px-4 py-3.5"`,
    `className={style({ display: "flex", alignItems: "center", justifyContent: "space-between", backgroundColor: "layer-1", borderRadius: "xl", paddingX: 16, paddingY: 14 })}`,
  ],
  [
    `className="font-medium"`,
    `className={style({ fontWeight: "medium" })}`,
  ],
  [
    `className="mb-4 grid gap-2 md:grid-cols-2"`,
    `className={style({ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 8, marginBottom: 16 })}`,
  ],
  [
    `className="glass-soft rounded-[1.25rem] px-4 py-3.5"`,
    `className={style({ backgroundColor: "layer-1", borderRadius: "xl", paddingX: 16, paddingY: 14 })}`,
  ],
  [
    `className="flex items-center justify-between gap-3"`,
    `className={style({ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 })}`,
  ],
  [
    `className="mt-4 max-h-64 overflow-auto rounded-2xl bg-black/80 p-4 text-xs text-emerald-200"`,
    `className={style({ marginTop: 16, maxHeight: 256, overflow: "auto", borderRadius: "xl", padding: 16, font: "code-xs", backgroundColor: "layer-2" })}`,
  ],
  [
    `className="font-mono text-xs text-muted-foreground"`,
    `className={style({ font: "code-xs", color: "neutral-subdued" })}`,
  ],
  [
    `className="px-5 py-2"`,
    `className={style({ paddingX: 20, paddingY: 8 })}`,
  ],
  [
    `className="px-5 py-4"`,
    `className={style({ paddingX: 20, paddingY: 16 })}`,
  ],
  [
    `className="mt-3 text-xs text-muted-foreground"`,
    `className={style({ font: "body-xs", color: "neutral-subdued", marginTop: 12 })}`,
  ],
  [
    `className="text-sm text-muted-foreground"`,
    `className={style({ font: "body-sm", color: "neutral-subdued" })}`,
  ],
  [
    `className="rounded-[1.15rem] border border-border/70 bg-muted/30 px-3.5 py-3"`,
    `className={style({ backgroundColor: "layer-2", borderRadius: "xl", paddingX: 14, paddingY: 12 })}`,
  ],
  [
    `className="mb-1 text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground"`,
    `className={style({ font: "detail-xs", color: "neutral-subdued", marginBottom: 4 })}`,
  ],
  [
    `className="flex items-start gap-2"`,
    `className={style({ display: "flex", alignItems: "start", gap: 8 })}`,
  ],
  [
    `className="min-w-0 flex-1 break-all font-mono text-xs leading-relaxed"`,
    `className={style({ font: "code-xs", flexGrow: 1, minWidth: 0 })}`,
  ],
  [
    `className="flex items-center gap-1.5"`,
    `className={style({ display: "flex", alignItems: "center", gap: 6 })}`,
  ],
  [
    `className="max-w-[14rem] truncate font-mono text-[11px]"`,
    `className={style({ font: "code-xs", truncate: true, maxWidth: 224 })}`,
  ],
  [
    `className="h-48 font-mono text-xs leading-relaxed"`,
    `className={style({ font: "code-xs" })}`,
  ],
  [
    `className="h-16"`,
    `className={style({ height: 64 })}`,
  ],
];

for (const [from, to] of replacements) {
  src = src.replaceAll(from, to);
}

// Remaining glass / muted leftovers → layer panels
src = src.replaceAll(/className="glass[^"]*"/g, `className={style({ backgroundColor: "layer-1", borderRadius: "xl", padding: 16 })}`);
src = src.replaceAll(/className="[^"]*text-muted-foreground[^"]*"/g, `className={style({ color: "neutral-subdued", font: "body-xs" })}`);

fs.writeFileSync(path, src);
console.log("Converted pages.tsx styles/icons");
