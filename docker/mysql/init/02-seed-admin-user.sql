-- Default login for the web UI
--   email:    admin@example.com
--   password: password123
-- Only the BCrypt hash (cost 10) is stored, never the plain password.
USE uberapp;

INSERT INTO users (email, password_hash, full_name, role, enabled)
VALUES ('admin@example.com',
        '$2b$10$zvEOo3bWAJ7L/JLUAKypheNvNwELk7WHHJiWBWA0/YcFNenYrO41m',
        'Admin User',
        'ADMIN',
        1)
ON DUPLICATE KEY UPDATE
    password_hash = VALUES(password_hash),
    full_name     = VALUES(full_name),
    role          = VALUES(role),
    enabled       = 1;
