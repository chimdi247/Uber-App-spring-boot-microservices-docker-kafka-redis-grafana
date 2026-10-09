package com.rideshare.authservice.service;

import com.rideshare.authservice.dto.AuthDtos.*;
import com.rideshare.authservice.model.User;
import com.rideshare.authservice.repository.UserRepository;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import io.opentelemetry.instrumentation.annotations.WithSpan;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

@Service
@Slf4j
@RequiredArgsConstructor
public class AuthService {

    private final UserRepository users;
    private final PasswordEncoder encoder;
    private final JwtService jwt;
    private final AuthMetrics metrics;

    @WithSpan("AuthService.login")
    public AuthResponse login(LoginRequest request) {
        User user = users.findByEmailIgnoreCase(request.email().trim()).orElse(null);
        boolean ok = user != null && user.isEnabled()
                && encoder.matches(request.password(), user.getPasswordHash());
        metrics.login(ok);
        if (!ok) {
            log.warn("Failed login attempt");
            throw new AuthException("Invalid email or password");
        }
        log.info("User {} logged in", user.getId());
        return toAuthResponse(user);
    }

    @WithSpan("AuthService.register")
    public AuthResponse register(RegisterRequest request) {
        String email = request.email().trim().toLowerCase();
        if (users.existsByEmailIgnoreCase(email)) {
            throw new ConflictException("An account with this email already exists");
        }
        User user = new User();
        user.setEmail(email);
        user.setFullName(request.fullName().trim());
        user.setPasswordHash(encoder.encode(request.password()));
        user.setRole("RIDER");
        user.setEnabled(true);
        user = users.save(user);
        metrics.registered();
        log.info("Registered user {}", user.getId());
        return toAuthResponse(user);
    }

    public UserResponse me(String bearerToken) {
        try {
            Claims claims = jwt.parse(bearerToken);
            User user = users.findById(Long.valueOf(claims.getSubject()))
                    .filter(User::isEnabled)
                    .orElseThrow(() -> new AuthException("User no longer exists"));
            return toUserResponse(user);
        } catch (JwtException | IllegalArgumentException e) {
            throw new AuthException("Invalid or expired token");
        }
    }

    private AuthResponse toAuthResponse(User user) {
        return new AuthResponse(jwt.generate(user), "Bearer", jwt.expiresInSeconds(), toUserResponse(user));
    }

    private UserResponse toUserResponse(User u) {
        return new UserResponse(u.getId(), "rider:" + u.getId(), u.getEmail(), u.getFullName(), u.getRole());
    }

    public static class AuthException extends RuntimeException {
        public AuthException(String message) { super(message); }
    }

    public static class ConflictException extends RuntimeException {
        public ConflictException(String message) { super(message); }
    }
}
