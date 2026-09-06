-- How a tip's picture sits in the card: where it goes in the flow, whether text wraps
-- around it, and how wide it is as a fraction of the card. Defaults reproduce the
-- rendering every tip already had (a full-width picture above the text), so existing
-- rows are untouched by this migration in everything but schema.
ALTER TABLE tips ADD COLUMN image_pos   TEXT NOT NULL DEFAULT 'above';  -- above|between|below
ALTER TABLE tips ADD COLUMN image_align TEXT NOT NULL DEFAULT 'full';   -- full|left|right
ALTER TABLE tips ADD COLUMN image_size  TEXT NOT NULL DEFAULT 'm';      -- s|m|l  (30/50/100%)
