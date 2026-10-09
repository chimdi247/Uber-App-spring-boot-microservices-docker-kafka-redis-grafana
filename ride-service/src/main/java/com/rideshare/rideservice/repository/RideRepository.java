package com.rideshare.rideservice.repository;

import com.rideshare.rideservice.model.Ride;
import com.rideshare.rideservice.model.RideStatus;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.jpa.repository.QueryHints;

import jakarta.persistence.QueryHint;
import java.util.List;
import java.util.Optional;

/**
 * Queries annotated with the "route:reader" hint are written by Hibernate as
 * <pre>/* route:reader *&#47; select ...</pre> and ProxySQL sends them to the MySQL replica.
 * Everything else (including findById used by write paths) goes to the primary.
 */
public interface RideRepository extends JpaRepository<Ride, String> {

    String HINT = "org.hibernate.comment";
    String READER = "route:reader";

    @QueryHints(@QueryHint(name = HINT, value = READER))
    List<Ride> findByRiderIdOrderByCreatedAtDesc(String riderId);

    @QueryHints(@QueryHint(name = HINT, value = READER))
    List<Ride> findByDriverIdOrderByCreatedAtDesc(String driverId);

    @QueryHints(@QueryHint(name = HINT, value = READER))
    List<Ride> findAllByOrderByCreatedAtDesc(Pageable pageable);

    @QueryHints(@QueryHint(name = HINT, value = READER))
    List<Ride> findByStatusOrderByCreatedAtDesc(RideStatus status, Pageable pageable);

    @Query("select r from Ride r where r.id = :id")
    @QueryHints(@QueryHint(name = HINT, value = READER))
    Optional<Ride> findByIdFromReplica(@org.springframework.data.repository.query.Param("id") String id);

    @Query("select r.status, count(r) from Ride r group by r.status")
    @QueryHints(@QueryHint(name = HINT, value = READER))
    List<Object[]> countByStatus();

    @Query("select coalesce(sum(r.actualFare), 0.0) from Ride r where r.status = com.rideshare.rideservice.model.RideStatus.COMPLETED")
    @QueryHints(@QueryHint(name = HINT, value = READER))
    Double totalRevenue();
}
