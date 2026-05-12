import { useState, useEffect, useRef, useCallback } from "react";
import { ITEMS, CATEGORIES } from "@/data/items";
import Icon from "@/components/ui/icon";

const WISHLIST_URL = "https://functions.poehali.dev/7cf7ec09-48e6-4e8a-96ce-51f2c7bea976";
const MONITOR_URL = "https://functions.poehali.dev/c4343edc-0856-40d6-81b0-122dd4fc72e4";
const SCAN_INTERVAL = 5000; // 5 секунд — быстрое обновление

interface WishlistItem {
  id: number;
  name: string;
  category: string;
  max_price: number;
  active: boolean;
}

interface FoundLot {
  id: number;
  wishlist_id: number;
  wishlist_name: string;
  max_price: number;
  title: string;
  price: number;
  url: string;
  image?: string;
  found_at?: string;
}

const fmt = (n: number) => n.toLocaleString("ru-RU") + " $";

export default function Index() {
  const [tab, setTab] = useState<"monitor" | "catalog">("monitor");

  const [wishlist, setWishlist] = useState<WishlistItem[]>([]);
  const [addName, setAddName] = useState("");
  const [addCategory, setAddCategory] = useState("Прочее");
  const [addPrice, setAddPrice] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);

  const [scanning, setScanning] = useState(false);
  const [lastScan, setLastScan] = useState<Date | null>(null);
  const [recentLots, setRecentLots] = useState<FoundLot[]>([]);
  const [alerts, setAlerts] = useState<FoundLot[]>([]);
  const [autoScan, setAutoScan] = useState(false);
  const [nextScanIn, setNextScanIn] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [catSearch, setCatSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState("Все");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const loadWishlist = useCallback(async () => {
    try {
      const res = await fetch(WISHLIST_URL);
      const data = await res.json();
      setWishlist(data.items || []);
    } catch (_e) { /* ignore */ }
  }, []);

  useEffect(() => { loadWishlist(); }, [loadWishlist]);

  useEffect(() => {
    if (!addName.trim()) { setSuggestions([]); return; }
    const q = addName.toLowerCase();
    const hits = ITEMS.filter(i => i.name.toLowerCase().includes(q)).slice(0, 6).map(i => i.name);
    setSuggestions(hits);
  }, [addName]);

  const addToWishlist = async () => {
    if (!addName.trim() || !addPrice) return;
    await fetch(WISHLIST_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: addName.trim(), category: addCategory, max_price: parseInt(addPrice) }),
    });
    setAddName(""); setAddPrice(""); setAddOpen(false); setSuggestions([]);
    loadWishlist();
  };

  const toggleActive = async (item: WishlistItem) => {
    await fetch(WISHLIST_URL, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: item.id, active: !item.active }),
    });
    loadWishlist();
  };

  // Запрашиваем разрешение на браузерные уведомления
  useEffect(() => {
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }
  }, []);

  const runScan = useCallback(async () => {
    setScanning(true);
    try {
      const res = await fetch(MONITOR_URL);
      const data = await res.json();
      setRecentLots(data.recent || []);
      if (data.new_finds && data.new_finds.length > 0) {
        const newFinds: FoundLot[] = data.new_finds;
        setAlerts(prev => [...newFinds, ...prev].slice(0, 20));

        // Браузерное уведомление для каждого нового лота
        newFinds.forEach((lot: FoundLot) => {
          // Web Notification API
          if ("Notification" in window && Notification.permission === "granted") {
            const notif = new Notification(`🟢 ${lot.wishlist_name} — найдено!`, {
              body: `${lot.title}\n${lot.price.toLocaleString("ru-RU")} $ (лимит: ${lot.max_price.toLocaleString("ru-RU")} $)`,
              icon: "/favicon.svg",
              tag: `lot-${lot.id}`,
            });
            // Клик по уведомлению — открыть ссылку
            notif.onclick = () => {
              window.open(lot.url, "_blank");
              notif.close();
            };
            // Авто-закрытие через 8 секунд
            setTimeout(() => notif.close(), 8000);
          }
        });

        // Звуковой сигнал (если разрешён)
        try {
          const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.frequency.value = 880;
          gain.gain.setValueAtTime(0.3, ctx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
          osc.start(ctx.currentTime);
          osc.stop(ctx.currentTime + 0.4);
        } catch (_e) { /* звук не поддерживается */ }
      }
      setLastScan(new Date());
    } finally {
      setScanning(false);
    }
  }, []);

  useEffect(() => {
    if (autoScan) {
      runScan();
      setNextScanIn(SCAN_INTERVAL / 1000);
      intervalRef.current = setInterval(() => {
        runScan();
        setNextScanIn(SCAN_INTERVAL / 1000);
      }, SCAN_INTERVAL);
      // Обратный отсчёт
      countdownRef.current = setInterval(() => {
        setNextScanIn(prev => Math.max(0, prev - 1));
      }, 1000);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (countdownRef.current) clearInterval(countdownRef.current);
      setNextScanIn(0);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, [autoScan, runScan]);

  const dismissAlert = (id: number) => setAlerts(prev => prev.filter(a => a.id !== id));

  const filtered = ITEMS
    .filter(i => activeCategory === "Все" || i.category === activeCategory)
    .filter(i => !catSearch.trim() || i.name.toLowerCase().includes(catSearch.toLowerCase()))
    .sort((a, b) => sortDir === "desc" ? b.buyPrice - a.buyPrice : a.buyPrice - b.buyPrice);

  const activeCount = wishlist.filter(w => w.active).length;

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-[#e0e0e0] font-golos flex flex-col">

      {/* === ALERTS === */}
      {alerts.length > 0 && (
        <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-full">
          {alerts.slice(0, 3).map(lot => (
            <div key={lot.id} className="bg-[#0a1a0a] border border-[#22c55e]/50 rounded-2xl p-4 shadow-2xl animate-fade-in">
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-[#22c55e] animate-pulse" />
                  <span className="text-[11px] text-[#22c55e] font-bold uppercase tracking-widest">Найдено!</span>
                </div>
                <button onClick={() => dismissAlert(lot.id)} className="text-[#444] hover:text-white transition-colors">
                  <Icon name="X" size={13} />
                </button>
              </div>
              <p className="text-sm font-semibold text-white mb-2 line-clamp-1">{lot.title}</p>
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xl font-bold text-[#22c55e]">{fmt(lot.price)}</span>
                  <p className="text-[10px] text-[#444] mt-0.5">лимит: {fmt(lot.max_price)}</p>
                </div>
                <a href={lot.url} target="_blank" rel="noopener noreferrer"
                  className="bg-[#22c55e] text-black text-xs font-bold px-4 py-2 rounded-xl hover:bg-[#16a34a] transition-colors flex items-center gap-1.5">
                  <Icon name="ExternalLink" size={12} />
                  Купить
                </a>
              </div>
            </div>
          ))}
          {alerts.length > 3 && (
            <p className="text-center text-[10px] text-[#555]">+{alerts.length - 3} ещё</p>
          )}
        </div>
      )}

      {/* === HEADER === */}
      <header className="border-b border-[#161616] sticky top-0 z-20 bg-[#0a0a0a]/96 backdrop-blur-sm">
        <div className="max-w-4xl mx-auto px-4 pt-3.5 pb-0 flex items-center justify-between mb-2">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-[#22c55e] flex items-center justify-center">
              <Icon name="Zap" size={14} className="text-black" />
            </div>
            <span className="font-bold text-[13px] tracking-tight">5vito Скупка</span>
            <span className="text-[10px] text-[#2a2a2a] bg-[#111] px-2 py-0.5 rounded-full border border-[#1a1a1a]">GTA5RP</span>
          </div>
          <div className="flex items-center gap-3">
            {autoScan && (
              <div className="flex items-center gap-1.5 text-[11px] text-[#22c55e]">
                <div className="w-1.5 h-1.5 rounded-full bg-[#22c55e] animate-pulse" />
                Активен
              </div>
            )}
            {lastScan && (
              <span className="text-[10px] text-[#2a2a2a] font-mono">
                {lastScan.toLocaleTimeString("ru-RU")}
              </span>
            )}
          </div>
        </div>
        <div className="max-w-4xl mx-auto px-4 flex gap-0">
          {[
            { key: "monitor", label: "Мониторинг", icon: "Radar" },
            { key: "catalog", label: "Каталог цен", icon: "LayoutGrid" },
          ].map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key as typeof tab)}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-[12px] font-medium border-b-2 transition-all ${
                tab === t.key
                  ? "border-[#22c55e] text-[#22c55e]"
                  : "border-transparent text-[#3a3a3a] hover:text-[#777]"
              }`}
            >
              <Icon name={t.icon} size={13} fallback="Circle" />
              {t.label}
            </button>
          ))}
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-5 flex-1 w-full">

        {/* === MONITOR TAB === */}
        {tab === "monitor" && (
          <div className="space-y-4">

            {/* Control row */}
            <div className="bg-[#0e0e0e] border border-[#181818] rounded-2xl p-4 flex items-center justify-between gap-4">
              <div>
                <p className="text-[13px] font-semibold text-white">Автосканирование 5vito</p>
                <p className="text-[11px] text-[#333] mt-0.5">
                  {activeCount} поз. · каждые {SCAN_INTERVAL / 1000} сек
                  {autoScan && nextScanIn > 0 && (
                    <span className="text-[#22c55e]/60 ml-1">· следующий через {nextScanIn}с</span>
                  )}
                  {!autoScan && <span className="ml-1">· уведомление при находке</span>}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={runScan}
                  disabled={scanning}
                  className="flex items-center gap-1.5 px-3 py-2 bg-[#131313] border border-[#1e1e1e] rounded-xl text-[11px] text-[#666] hover:text-white hover:border-[#2a2a2a] transition-all disabled:opacity-40"
                >
                  <Icon name={scanning ? "Loader" : "RefreshCw"} size={12} className={scanning ? "animate-spin" : ""} />
                  Разово
                </button>
                <button
                  onClick={() => setAutoScan(v => !v)}
                  className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-[12px] font-bold transition-all ${
                    autoScan
                      ? "bg-[#22c55e] text-black hover:bg-[#16a34a]"
                      : "bg-[#131313] border border-[#1e1e1e] text-[#666] hover:text-white hover:border-[#2a2a2a]"
                  }`}
                >
                  <Icon name={autoScan ? "Pause" : "Play"} size={12} />
                  {autoScan ? "Стоп" : "Старт"}
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

              {/* Wishlist panel */}
              <div className="bg-[#0e0e0e] border border-[#181818] rounded-2xl overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 border-b border-[#141414]">
                  <div className="flex items-center gap-2">
                    <Icon name="Heart" size={13} className="text-[#22c55e]" />
                    <span className="text-[12px] font-semibold text-white">Список скупки</span>
                    <span className="text-[10px] text-[#2a2a2a] bg-[#141414] px-1.5 py-0.5 rounded-full border border-[#1e1e1e]">{wishlist.length}</span>
                  </div>
                  <button
                    onClick={() => setAddOpen(v => !v)}
                    className={`w-6 h-6 rounded-lg flex items-center justify-center transition-all ${
                      addOpen ? "bg-[#22c55e] text-black" : "bg-[#141414] border border-[#1e1e1e] text-[#444] hover:text-[#22c55e]"
                    }`}
                  >
                    <Icon name={addOpen ? "X" : "Plus"} size={12} />
                  </button>
                </div>

                {addOpen && (
                  <div className="px-4 py-3 border-b border-[#141414] bg-[#0c0c0c] space-y-2">
                    <div className="relative">
                      <input
                        type="text"
                        placeholder="Название предмета..."
                        value={addName}
                        onChange={e => setAddName(e.target.value)}
                        className="w-full bg-[#131313] border border-[#1e1e1e] rounded-xl px-3 py-2 text-[13px] text-white placeholder:text-[#2d2d2d] focus:outline-none focus:border-[#22c55e]/40 transition-colors"
                      />
                      {suggestions.length > 0 && (
                        <div className="absolute left-0 right-0 top-full mt-1 bg-[#131313] border border-[#1e1e1e] rounded-xl overflow-hidden z-10 shadow-2xl">
                          {suggestions.map(s => (
                            <button
                              key={s}
                              onClick={() => { setAddName(s); setSuggestions([]); }}
                              className="w-full px-3 py-2 text-left text-[12px] text-[#aaa] hover:bg-[#1a1a1a] hover:text-white transition-colors"
                            >
                              {s}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <select
                        value={addCategory}
                        onChange={e => setAddCategory(e.target.value)}
                        className="flex-1 bg-[#131313] border border-[#1e1e1e] rounded-xl px-3 py-2 text-[11px] text-[#888] focus:outline-none focus:border-[#22c55e]/40 transition-colors"
                      >
                        {CATEGORIES.filter(c => c !== "Все").map(c => (
                          <option key={c} value={c} className="bg-[#131313]">{c}</option>
                        ))}
                      </select>
                      <input
                        type="number"
                        placeholder="Макс. цена $"
                        value={addPrice}
                        onChange={e => setAddPrice(e.target.value)}
                        className="flex-1 bg-[#131313] border border-[#1e1e1e] rounded-xl px-3 py-2 text-[13px] text-white placeholder:text-[#2d2d2d] focus:outline-none focus:border-[#22c55e]/40 transition-colors"
                      />
                    </div>
                    <button
                      onClick={addToWishlist}
                      disabled={!addName.trim() || !addPrice}
                      className="w-full bg-[#22c55e] text-black text-[12px] font-bold py-2 rounded-xl hover:bg-[#16a34a] transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      Добавить в отслеживание
                    </button>
                  </div>
                )}

                <div className="divide-y divide-[#121212] max-h-64 overflow-y-auto">
                  {wishlist.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-10 text-[#252525]">
                      <Icon name="Plus" size={26} className="mb-2" />
                      <p className="text-[11px]">Добавь предметы для отслеживания</p>
                    </div>
                  ) : wishlist.map(item => (
                    <div key={item.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-[#0d0d0d] transition-colors">
                      <button
                        onClick={() => toggleActive(item)}
                        className={`w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center shrink-0 transition-all ${
                          item.active ? "border-[#22c55e] bg-[#22c55e]" : "border-[#252525]"
                        }`}
                      >
                        {item.active && <div className="w-1 h-1 rounded-full bg-black" />}
                      </button>
                      <div className="flex-1 min-w-0">
                        <p className={`text-[12px] font-medium truncate ${item.active ? "text-[#c8c8c8]" : "text-[#303030]"}`}>
                          {item.name}
                        </p>
                        <p className="text-[10px] text-[#282828]">{item.category}</p>
                      </div>
                      <span className={`text-[11px] font-semibold shrink-0 ${item.active ? "text-[#22c55e]" : "text-[#252525]"}`}>
                        до {fmt(item.max_price)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Found lots panel */}
              <div className="bg-[#0e0e0e] border border-[#181818] rounded-2xl overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 border-b border-[#141414]">
                  <div className="flex items-center gap-2">
                    <Icon name="Bell" size={13} className="text-[#22c55e]" />
                    <span className="text-[12px] font-semibold text-white">Найденные лоты</span>
                    {alerts.length > 0 && (
                      <span className="text-[10px] text-black bg-[#22c55e] px-1.5 py-0.5 rounded-full font-bold leading-none">{alerts.length}</span>
                    )}
                  </div>
                  {alerts.length > 0 && (
                    <button onClick={() => setAlerts([])} className="text-[10px] text-[#333] hover:text-[#666] transition-colors">
                      Сбросить
                    </button>
                  )}
                </div>
                <div className="divide-y divide-[#121212] max-h-64 overflow-y-auto">
                  {recentLots.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-10 text-[#252525]">
                      <Icon name="Radar" size={26} className="mb-2" />
                      <p className="text-[11px]">Запусти мониторинг — найдём лоты</p>
                    </div>
                  ) : recentLots.map(lot => (
                    <a
                      key={lot.id}
                      href={lot.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-3 px-4 py-2.5 hover:bg-[#0d0d0d] transition-colors group"
                    >
                      <div className="w-8 h-8 rounded-lg bg-[#131313] border border-[#1a1a1a] overflow-hidden shrink-0">
                        {lot.image ? (
                          <img src={lot.image} alt={lot.title} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <Icon name="Package" size={13} className="text-[#252525]" />
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[12px] font-medium text-[#c0c0c0] truncate group-hover:text-white transition-colors">
                          {lot.title}
                        </p>
                        <p className="text-[10px] text-[#333]">{lot.wishlist_name}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-[12px] font-bold text-[#22c55e]">{fmt(lot.price)}</p>
                        <Icon name="ExternalLink" size={10} className="text-[#2a2a2a] group-hover:text-[#22c55e] transition-colors mt-0.5 ml-auto" />
                      </div>
                    </a>
                  ))}
                </div>
              </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-2">
              {[
                { label: "В списке", value: wishlist.length, icon: "Heart" },
                { label: "Активных", value: activeCount, icon: "Radio" },
                { label: "Найдено", value: recentLots.length, icon: "Zap" },
              ].map(s => (
                <div key={s.label} className="bg-[#0e0e0e] border border-[#181818] rounded-xl p-3 text-center">
                  <Icon name={s.icon} size={13} className="text-[#22c55e] mx-auto mb-1.5" fallback="Circle" />
                  <p className="text-xl font-bold text-white">{s.value}</p>
                  <p className="text-[10px] text-[#333] mt-0.5">{s.label}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* === CATALOG TAB === */}
        {tab === "catalog" && (
          <div className="space-y-4">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Icon name="Search" size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#333]" />
                <input
                  type="text"
                  placeholder="Поиск предмета..."
                  value={catSearch}
                  onChange={e => setCatSearch(e.target.value)}
                  className="w-full bg-[#0e0e0e] border border-[#181818] rounded-xl pl-9 pr-4 py-2.5 text-[13px] text-white placeholder:text-[#2a2a2a] focus:outline-none focus:border-[#22c55e]/30 transition-colors"
                />
              </div>
              <button
                onClick={() => setSortDir(d => d === "desc" ? "asc" : "desc")}
                className="px-3.5 bg-[#0e0e0e] border border-[#181818] rounded-xl text-[#444] hover:text-[#22c55e] hover:border-[#22c55e]/20 transition-all text-[11px] flex items-center gap-1.5"
              >
                <Icon name={sortDir === "desc" ? "ArrowDownNarrowWide" : "ArrowUpNarrowWide"} size={13} />
                <span className="hidden sm:inline">{sortDir === "desc" ? "Дороже" : "Дешевле"}</span>
              </button>
            </div>
            <div className="flex gap-1.5 flex-wrap">
              {CATEGORIES.map(cat => (
                <button
                  key={cat}
                  onClick={() => setActiveCategory(cat)}
                  className={`px-3 py-1.5 rounded-lg text-[11px] font-medium transition-all ${
                    activeCategory === cat
                      ? "bg-[#22c55e] text-black"
                      : "bg-[#0e0e0e] text-[#444] border border-[#181818] hover:text-[#aaa] hover:border-[#222]"
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
            <div className="text-[11px] text-[#333] mb-1">{filtered.length} позиций</div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
              {filtered.map(item => {
                const icons: Record<string, string> = {
                  "Оружие": "Crosshair", "Патроны": "Dot", "Наркотики": "Leaf",
                  "Еда и напитки": "UtensilsCrossed", "Одежда": "Shirt",
                  "Материалы": "Hammer", "Техника": "Cpu", "Прочее": "Package",
                };
                return (
                  <div key={item.id} className="group bg-[#0e0e0e] border border-[#181818] rounded-xl p-3 hover:border-[#22c55e]/20 hover:bg-[#101010] transition-all">
                    <div className="w-6 h-6 rounded-md bg-[#141414] flex items-center justify-center mb-2 group-hover:bg-[#22c55e]/10 transition-colors">
                      <Icon name={icons[item.category] || "Package"} size={11} className="text-[#303030] group-hover:text-[#22c55e] transition-colors" fallback="Package" />
                    </div>
                    <p className="text-[12px] font-medium text-[#b0b0b0] mb-1.5 line-clamp-2 leading-snug">{item.name}</p>
                    <p className="text-[14px] font-bold text-[#22c55e] leading-none">
                      {item.buyPrice.toLocaleString("ru-RU")} $
                      {item.unit && <span className="text-[10px] text-[#303030] font-normal ml-1">/ {item.unit}</span>}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}