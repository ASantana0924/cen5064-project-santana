package verifai.data;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;

import jakarta.persistence.LockModeType;

/** Spring Data access to stored tasks. Only JpaTaskRepository uses it. */
interface TaskJpaRepository extends JpaRepository<TaskEntity, UUID> {

    /** Every stored task, oldest first. */
    List<TaskEntity> findAllByOrderByCreatedAtAscIdAsc();

    /**
     * The stored task, with its row locked until the transaction ends
     * ({@code SELECT ... FOR UPDATE}, sent as {@code FOR NO KEY UPDATE} on
     * PostgreSQL). Another call for the same task waits until then; calls for
     * other tasks do not (ADR-010).
     */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    Optional<TaskEntity> findForUpdateById(UUID id);
}
