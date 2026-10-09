package com.rideshare.rideservice.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.Map;

@Data
@AllArgsConstructor
@NoArgsConstructor
public class RideStatsResponse {
    private long totalRides;
    private long activeRides;
    private long completedRides;
    private long cancelledRides;
    private long unmatchedRides;
    private double totalRevenue;
    private Map<String, Long> byStatus;
}
