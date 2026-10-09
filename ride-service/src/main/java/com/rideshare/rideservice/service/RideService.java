package com.rideshare.rideservice.service;

import com.rideshare.rideservice.dto.RideRequest;
import com.rideshare.rideservice.dto.RideResponse;
import com.rideshare.rideservice.dto.RideStatsResponse;
import com.rideshare.rideservice.event.RideRequestedEvent;
import com.rideshare.rideservice.model.Ride;
import com.rideshare.rideservice.model.RideStatus;
import com.rideshare.rideservice.repository.RideRepository;
import io.opentelemetry.api.trace.Span;
import io.opentelemetry.instrumentation.annotations.WithSpan;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.PageRequest;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.EnumMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
@Slf4j
@RequiredArgsConstructor
public class RideService {

    private final RideRepository rideRepository;
    private final KafkaTemplate<String, RideRequestedEvent> kafkaTemplate;
    private final RideMetrics metrics;

    private static final String RIDE_REQUESTED_TOPIC = "ride.requested";

    /**
     * Create ride in DB (status MATCHING) and publish the event.
     * The row is committed BEFORE the event is published, otherwise a very fast
     * match result could be overwritten by a late save of this method.
     */
    @WithSpan("RideService.requestRide")
    public RideResponse requestRide(RideRequest request) {
        log.info("New ride request from rider: {}", request.getRiderId());

        Ride ride = new Ride();
        ride.setRiderId(request.getRiderId());
        ride.setPickupLatitude(request.getPickupLatitude());
        ride.setPickupLongitude(request.getPickupLongitude());
        ride.setPickupAddress(request.getPickupAddress());
        ride.setDropLatitude(request.getDropLatitude());
        ride.setDropLongitude(request.getDropLongitude());
        ride.setDropAddress(request.getDropAddress());
        ride.setStatus(RideStatus.MATCHING);
        ride.setEstimatedFare(calculateEstimateFare(request));

        Ride savedRide = rideRepository.save(ride);
        Span.current().setAttribute("ride.id", savedRide.getId());
        metrics.rideRequested();

        RideRequestedEvent event = new RideRequestedEvent(
                savedRide.getId(),
                savedRide.getRiderId(),
                savedRide.getPickupLatitude(),
                savedRide.getPickupLongitude(),
                savedRide.getPickupAddress(),
                savedRide.getDropLatitude(),
                savedRide.getDropLongitude(),
                savedRide.getDropAddress()
        );

        kafkaTemplate.send(RIDE_REQUESTED_TOPIC, savedRide.getId(), event)
                .whenComplete((result, ex) -> {
                    if (ex != null) {
                        log.error("Failed to publish RideRequestedEvent for ride {}: {}", savedRide.getId(), ex.getMessage());
                    } else {
                        log.info("RideRequestedEvent published to Kafka for ride: {}", savedRide.getId());
                    }
                });

        return mapToResponse(savedRide);
    }

    @WithSpan("RideService.updateRideWithDriver")
    public void updateRideWithDriver(String rideId, String driverId) {
        Ride ride = findForUpdate(rideId);
        if (ride.getStatus() != RideStatus.MATCHING && ride.getStatus() != RideStatus.REQUESTED) {
            log.info("Ride {} is {} - ignoring late match", rideId, ride.getStatus());
            return;
        }
        ride.setDriverId(driverId);
        ride.setStatus(RideStatus.ACCEPTED);
        rideRepository.save(ride);

        if (ride.getCreatedAt() != null) {
            double seconds = Duration.between(ride.getCreatedAt(), LocalDateTime.now()).toMillis() / 1000.0;
            metrics.rideMatched(Math.max(seconds, 0));
        } else {
            metrics.rideMatched(0);
        }
        log.info("Ride {} accepted by {}", rideId, driverId);
    }

    @WithSpan("RideService.markNoDriversAvailable")
    public void markNoDriversAvailable(String rideId) {
        Ride ride = findForUpdate(rideId);
        if (ride.getStatus() != RideStatus.MATCHING && ride.getStatus() != RideStatus.REQUESTED) {
            return;
        }
        ride.setStatus(RideStatus.NO_DRIVERS_AVAILABLE);
        rideRepository.save(ride);
        metrics.rideUnmatched();
        log.warn("No drivers available for ride {}", rideId);
    }

    @WithSpan("RideService.startRide")
    public RideResponse startRide(String rideId) {
        Ride ride = findForUpdate(rideId);
        if (ride.getStatus() != RideStatus.ACCEPTED && ride.getStatus() != RideStatus.DRIVER_ARRIVING) {
            throw new IllegalStateException("Ride cannot be started. Current status: " + ride.getStatus());
        }
        ride.setStatus(RideStatus.RIDE_STARTED);
        ride.setStartedAt(LocalDateTime.now());
        rideRepository.save(ride);
        metrics.rideStarted();
        return mapToResponse(ride);
    }

    @WithSpan("RideService.completeRide")
    public RideResponse completeRide(String rideId) {
        Ride ride = findForUpdate(rideId);
        if (ride.getStatus() != RideStatus.RIDE_STARTED) {
            throw new IllegalStateException("Ride cannot be completed. Current status: " + ride.getStatus());
        }
        ride.setStatus(RideStatus.COMPLETED);
        ride.setCompletedAt(LocalDateTime.now());
        ride.setActualFare(ride.getEstimatedFare());
        rideRepository.save(ride);
        metrics.rideCompleted(ride.getActualFare());
        return mapToResponse(ride);
    }

    @WithSpan("RideService.cancelRide")
    public RideResponse cancelRide(String rideId) {
        Ride ride = findForUpdate(rideId);
        if (ride.getStatus() == RideStatus.COMPLETED || ride.getStatus() == RideStatus.CANCELLED) {
            throw new IllegalStateException("Ride cannot be cancelled. Current status: " + ride.getStatus());
        }
        ride.setStatus(RideStatus.CANCELLED);
        rideRepository.save(ride);
        metrics.rideCancelled();
        return mapToResponse(ride);
    }

    /** Polled by the UI - served by the replica, falling back to the primary for brand-new rows. */
    public RideResponse getRideById(String rideId) {
        Ride ride = rideRepository.findByIdFromReplica(rideId)
                .or(() -> rideRepository.findById(rideId))
                .orElseThrow(() -> new RideNotFoundException(rideId));
        return mapToResponse(ride);
    }

    public List<RideResponse> getRidesByRider(String riderId) {
        return rideRepository.findByRiderIdOrderByCreatedAtDesc(riderId)
                .stream().map(this::mapToResponse).collect(Collectors.toList());
    }

    public List<RideResponse> getRidesByDriver(String driverId) {
        return rideRepository.findByDriverIdOrderByCreatedAtDesc(driverId)
                .stream().map(this::mapToResponse).collect(Collectors.toList());
    }

    public List<RideResponse> listRides(RideStatus status, int limit) {
        PageRequest page = PageRequest.of(0, Math.min(Math.max(limit, 1), 200));
        List<Ride> rides = status == null
                ? rideRepository.findAllByOrderByCreatedAtDesc(page)
                : rideRepository.findByStatusOrderByCreatedAtDesc(status, page);
        return rides.stream().map(this::mapToResponse).collect(Collectors.toList());
    }

    public RideStatsResponse getStats() {
        Map<RideStatus, Long> counts = new EnumMap<>(RideStatus.class);
        for (Object[] row : rideRepository.countByStatus()) {
            counts.put((RideStatus) row[0], ((Number) row[1]).longValue());
        }
        long total = counts.values().stream().mapToLong(Long::longValue).sum();
        long active = counts.getOrDefault(RideStatus.MATCHING, 0L)
                + counts.getOrDefault(RideStatus.REQUESTED, 0L)
                + counts.getOrDefault(RideStatus.ACCEPTED, 0L)
                + counts.getOrDefault(RideStatus.DRIVER_ARRIVING, 0L)
                + counts.getOrDefault(RideStatus.RIDE_STARTED, 0L);
        Map<String, Long> byStatus = new LinkedHashMap<>();
        for (RideStatus s : RideStatus.values()) {
            byStatus.put(s.name(), counts.getOrDefault(s, 0L));
        }
        Double revenue = rideRepository.totalRevenue();
        return new RideStatsResponse(
                total,
                active,
                counts.getOrDefault(RideStatus.COMPLETED, 0L),
                counts.getOrDefault(RideStatus.CANCELLED, 0L),
                counts.getOrDefault(RideStatus.NO_DRIVERS_AVAILABLE, 0L),
                revenue == null ? 0 : revenue,
                byStatus);
    }

    /** Write paths always read from the primary (no reader hint). */
    private Ride findForUpdate(String rideId) {
        return rideRepository.findById(rideId).orElseThrow(() -> new RideNotFoundException(rideId));
    }

    private double calculateEstimateFare(RideRequest request) {
        double lat1 = Math.toRadians(request.getPickupLatitude());
        double lat2 = Math.toRadians(request.getDropLatitude());
        double lon1 = Math.toRadians(request.getPickupLongitude());
        double lon2 = Math.toRadians(request.getDropLongitude());

        double dLat = lat2 - lat1;
        double dLon = lon2 - lon1;

        double a = Math.pow(Math.sin(dLat / 2), 2)
                + Math.cos(lat1) * Math.cos(lat2) * Math.pow(Math.sin(dLon / 2), 2);

        double c = 2 * Math.asin(Math.sqrt(a));
        double distanceKm = 6371 * c;

        // Base fare: 50 + 12 per km
        double fare = 50 + (distanceKm * 12);
        return Math.round(fare * 100.0) / 100.0;
    }

    private RideResponse mapToResponse(Ride ride) {
        RideResponse response = new RideResponse();
        response.setId(ride.getId());
        response.setRiderId(ride.getRiderId());
        response.setDriverId(ride.getDriverId());
        response.setPickupLatitude(ride.getPickupLatitude());
        response.setPickupLongitude(ride.getPickupLongitude());
        response.setPickupAddress(ride.getPickupAddress());
        response.setDropLatitude(ride.getDropLatitude());
        response.setDropLongitude(ride.getDropLongitude());
        response.setDropAddress(ride.getDropAddress());
        response.setStatus(ride.getStatus());
        response.setEstimatedFare(ride.getEstimatedFare());
        response.setActualFare(ride.getActualFare());
        response.setCreatedAt(ride.getCreatedAt());
        response.setUpdatedAt(ride.getUpdatedAt());
        response.setStartedAt(ride.getStartedAt());
        response.setCompletedAt(ride.getCompletedAt());
        return response;
    }
}
