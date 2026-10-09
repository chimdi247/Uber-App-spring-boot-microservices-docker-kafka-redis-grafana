-- Schema for the RideShare platform. Idempotent (IF NOT EXISTS).
-- Hibernate runs with ddl-auto=none, so this file is the single source of truth.

USE uberapp;

-- ─────────────────────────────────────────────────────────────
-- users  (auth-service)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
    id            BIGINT       NOT NULL AUTO_INCREMENT,
    email         VARCHAR(255) NOT NULL,
    password_hash VARCHAR(100) NOT NULL COMMENT 'BCrypt hash',
    full_name     VARCHAR(100) NOT NULL,
    role          VARCHAR(20)  NOT NULL DEFAULT 'RIDER' COMMENT 'RIDER | DRIVER | ADMIN',
    enabled       TINYINT(1)   NOT NULL DEFAULT 1,
    created_at    DATETIME(6)  NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at    DATETIME(6)  NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    UNIQUE KEY uk_users_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ─────────────────────────────────────────────────────────────
-- rides  (ride-service)
-- status: REQUESTED | MATCHING | ACCEPTED | DRIVER_ARRIVING | RIDE_STARTED |
--         COMPLETED | CANCELLED | NO_DRIVERS_AVAILABLE
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS rides (
    id               VARCHAR(36)  NOT NULL COMMENT 'UUID',
    rider_id         VARCHAR(255) NOT NULL,
    driver_id        VARCHAR(255)     NULL,
    pickup_latitude  DOUBLE       NOT NULL,
    pickup_longitude DOUBLE       NOT NULL,
    pickup_address   VARCHAR(512) NOT NULL,
    drop_latitude    DOUBLE       NOT NULL,
    drop_longitude   DOUBLE       NOT NULL,
    drop_address     VARCHAR(512) NOT NULL,
    status           VARCHAR(32)  NOT NULL,
    estimated_fare   DOUBLE       NOT NULL DEFAULT 0,
    actual_fare      DOUBLE       NOT NULL DEFAULT 0,
    created_at       DATETIME(6)      NULL,
    updated_at       DATETIME(6)      NULL,
    started_at       DATETIME(6)      NULL,
    completed_at     DATETIME(6)      NULL,
    PRIMARY KEY (id),
    KEY idx_rides_rider_created  (rider_id, created_at),
    KEY idx_rides_driver_created (driver_id, created_at),
    KEY idx_rides_status_created (status, created_at),
    KEY idx_rides_created        (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
