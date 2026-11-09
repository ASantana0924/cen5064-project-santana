package verifai.presentation;

/**
 * Body of POST /api/tasks/{id}/test-runs. The counts are Integer so a missing
 * count is reported as missing (400) instead of being read as 0. The summary is
 * optional. The developer is recorded as the person who ran the tests.
 */
public record RecordTestRunRequest(
        String tool, Integer total, Integer passed, Integer failed, String summary, String developer) {
}
