"""
CRUD для вишлиста — добавление, получение, удаление, переключение активности предметов для отслеживания.
"""
import json
import os
import psycopg2

SCHEMA = "t_p53611971_gta5rp_purchase_app"

def get_conn():
    return psycopg2.connect(os.environ["DATABASE_URL"])

def handler(event: dict, context) -> dict:
    headers = {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
        "Content-Type": "application/json",
    }

    if event.get("httpMethod") == "OPTIONS":
        return {"statusCode": 200, "headers": headers, "body": ""}

    method = event.get("httpMethod", "GET")
    path_params = event.get("pathParameters") or {}
    item_id = path_params.get("id")

    conn = get_conn()
    cur = conn.cursor()

    try:
        if method == "GET":
            cur.execute(
                f"SELECT id, name, category, max_price, active, created_at FROM {SCHEMA}.wishlist ORDER BY created_at DESC"
            )
            rows = cur.fetchall()
            items = [
                {
                    "id": r[0],
                    "name": r[1],
                    "category": r[2],
                    "max_price": r[3],
                    "active": r[4],
                    "created_at": r[5].isoformat() if r[5] else None,
                }
                for r in rows
            ]
            return {"statusCode": 200, "headers": headers, "body": json.dumps({"items": items})}

        elif method == "POST":
            body = json.loads(event.get("body") or "{}")
            name = body["name"].strip()
            category = body.get("category", "Прочее").strip()
            max_price = int(body["max_price"])

            cur.execute(
                f"INSERT INTO {SCHEMA}.wishlist (name, category, max_price) VALUES (%s, %s, %s) RETURNING id",
                (name, category, max_price),
            )
            new_id = cur.fetchone()[0]
            conn.commit()
            return {"statusCode": 201, "headers": headers, "body": json.dumps({"id": new_id, "ok": True})}

        elif method == "PUT":
            body = json.loads(event.get("body") or "{}")
            item_id = body.get("id") or item_id
            active = body.get("active")
            max_price = body.get("max_price")

            if active is not None:
                cur.execute(f"UPDATE {SCHEMA}.wishlist SET active=%s WHERE id=%s", (active, item_id))
            if max_price is not None:
                cur.execute(f"UPDATE {SCHEMA}.wishlist SET max_price=%s WHERE id=%s", (int(max_price), item_id))
            conn.commit()
            return {"statusCode": 200, "headers": headers, "body": json.dumps({"ok": True})}

        elif method == "DELETE":
            body = json.loads(event.get("body") or "{}")
            item_id = body.get("id") or item_id
            cur.execute(f"UPDATE {SCHEMA}.wishlist SET active=FALSE WHERE id=%s", (item_id,))
            conn.commit()
            return {"statusCode": 200, "headers": headers, "body": json.dumps({"ok": True})}

    finally:
        cur.close()
        conn.close()

    return {"statusCode": 405, "headers": headers, "body": json.dumps({"error": "Method not allowed"})}
