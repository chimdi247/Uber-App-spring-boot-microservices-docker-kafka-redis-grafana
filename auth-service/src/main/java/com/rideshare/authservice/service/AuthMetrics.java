package com.rideshare.authservice.service;

import io.opentelemetry.api.GlobalOpenTelemetry;
import io.opentelemetry.api.common.AttributeKey;
import io.opentelemetry.api.common.Attributes;
import io.opentelemetry.api.metrics.LongCounter;
import io.opentelemetry.api.metrics.Meter;
import org.springframework.stereotype.Component;

/** Prometheus names: auth_logins_total{result}, auth_registrations_total */
@Component
public class AuthMetrics {

    private static final AttributeKey<String> RESULT = AttributeKey.stringKey("result");
    private final LongCounter logins;
    private final LongCounter registrations;

    public AuthMetrics() {
        Meter meter = GlobalOpenTelemetry.getMeter("com.rideshare.authservice");
        logins = meter.counterBuilder("auth.logins").setDescription("Login attempts by result").build();
        registrations = meter.counterBuilder("auth.registrations").setDescription("New user registrations").build();
    }

    public void login(boolean success) {
        logins.add(1, Attributes.of(RESULT, success ? "success" : "failure"));
    }

    public void registered() { registrations.add(1); }
}
