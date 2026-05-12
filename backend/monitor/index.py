"""
Парсер 5vito — сканирует объявления на сайте по активным позициям вишлиста и сохраняет найденные лоты.
Возвращает список новых находок за текущую сессию.
"""
import json
import os
import re
import psycopg2
import urllib.request
import urllib.parse
import ssl

SCHEMA = "t_p53611971_gta5rp_purchase_app"
BASE_URL = "https://5vito.ru"

# SSL контекст без проверки сертификата (для совместимости)
SSL_CTX = ssl.create_default_context()
SSL_CTX.check_hostname = False
SSL_CTX.verify_mode = ssl.CERT_NONE

def get_conn():
    return psycopg2.connect(os.environ["DATABASE_URL"])

def fetch_html(url: str) -> str:
    """Загружает HTML страницы с корректными заголовками браузера."""
    req = urllib.request.Request(
        url,
        headers={
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
            "Accept-Language": "ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7",
            "Accept-Encoding": "gzip, deflate, br",
            "Connection": "keep-alive",
            "Upgrade-Insecure-Requests": "1",
            "Sec-Fetch-Dest": "document",
            "Sec-Fetch-Mode": "navigate",
            "Sec-Fetch-Site": "none",
            "Cache-Control": "max-age=0",
        },
    )
    with urllib.request.urlopen(req, timeout=15, context=SSL_CTX) as resp:
        raw = resp.read()
        # Определяем кодировку
        content_type = resp.headers.get("Content-Type", "")
        encoding = "utf-8"
        if "charset=" in content_type:
            encoding = content_type.split("charset=")[-1].strip()
        return raw.decode(encoding, errors="ignore")

def fetch_listings(search_query: str) -> list:
    """Парсит страницу поиска 5vito и возвращает найденные объявления."""
    try:
        encoded = urllib.parse.quote(search_query)
        url = f"{BASE_URL}/search?q={encoded}"
        html = fetch_html(url)
        lots = parse_html(html, search_query)
        # Если поиск вернул мало — попробуем страницу каталога
        if len(lots) < 2:
            url2 = f"{BASE_URL}/catalog?search={encoded}"
            html2 = fetch_html(url2)
            lots2 = parse_html(html2, search_query)
            # Объединяем, убирая дубли по url
            seen = {l["url"] for l in lots}
            for l in lots2:
                if l["url"] not in seen:
                    lots.append(l)
                    seen.add(l["url"])
        return lots[:15]
    except Exception as e:
        print(f"[fetch_listings] error for '{search_query}': {e}")
        return []

def parse_html(html: str, query: str) -> list:
    """
    Извлекает лоты из HTML страницы 5vito.
    Использует несколько стратегий парсинга для максимальной надёжности.
    """
    lots = []
    query_lower = query.lower()

    # --- Стратегия 1: JSON-like данные в скриптах (Next.js / Nuxt hydration) ---
    json_lots = _parse_json_data(html, query_lower)
    lots.extend(json_lots)

    # --- Стратегия 2: Парсинг HTML карточек ---
    if len(lots) < 3:
        html_lots = _parse_html_cards(html, query_lower)
        seen_urls = {l["url"] for l in lots}
        for l in html_lots:
            if l["url"] not in seen_urls:
                lots.append(l)
                seen_urls.add(l["url"])

    # --- Стратегия 3: Общий паттерн цена + ссылка ---
    if len(lots) < 2:
        fallback_lots = _parse_fallback(html, query_lower)
        seen_urls = {l["url"] for l in lots}
        for l in fallback_lots:
            if l["url"] not in seen_urls:
                lots.append(l)
                seen_urls.add(l["url"])

    return lots[:15]

def _clean_text(text: str) -> str:
    """Очищает текст от HTML тегов и лишних пробелов."""
    text = re.sub(r'<[^>]+>', ' ', text)
    text = re.sub(r'&nbsp;', ' ', text)
    text = re.sub(r'&amp;', '&', text)
    text = re.sub(r'&lt;', '<', text)
    text = re.sub(r'&gt;', '>', text)
    text = re.sub(r'&quot;', '"', text)
    text = re.sub(r'\s+', ' ', text).strip()
    return text

def _parse_price(text: str) -> int:
    """Извлекает число из строки с ценой."""
    cleaned = re.sub(r'[^\d]', '', text)
    if cleaned and len(cleaned) <= 12:
        try:
            return int(cleaned)
        except Exception:
            pass
    return 0

def _parse_json_data(html: str, query_lower: str) -> list:
    """Ищет JSON данные о товарах внутри HTML (SSR данные)."""
    lots = []
    # Паттерны для JSON в script тегах
    patterns = [
        r'"title"\s*:\s*"([^"]{3,80})"[^}]*?"price"\s*:\s*(\d+)[^}]*?"(?:url|link|href|slug)"\s*:\s*"([^"]{3,200})"',
        r'"name"\s*:\s*"([^"]{3,80})"[^}]*?"price"\s*:\s*(\d+)[^}]*?"(?:url|link|href|slug)"\s*:\s*"([^"]{3,200})"',
        r'"(?:title|name)"\s*:\s*"([^"]{3,80})".*?"price"\s*:\s*(\d+)',
    ]
    
    for pattern in patterns:
        matches = re.findall(pattern, html, re.IGNORECASE | re.DOTALL)
        for match in matches:
            if len(match) >= 2:
                title = match[0].strip()
                try:
                    price = int(match[1])
                except Exception:
                    continue
                url_part = match[2] if len(match) > 2 else ""
                if query_lower not in title.lower():
                    continue
                if price <= 0 or price > 100_000_000:
                    continue
                full_url = url_part if url_part.startswith("http") else (BASE_URL + "/" + url_part.lstrip("/"))
                lots.append({
                    "title": title,
                    "price": price,
                    "url": full_url,
                    "image": None,
                })
        if lots:
            break
    
    return lots[:10]

def _parse_html_cards(html: str, query_lower: str) -> list:
    """Парсит HTML карточки объявлений."""
    lots = []
    
    # Паттерны CSS-классов для типичных маркетплейсов
    card_patterns = [
        # Обёртка карточки с href
        r'<a[^>]+href="(/[^"]{3,150})"[^>]*>(.*?)</a>',
        # div/article с data атрибутами
        r'<(?:article|div|li)[^>]*class="[^"]*(?:card|item|lot|product|listing)[^"]*"[^>]*>(.*?)</(?:article|div|li)>',
    ]
    
    # Ищем карточки
    for card_pat in card_patterns:
        cards = re.findall(card_pat, html, re.DOTALL | re.IGNORECASE)
        for card in cards:
            if isinstance(card, tuple):
                href = card[0] if card[0].startswith('/') else None
                content = card[1] if len(card) > 1 else card[0]
            else:
                href = None
                content = card
            
            # Извлекаем текст для поиска
            text = _clean_text(content)
            if query_lower not in text.lower():
                continue
            
            # Цена — ищем число рядом с ₽ или $
            price_match = re.search(r'([\d][\d\s]{1,10}[\d])\s*(?:₽|\$|руб)', content, re.IGNORECASE)
            if not price_match:
                price_match = re.search(r'(?:price|цена)["\s:>]+(\d[\d\s]{1,8}\d)', content, re.IGNORECASE)
            if not price_match:
                continue
            price = _parse_price(price_match.group(1))
            if price <= 0 or price > 100_000_000:
                continue
            
            # URL
            if not href:
                link_match = re.search(r'href="(/[^"]{3,150})"', content, re.IGNORECASE)
                href = link_match.group(1) if link_match else None
            if not href:
                continue
            full_url = BASE_URL + href if href.startswith('/') else href
            
            # Заголовок
            title_match = re.search(
                r'<(?:h[1-6]|span|div|p)[^>]*class="[^"]*(?:title|name|heading|caption)[^"]*"[^>]*>\s*([^<]{3,100})\s*<',
                content, re.IGNORECASE
            )
            if title_match:
                title = _clean_text(title_match.group(1))
            else:
                # Берём первый длинный текстовый фрагмент
                texts = re.findall(r'>([^<]{5,80})<', content)
                title = next((t.strip() for t in texts if len(t.strip()) > 4 and query_lower in t.lower()), text[:60])
            
            # Картинка
            img_match = re.search(r'<img[^>]+src="(https?://[^"]{10,}(?:jpg|jpeg|png|webp)[^"]*)"', content, re.IGNORECASE)
            image = img_match.group(1) if img_match else None
            
            lots.append({
                "title": title[:100],
                "price": price,
                "url": full_url,
                "image": image,
            })
            
            if len(lots) >= 10:
                break
        
        if lots:
            break
    
    return lots

def _parse_fallback(html: str, query_lower: str) -> list:
    """Последний резервный парсер — ищет любые ценники рядом с нужными словами."""
    lots = []
    
    # Разбиваем HTML на блоки по 500 символов
    step = 300
    window = 600
    for i in range(0, len(html), step):
        chunk = html[i:i + window]
        
        if query_lower not in chunk.lower():
            continue
        
        # Ищем цену
        price_match = re.search(r'(\d[\d\s]{1,10}\d)\s*(?:₽|\$)', chunk)
        if not price_match:
            continue
        price = _parse_price(price_match.group(1))
        if price <= 0 or price > 100_000_000:
            continue
        
        # Ищем ссылку
        link_match = re.search(r'href="(/[^"?#]{5,})"', chunk)
        if not link_match:
            continue
        href = link_match.group(1)
        full_url = BASE_URL + href
        
        # Заголовок — чистый текст из чанка
        texts = [t.strip() for t in re.findall(r'>([^<]{4,80})<', chunk) if query_lower in t.lower()]
        title = texts[0] if texts else query_lower
        
        lots.append({
            "title": _clean_text(title)[:100],
            "price": price,
            "url": full_url,
            "image": None,
        })
        
        if len(lots) >= 5:
            break
    
    return lots

def handler(event: dict, context) -> dict:
    headers = {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
        "Content-Type": "application/json",
    }

    if event.get("httpMethod") == "OPTIONS":
        return {"statusCode": 200, "headers": headers, "body": ""}

    conn = get_conn()
    cur = conn.cursor()
    new_finds = []

    try:
        # Получаем активные позиции вишлиста
        cur.execute(
            f"SELECT id, name, category, max_price FROM {SCHEMA}.wishlist WHERE active=TRUE ORDER BY id"
        )
        wishlist = cur.fetchall()

        for wid, wname, wcategory, wmax_price in wishlist:
            lots = fetch_listings(wname)
            print(f"[scan] '{wname}' — найдено лотов: {len(lots)}")

            for lot in lots:
                if lot["price"] > wmax_price:
                    continue

                # Проверяем — не сохраняли ли уже этот лот
                cur.execute(
                    f"SELECT id FROM {SCHEMA}.found_lots WHERE wishlist_id=%s AND lot_url=%s",
                    (wid, lot["url"]),
                )
                exists = cur.fetchone()
                if exists:
                    continue

                cur.execute(
                    f"""INSERT INTO {SCHEMA}.found_lots (wishlist_id, lot_title, lot_price, lot_url, lot_image)
                        VALUES (%s, %s, %s, %s, %s) RETURNING id""",
                    (wid, lot["title"], lot["price"], lot["url"], lot.get("image")),
                )
                lot_id = cur.fetchone()[0]
                conn.commit()

                new_finds.append({
                    "id": lot_id,
                    "wishlist_id": wid,
                    "wishlist_name": wname,
                    "max_price": wmax_price,
                    "title": lot["title"],
                    "price": lot["price"],
                    "url": lot["url"],
                    "image": lot.get("image"),
                })

        # Также возвращаем последние находки из БД
        cur.execute(
            f"""SELECT fl.id, fl.wishlist_id, w.name, w.max_price, fl.lot_title, fl.lot_price, fl.lot_url, fl.lot_image, fl.found_at
                FROM {SCHEMA}.found_lots fl
                JOIN {SCHEMA}.wishlist w ON w.id = fl.wishlist_id
                ORDER BY fl.found_at DESC LIMIT 50"""
        )
        rows = cur.fetchall()
        recent = [
            {
                "id": r[0],
                "wishlist_id": r[1],
                "wishlist_name": r[2],
                "max_price": r[3],
                "title": r[4],
                "price": r[5],
                "url": r[6],
                "image": r[7],
                "found_at": r[8].isoformat() if r[8] else None,
            }
            for r in rows
        ]

    finally:
        cur.close()
        conn.close()

    return {
        "statusCode": 200,
        "headers": headers,
        "body": json.dumps({
            "new_finds": new_finds,
            "new_count": len(new_finds),
            "recent": recent,
        }),
    }
