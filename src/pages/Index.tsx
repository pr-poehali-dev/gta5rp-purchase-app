import { useState, useMemo } from "react";
import { ITEMS, CATEGORIES, Item } from "@/data/items";
import Icon from "@/components/ui/icon";

const formatPrice = (price: number) =>
  price.toLocaleString("ru-RU") + " $";

export default function Index() {
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState("Все");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const filtered = useMemo(() => {
    let result = ITEMS;
    if (activeCategory !== "Все") {
      result = result.filter((i) => i.category === activeCategory);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter((i) => i.name.toLowerCase().includes(q));
    }
    return [...result].sort((a, b) =>
      sortDir === "desc" ? b.buyPrice - a.buyPrice : a.buyPrice - b.buyPrice
    );
  }, [search, activeCategory, sortDir]);

  return (
    <div className="min-h-screen bg-[#0d0d0d] text-[#e8e8e8] font-golos">
      {/* Header */}
      <header className="border-b border-[#1e1e1e] sticky top-0 z-10 bg-[#0d0d0d]/95 backdrop-blur-sm">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[#22c55e] flex items-center justify-center">
              <Icon name="ShoppingCart" size={16} className="text-black" />
            </div>
            <div>
              <h1 className="text-base font-semibold leading-none tracking-tight">5vito Скупка</h1>
              <p className="text-[11px] text-[#555] mt-0.5">GTA5RP · цены скупки</p>
            </div>
          </div>
          <span className="text-xs text-[#333] font-mono">{filtered.length} позиций</span>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6 space-y-5">
        {/* Search + Sort */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Icon
              name="Search"
              size={15}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-[#444]"
            />
            <input
              type="text"
              placeholder="Поиск предмета..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-[#141414] border border-[#1e1e1e] rounded-xl pl-9 pr-4 py-2.5 text-sm text-[#e8e8e8] placeholder:text-[#3a3a3a] focus:outline-none focus:border-[#22c55e]/40 transition-colors"
            />
          </div>
          <button
            onClick={() => setSortDir((d) => (d === "desc" ? "asc" : "desc"))}
            className="px-3.5 bg-[#141414] border border-[#1e1e1e] rounded-xl text-[#555] hover:text-[#22c55e] hover:border-[#22c55e]/30 transition-all flex items-center gap-1.5 text-xs"
          >
            <Icon name={sortDir === "desc" ? "ArrowDownNarrowWide" : "ArrowUpNarrowWide"} size={14} />
            <span className="hidden sm:inline">{sortDir === "desc" ? "Дороже" : "Дешевле"}</span>
          </button>
        </div>

        {/* Category Pills */}
        <div className="flex gap-2 flex-wrap">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                activeCategory === cat
                  ? "bg-[#22c55e] text-black"
                  : "bg-[#141414] text-[#555] border border-[#1e1e1e] hover:text-[#e8e8e8] hover:border-[#2a2a2a]"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Items Grid */}
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-[#333]">
            <Icon name="PackageSearch" size={40} className="mb-3 opacity-40" />
            <p className="text-sm">Ничего не найдено</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
            {filtered.map((item) => (
              <ItemCard key={item.id} item={item} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

function ItemCard({ item }: { item: Item }) {
  const categoryIcon: Record<string, string> = {
    "Оружие": "Crosshair",
    "Патроны": "Dot",
    "Наркотики": "Leaf",
    "Еда и напитки": "UtensilsCrossed",
    "Одежда": "Shirt",
    "Материалы": "Hammer",
    "Техника": "Cpu",
    "Прочее": "Package",
  };

  const icon = categoryIcon[item.category] || "Package";

  return (
    <div className="group bg-[#111] border border-[#1a1a1a] rounded-xl p-3 hover:border-[#22c55e]/20 hover:bg-[#131313] transition-all cursor-default">
      <div className="flex items-start justify-between gap-1 mb-2.5">
        <div className="w-7 h-7 rounded-lg bg-[#1a1a1a] flex items-center justify-center shrink-0 group-hover:bg-[#22c55e]/10 transition-colors">
          <Icon name={icon} size={13} className="text-[#444] group-hover:text-[#22c55e] transition-colors" fallback="Package" />
        </div>
        <span className="text-[9px] text-[#333] bg-[#161616] px-1.5 py-0.5 rounded-md leading-none mt-0.5 truncate max-w-[80px]">
          {item.category}
        </span>
      </div>
      <p className="text-[13px] font-medium leading-snug text-[#d0d0d0] mb-1.5 line-clamp-2">
        {item.name}
      </p>
      <p className="text-[15px] font-semibold text-[#22c55e] leading-none">
        {formatPrice(item.buyPrice)}
        {item.unit && (
          <span className="text-[11px] text-[#444] font-normal ml-1">/ {item.unit}</span>
        )}
      </p>
    </div>
  );
}
