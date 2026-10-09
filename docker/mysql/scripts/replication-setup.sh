#!/bin/bash
# One-shot job: points the replica at the primary (GTID auto-positioning) and
# switches it to read-only so ProxySQL classifies it as a reader.
set -eu
ROOT="${MYSQL_ROOT_PASSWORD:?}"

wait_for () {
  until mysqladmin ping -h "$1" -uroot -p"$ROOT" --silent >/dev/null 2>&1; do
    echo "waiting for $1 ..."; sleep 2
  done
}
wait_for mysql-primary
wait_for mysql-replica

# The primary only answers on TCP once its init scripts (users, schema, admin seed) have run.
mysql -h mysql-replica -uroot -p"$ROOT" <<SQL
STOP REPLICA;
CHANGE REPLICATION SOURCE TO
  SOURCE_HOST='mysql-primary',
  SOURCE_PORT=3306,
  SOURCE_USER='repl',
  SOURCE_PASSWORD='repl_pw',
  SOURCE_AUTO_POSITION=1,
  GET_SOURCE_PUBLIC_KEY=1;
START REPLICA;
SQL

# Wait until both replication threads run
for i in $(seq 1 30); do
  STATUS=$(mysql -h mysql-replica -uroot -p"$ROOT" -e "SHOW REPLICA STATUS\G" 2>/dev/null || true)
  if echo "$STATUS" | grep -q "Replica_IO_Running: Yes" && echo "$STATUS" | grep -q "Replica_SQL_Running: Yes"; then
    echo "replication is running"; break
  fi
  sleep 2
done

# Read-only only AFTER the replica has applied the primary's init scripts.
mysql -h mysql-replica -uroot -p"$ROOT" -e "SET PERSIST super_read_only=ON; SET PERSIST read_only=ON;"
echo "replica configured"
