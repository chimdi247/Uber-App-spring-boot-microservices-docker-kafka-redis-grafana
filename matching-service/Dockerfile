# syntax=docker/dockerfile:1
# ─── Build stage ──────────────────────────────────────────────
FROM maven:3.9.6-eclipse-temurin-17 AS build
WORKDIR /build
COPY pom.xml .
# Cache dependencies in their own layer
RUN --mount=type=cache,target=/root/.m2 mvn -B -q dependency:go-offline
COPY src ./src
RUN --mount=type=cache,target=/root/.m2 mvn -B -q -DskipTests clean package \
 && cp target/*.jar /build/app.jar

# ─── Runtime stage ────────────────────────────────────────────
FROM eclipse-temurin:17-jre-jammy
ARG OTEL_AGENT_VERSION=2.10.0
RUN apt-get update \
 && apt-get install -y --no-install-recommends curl \
 && rm -rf /var/lib/apt/lists/* \
 && mkdir -p /opt/otel \
 && curl -fsSL -o /opt/otel/opentelemetry-javaagent.jar \
    "https://github.com/open-telemetry/opentelemetry-java-instrumentation/releases/download/v${OTEL_AGENT_VERSION}/opentelemetry-javaagent.jar" \
 && groupadd --system app && useradd --system --gid app --home /app app
WORKDIR /app
COPY --from=build /build/app.jar /app/app.jar
USER app
ENV TZ=UTC \
    JAVA_OPTS="-XX:MaxRAMPercentage=60 -XX:+ExitOnOutOfMemoryError"
EXPOSE 8084
# The OpenTelemetry agent auto-instruments HTTP, JDBC, Kafka, Redis, Feign, logs and JVM metrics.
# It is configured purely through OTEL_* environment variables (see docker-compose.yml).
ENTRYPOINT ["sh","-c","exec java $JAVA_OPTS -javaagent:/opt/otel/opentelemetry-javaagent.jar -jar /app/app.jar"]
