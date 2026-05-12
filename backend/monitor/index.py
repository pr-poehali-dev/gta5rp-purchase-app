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

SCHEMA = "t_p53611971_gta5rp_purchase_app"
BASE_URL = "https://5vito.ru"

def get_conn():
    return psycopg2.connect(os.environ["DATABASE_URL"])

def fetch_listings(search_query: str) -> list:
    """Парсит страницу поиска 5vito и возвращает найденные объявления."""
    try:
        encoded = urllib.parse.quote(search_query)
        url = f"{BASE_URL}/search?q={encoded}"
        req = urllib.request.Request(
            url,
            headers={
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36",
                "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
                "Accept-Language": "ru-RU,ru;q=0.9",
            },
        )
        with urllib.request.urlopen(req, timeout=10) as resp:
            html = resp.read().decode("utf-8", errors="ignore")
        return parse_html(html, search_query)
    except Exception as e:
        return []

def parse_html(html: str, query: str) -> list:
    """Извлекает лоты из HTML страницы 5vito."""
    lots = []

    # Паттерны для извлечения карточек объявлений 5vito
    card_pattern = re.compile(
        r'href="(/(?:items|product|lot|ad)/[^"]+)"[^>]*>.*?'
        r'(?:<img[^>]+src="([^"]*)"[^>]*>)?.*?'
        r'([\w\s\-\.]+?)(?:\s*<).*?'
        r'([\d\s]+)\s*(?:\$|₽)',
        re.DOTALL | re.IGNORECASE,
    )

    # Более простой паттерн — ищем цены рядом с названиями
    price_pattern = re.compile(r'([\d][\d\s]{2,})\s*(?:\$|₽|\$)', re.IGNORECASE)
    title_pattern = re.compile(
        r'<(?:h[1-6]|span|div)[^>]*class="[^"]*(?:title|name|item)[^"]*"[^>]*>\s*([^<]{3,60})\s*<',
        re.IGNORECASE,
    )
    link_pattern = re.compile(r'href="(/(?:items?|products?|lots?|ads?|p)/[^"?#]{3,})"', re.IGNORECASE)
    img_pattern = re.compile(r'<img[^>]+src="(https?://[^"]+(?:jpg|png|webp)[^"]*)"', re.IGNORECASE)

    titles = title_pattern.findall(html)
    links = link_pattern.findall(html)
    prices_raw = price_pattern.findall(html)
    images = img_pattern.findall(html)

    prices = []
    for p in prices_raw:
        cleaned = re.sub(r'\s+', '', p)
        try:
            prices.append(int(cleaned))
        except Exception:
            pass

    query_lower = query.lower()
    for i, title in enumerate(titles[:20]):
        title_clean = title.strip()
        if query_lower not in title_clean.lower():
            continue
        link = (BASE_URL + links[i]) if i < len(links) else BASE_URL
        price = prices[i] if i < len(prices) else 0
        image = images[i] if i < len(images) else None
        if price > 0:
            lots.append({
                "title": title_clean,
                "price": price,
                "url": link,
                "image": image,
            })

    return lots[:10]

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
            f"SELECT id, name, category, max_price FROM {SCHEMA}.wishlist WHERE active=TRUE"
        )
        wishlist = cur.fetchall()

        for wid, wname, wcategory, wmax_price in wishlist:
            lots = fetch_listings(wname)

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
