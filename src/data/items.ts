export interface Item {
  id: number;
  name: string;
  category: string;
  buyPrice: number;
  unit?: string;
}

export const CATEGORIES = [
  "Все",
  "Оружие",
  "Патроны",
  "Наркотики",
  "Еда и напитки",
  "Одежда",
  "Материалы",
  "Техника",
  "Прочее",
];

export const ITEMS: Item[] = [
  // Оружие
  { id: 1, name: "Пистолет", category: "Оружие", buyPrice: 8000 },
  { id: 2, name: "Пистолет-пулемёт", category: "Оружие", buyPrice: 18000 },
  { id: 3, name: "Дробовик", category: "Оружие", buyPrice: 22000 },
  { id: 4, name: "Штурмовая винтовка", category: "Оружие", buyPrice: 45000 },
  { id: 5, name: "Снайперская винтовка", category: "Оружие", buyPrice: 60000 },
  { id: 6, name: "Пистолет .50", category: "Оружие", buyPrice: 25000 },
  { id: 7, name: "Автомат Узи", category: "Оружие", buyPrice: 20000 },
  { id: 8, name: "Карабин", category: "Оружие", buyPrice: 35000 },
  { id: 9, name: "Нож", category: "Оружие", buyPrice: 2000 },
  { id: 10, name: "Бита", category: "Оружие", buyPrice: 3000 },

  // Патроны
  { id: 11, name: "Патроны 9мм", category: "Патроны", buyPrice: 12, unit: "шт" },
  { id: 12, name: "Патроны .45", category: "Патроны", buyPrice: 18, unit: "шт" },
  { id: 13, name: "Патроны 5.56", category: "Патроны", buyPrice: 25, unit: "шт" },
  { id: 14, name: "Дробь 12к", category: "Патроны", buyPrice: 20, unit: "шт" },
  { id: 15, name: "Снайперские патроны", category: "Патроны", buyPrice: 80, unit: "шт" },
  { id: 16, name: "Патроны .50", category: "Патроны", buyPrice: 45, unit: "шт" },

  // Наркотики
  { id: 17, name: "Марихуана", category: "Наркотики", buyPrice: 180, unit: "г" },
  { id: 18, name: "Кокаин", category: "Наркотики", buyPrice: 950, unit: "г" },
  { id: 19, name: "Метамфетамин", category: "Наркотики", buyPrice: 750, unit: "г" },
  { id: 20, name: "Героин", category: "Наркотики", buyPrice: 1100, unit: "г" },
  { id: 21, name: "Таблетки MDMA", category: "Наркотики", buyPrice: 400, unit: "шт" },
  { id: 22, name: "Гашиш", category: "Наркотики", buyPrice: 320, unit: "г" },

  // Еда и напитки
  { id: 23, name: "Бургер", category: "Еда и напитки", buyPrice: 80 },
  { id: 24, name: "Пицца", category: "Еда и напитки", buyPrice: 120 },
  { id: 25, name: "Энергетик", category: "Еда и напитки", buyPrice: 60 },
  { id: 26, name: "Пиво", category: "Еда и напитки", buyPrice: 40 },
  { id: 27, name: "Вода", category: "Еда и напитки", buyPrice: 20 },
  { id: 28, name: "Аптечка малая", category: "Еда и напитки", buyPrice: 350 },
  { id: 29, name: "Аптечка большая", category: "Еда и напитки", buyPrice: 800 },

  // Одежда
  { id: 30, name: "Кроссовки", category: "Одежда", buyPrice: 1200 },
  { id: 31, name: "Джинсы", category: "Одежда", buyPrice: 900 },
  { id: 32, name: "Куртка", category: "Одежда", buyPrice: 2500 },
  { id: 33, name: "Маска", category: "Одежда", buyPrice: 600 },
  { id: 34, name: "Шапка", category: "Одежда", buyPrice: 450 },
  { id: 35, name: "Бронежилет", category: "Одежда", buyPrice: 8500 },

  // Материалы
  { id: 36, name: "Металлолом", category: "Материалы", buyPrice: 25, unit: "кг" },
  { id: 37, name: "Медь", category: "Материалы", buyPrice: 180, unit: "кг" },
  { id: 38, name: "Алюминий", category: "Материалы", buyPrice: 95, unit: "кг" },
  { id: 39, name: "Сталь", category: "Материалы", buyPrice: 130, unit: "кг" },
  { id: 40, name: "Пластик", category: "Материалы", buyPrice: 55, unit: "кг" },
  { id: 41, name: "Стекло", category: "Материалы", buyPrice: 70, unit: "кг" },
  { id: 42, name: "Дерево", category: "Материалы", buyPrice: 40, unit: "кг" },
  { id: 43, name: "Золото", category: "Материалы", buyPrice: 2800, unit: "г" },

  // Техника
  { id: 44, name: "Телефон", category: "Техника", buyPrice: 3500 },
  { id: 45, name: "Ноутбук", category: "Техника", buyPrice: 12000 },
  { id: 46, name: "Планшет", category: "Техника", buyPrice: 7000 },
  { id: 47, name: "Видеокарта", category: "Техника", buyPrice: 9500 },
  { id: 48, name: "Процессор", category: "Техника", buyPrice: 6500 },
  { id: 49, name: "GPS-трекер", category: "Техника", buyPrice: 4200 },

  // Прочее
  { id: 50, name: "Сигареты", category: "Прочее", buyPrice: 85, unit: "пач." },
  { id: 51, name: "Виски", category: "Прочее", buyPrice: 450 },
  { id: 52, name: "Ювелирные украшения", category: "Прочее", buyPrice: 3200 },
  { id: 53, name: "Краска для граффити", category: "Прочее", buyPrice: 250 },
  { id: 54, name: "Отмычка", category: "Прочее", buyPrice: 1800 },
  { id: 55, name: "Поддельный ID", category: "Прочее", buyPrice: 5500 },
];
