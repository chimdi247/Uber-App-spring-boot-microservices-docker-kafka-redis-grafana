package com.rideshare.rideservice.service;

import com.rideshare.rideservice.event.RideMatchedEvent;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.stereotype.Service;

@Service
@Slf4j
@RequiredArgsConstructor
public class RideEventConsumer {

    private final RideService rideService;

    @KafkaListener(
            topics = "ride.matched",
            groupId = "ride-service-group"
    )
    public void consumeRideMatchedEvent(RideMatchedEvent event) {
        try {
            if (event.getDriverId() == null || event.getDriverId().isBlank()) {
                // Matching service found nobody nearby
                rideService.markNoDriversAvailable(event.getRideId());
            } else {
                rideService.updateRideWithDriver(event.getRideId(), event.getDriverId());
            }
        } catch (RideNotFoundException e) {
            log.warn("Ignoring match event for unknown ride {}", event.getRideId());
        }
    }
}
