package verifai.presentation;

import java.net.URI;
import java.util.List;
import java.util.UUID;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.support.ServletUriComponentsBuilder;

import verifai.domain.Artifact;
import verifai.service.ArtifactService;

/**
 * JSON API for a task's AI artifacts (UC-07 to UC-09). Calls only
 * ArtifactService and returns DTOs. Task assigns the version number and resets
 * the checks; this class only passes the request through.
 */
@RestController
@RequestMapping("/api/tasks/{id}/artifacts")
public class ArtifactController {

    private final ArtifactService artifactService;

    public ArtifactController(ArtifactService artifactService) {
        this.artifactService = artifactService;
    }

    /** UC-07 and UC-08: records the next version. A revision resets all checks and clears approvals. */
    @PostMapping
    public ResponseEntity<ArtifactResponse> recordArtifact(@PathVariable("id") UUID id,
            @RequestBody RecordArtifactRequest request) {
        Artifact artifact = artifactService.recordArtifact(
                id, request.prompt(), request.aiTool(), request.codeContent(), request.developer());
        URI location = ServletUriComponentsBuilder.fromCurrentRequest()
                .path("/{version}")
                .buildAndExpand(artifact.getVersion())
                .toUri();
        return ResponseEntity.created(location).body(ArtifactResponse.from(artifact));
    }

    /** UC-09: lists every version, oldest first, without prompts or code. */
    @GetMapping
    public List<ArtifactSummaryResponse> listVersions(@PathVariable("id") UUID id) {
        return artifactService.listVersions(id).stream().map(ArtifactSummaryResponse::from).toList();
    }

    /** UC-09: shows one version in full. */
    @GetMapping("/{version}")
    public ArtifactResponse getVersion(@PathVariable("id") UUID id, @PathVariable("version") int version) {
        return ArtifactResponse.from(artifactService.getVersion(id, version));
    }
}
