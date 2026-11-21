ALTER TABLE flat_pins DROP COLUMN IF EXISTS is_for_sale;
ALTER TABLE flat_pins DROP COLUMN IF EXISTS sale_price;
DROP INDEX IF EXISTS idx_flat_pins_is_for_sale;
