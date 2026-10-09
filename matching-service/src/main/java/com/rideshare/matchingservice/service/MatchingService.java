package com.rideshare.matchingservice.service;

import com.rideshare.matchingservice.client.LocationServiceClient;
import com.rideshare.matchingservice.dto.NearByDriverResponse;
import com.rideshare.matchingservice.event.RideMatchedEvent;
import com.rideshare.matchingservice.event.RideRequestedEvent;
import io.opentelemetry.api.trace.Span;
import io.opentelemetry.instrumentation.annotations.WithSpan;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.stereotype.Service;

import java.util.Comparator;
import java.util.List;
import java.util.Optional;

@Service
@Slf4j
@RequiredArgsConstructor
public class MatchingService {

    private final LocationServiceClient locationServiceClient;
    private final KafkaTemplate<String, RideMatchedEvent> kafkaTemplate;
    private final MatchingMetrics metrics;

    private static final String RIDE_MATCHED_TOPIC = "ride.matched";
    private static final double DEFAULT_SEARCH_RADIUS_KM = 5.0;

    /**
     * Main matching alogorith
     * Called when RideRequestedEvent is consumed from Kafka
     * @param event
     *
     * STEPS:
     * 1. Ask Location Service for nearby drivers
     * 2. Score each driver and pick the best one
     */

    @WithSpan("MatchingService.matchDriverForRide")
    public void matchDriverForRide(RideRequestedEvent event){
        long started = System.nanoTime();
        metrics.attempt();
        Span.current().setAttribute("ride.id", event.getRideId());
        try {
            List<NearByDriverResponse> nearByDrivers = locationServiceClient.getNearByDrivers(
                    event.getPickupLatitude(),
                    event.getPickupLongitude(),
                    DEFAULT_SEARCH_RADIUS_KM
            );

            Optional<NearByDriverResponse> bestDriver = nearByDrivers.isEmpty()
                    ? Optional.empty()
                    : findBestDriver(nearByDrivers);

            if (bestDriver.isEmpty()) {
                log.warn("No drivers found near ride {}", event.getRideId());
                metrics.noDriver();
                // Tell ride-service so the rider is not left waiting forever
                kafkaTemplate.send(RIDE_MATCHED_TOPIC, event.getRideId(),
                        new RideMatchedEvent(event.getRideId(), event.getRiderId(), null, 0, 0, 0));
                return;
            }

            NearByDriverResponse assignedDriver = bestDriver.get();
            Span.current().setAttribute("driver.id", assignedDriver.getDriverId());

            RideMatchedEvent matchedEvent = new RideMatchedEvent(
                    event.getRideId(),
                    event.getRiderId(),
                    assignedDriver.getDriverId(),
                    assignedDriver.getLatitude(),
                    assignedDriver.getLongitude(),
                    assignedDriver.getDistanceInKm()
            );
            kafkaTemplate.send(RIDE_MATCHED_TOPIC, event.getRideId(), matchedEvent);
            metrics.matched();
            log.info("RideMatchedEvent published for ride {} -> {}", event.getRideId(), assignedDriver.getDriverId());
        } catch (RuntimeException e) {
            metrics.error();
            throw e;
        } finally {
            metrics.duration((System.nanoTime() - started) / 1_000_000_000.0);
        }
    }

    /** Called when matching itself failed (e.g. location-service down) so the rider gets an answer. */
    public void reportUnmatched(RideRequestedEvent event) {
        kafkaTemplate.send(RIDE_MATCHED_TOPIC, event.getRideId(),
                new RideMatchedEvent(event.getRideId(), event.getRiderId(), null, 0, 0, 0));
    }

    /**
     * Driver Scoring algorithm
     *
     * Distance: 70%
     * Rating: 30%
     *
     * Score = (1 / distance) * distanceWeight + rating * ratingWeight
     *
     * @param drivers
     * @return
     */

    private Optional<NearByDriverResponse> findBestDriver(
            List<NearByDriverResponse> drivers){

        double distanceWeight = 0.7;
        double ratingWeight = 0.3;

        return drivers.stream()
                .max(Comparator.comparingDouble(driver -> {
                    //Distance score: closer = higher score
                    // Add 0.1 to avoid division by zero
                    double distanceScore = 1.0/(driver.getDistanceInKm() + 0.1);

                    // Simulated rating between 4.0 and 5.0
                    // In production: fetch from Driver Service

                    double simulatedRating = 4.0 + Math.random();

                    //Final weighted score
                    return (distanceScore * distanceWeight)
                           + (simulatedRating * ratingWeight);
        }));
    }

}






















