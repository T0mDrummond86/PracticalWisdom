-- Downvoting is removed from the product: a single "favourite" (heart) replaces the
-- up/down vote pair. Favourites are still stored as votes with value = 1, so nothing
-- else changes shape — but historical downvotes would skew the favourite counts the
-- UI now shows, so drop them.
DELETE FROM votes WHERE value = -1;
