
BEGIN TRANSACTION;
DELETE FROM transactions;
DELETE FROM inventory_items;
DELETE FROM inventory_lots;
DELETE FROM current_accounts;
DELETE FROM stock_cards;
DELETE FROM categories;
DELETE FROM expense_categories;
DELETE FROM finance_records;
DELETE FROM activity_log;
DELETE FROM access_codes;
DELETE FROM users;

-- Re-create Admin (Password: 123)
-- Hash for "123" (Argon2id default parameters used in app, but here we might need to insert a known hash or let app fail gracefully?
-- Actually, inserting a user via SQL with a raw hash is tricky if we don't know the exact parameters.
-- BETTER STRATEGY: Delete all users. App will detect no users and show Setup Screen!
-- Login page logic: if (userList.length > 0) -> Login, else -> Setup.
-- So we just DELETE users. The user can then create admin manually or via setup screen.
-- User asked "girerken kullanıcı adı ve şifre olsun". Setup screen creates that.
-- User asked "bunları sıfıt yaparmısın". Yes.
-- So I will just delete everything.
COMMIT;
