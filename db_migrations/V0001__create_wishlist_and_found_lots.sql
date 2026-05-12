
CREATE TABLE t_p53611971_gta5rp_purchase_app.wishlist (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'Прочее',
  max_price INTEGER NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE t_p53611971_gta5rp_purchase_app.found_lots (
  id SERIAL PRIMARY KEY,
  wishlist_id INTEGER REFERENCES t_p53611971_gta5rp_purchase_app.wishlist(id),
  lot_title TEXT NOT NULL,
  lot_price INTEGER NOT NULL,
  lot_url TEXT NOT NULL,
  lot_image TEXT,
  found_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  notified BOOLEAN NOT NULL DEFAULT FALSE
);
