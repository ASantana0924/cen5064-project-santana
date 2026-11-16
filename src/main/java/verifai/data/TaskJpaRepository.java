package verifai.data;

import java.util.List;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;

/** Spring Data access to stored tasks. Only JpaTaskRepository uses it. */
interface TaskJpaRepository extends JpaRepository<TaskEntity, UUID> {

    /** Every stored task, oldest first. */
    List<TaskEntity> findAllByOrderByCreatedAtAscIdAsc();
}
