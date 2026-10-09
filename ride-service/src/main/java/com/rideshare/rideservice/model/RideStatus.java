package com.rideshare.rideservice.model;

/**
 * FLOW:
 * REQUESTED -> MATCHING -> ACCEPTED -> DRIVER_ARRIVING
 *           -> RIDE_STARTED -> COMPLETED
 *           -> NO_DRIVERS_AVAILABLE (matching found nobody nearby)
 *           -> CANCELLED (can happen at multiple stages)
 */
public enum RideStatus {
    REQUESTED,
    MATCHING,
    ACCEPTED,
    DRIVER_ARRIVING,
    RIDE_STARTED,
    COMPLETED,
    CANCELLED,
    NO_DRIVERS_AVAILABLE
}
