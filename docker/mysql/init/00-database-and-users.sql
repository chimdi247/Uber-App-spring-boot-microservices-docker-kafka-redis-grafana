-- Runs once, on the PRIMARY only, the first time its data volume is created.
-- Everything here is written to the binary log, so the replica receives it too.
-- Dev-only credentials: if you change them, update docker/proxysql/proxysql.cnf,
-- observability/mysqld-exporter/*.my.cnf and docker/mysql/scripts/replication-setup.sh as well.

CREATE DATABASE IF NOT EXISTS uberapp CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

-- Application user (used by auth-service and ride-service through ProxySQL)
CREATE USER IF NOT EXISTS 'uber_app'@'%' IDENTIFIED WITH mysql_native_password BY 'uber_app_pw';
GRANT SELECT, INSERT, UPDATE, DELETE ON uberapp.* TO 'uber_app'@'%';

-- Replication user (replica -> primary)
CREATE USER IF NOT EXISTS 'repl'@'%' IDENTIFIED WITH mysql_native_password BY 'repl_pw';
GRANT REPLICATION SLAVE ON *.* TO 'repl'@'%';

-- ProxySQL health/lag monitor
CREATE USER IF NOT EXISTS 'proxysql_monitor'@'%' IDENTIFIED WITH mysql_native_password BY 'proxysql_monitor_pw';
GRANT USAGE, REPLICATION CLIENT ON *.* TO 'proxysql_monitor'@'%';

-- Prometheus mysqld_exporter
CREATE USER IF NOT EXISTS 'exporter'@'%' IDENTIFIED WITH mysql_native_password BY 'exporter_pw' WITH MAX_USER_CONNECTIONS 5;
GRANT PROCESS, REPLICATION CLIENT, SELECT ON *.* TO 'exporter'@'%';

FLUSH PRIVILEGES;
