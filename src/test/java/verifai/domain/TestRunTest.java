package verifai.domain;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;

import java.lang.reflect.Method;
import java.lang.reflect.Modifier;
import java.time.Instant;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.function.Executable;

class TestRunTest {

    private TestRun run(Integer total, Integer passed, Integer failed) {
        return new TestRun("JUnit", total, passed, failed, "LoginCheckTest", "alex", 1);
    }

    private void assertRejected(String message, Executable create) {
        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class, create);
        assertEquals(message, ex.getMessage());
    }

    @Test
    void storesToolCountsSummaryAuthorAndArtifactVersion() {
        TestRun run = new TestRun("JUnit", 14, 12, 1, "1 failure in LoginCheckTest", "dana", 2);
        assertEquals("JUnit", run.getTool());
        assertEquals(14, run.getTotal());
        assertEquals(12, run.getPassed());
        assertEquals(1, run.getFailed());
        assertEquals("1 failure in LoginCheckTest", run.getSummary());
        assertEquals("dana", run.getRecordedBy());
        assertEquals(2, run.getArtifactVersion());
    }

    @Test
    void skippedIsTheRestOfTheTotal() {
        assertEquals(1, run(14, 12, 1).getSkipped());
        assertEquals(0, run(5, 5, 0).getSkipped());
        assertEquals(0, run(5, 0, 5).getSkipped());
        assertEquals(5, run(5, 0, 0).getSkipped());
    }

    @Test
    void artifactVersionIsNullWhenThereWasNoArtifact() {
        assertNull(new TestRun("JUnit", 3, 3, 0, "", "alex", null).getArtifactVersion());
    }

    @Test
    void textIsTrimmedAndSummaryIsOptional() {
        TestRun run = new TestRun("  pytest ", 3, 3, 0, "  All pass  ", " dana ", 1);
        assertEquals("pytest", run.getTool());
        assertEquals("All pass", run.getSummary());
        assertEquals("dana", run.getRecordedBy());
        assertEquals("", new TestRun("JUnit", 3, 3, 0, null, "alex", 1).getSummary());
        assertEquals("", new TestRun("JUnit", 3, 3, 0, "   ", "alex", 1).getSummary());
    }

    @Test
    void recordedTimeIsSetBySystem() {
        Instant before = Instant.now();
        TestRun run = run(3, 3, 0);
        Instant after = Instant.now();
        assertNotNull(run.getRecordedAt());
        assertFalse(run.getRecordedAt().isBefore(before));
        assertFalse(run.getRecordedAt().isAfter(after));
    }

    @Test
    void negativeCountsAreRejected() {
        assertRejected("Total cannot be negative", () -> run(-1, 0, 0));
        assertRejected("Passed cannot be negative", () -> run(3, -1, 0));
        assertRejected("Failed cannot be negative", () -> run(3, 0, -1));
    }

    @Test
    void passedPlusFailedMoreThanTotalIsRejected() {
        assertRejected("Passed plus failed cannot be more than the total", () -> run(10, 8, 3));
        assertRejected("Passed plus failed cannot be more than the total", () -> run(10, 11, 0));
        assertRejected("Passed plus failed cannot be more than the total", () -> run(10, 0, 11));
    }

    @Test
    void passedPlusFailedEqualToTotalIsAllowed() {
        assertEquals(10, run(10, 7, 3).getTotal());
    }

    @Test
    void hugeCountsDoNotOverflowPastTheTotalCheck() {
        assertRejected("Passed plus failed cannot be more than the total",
                () -> run(Integer.MAX_VALUE, Integer.MAX_VALUE, Integer.MAX_VALUE));
    }

    @Test
    void runWithNoTestsIsRejected() {
        assertRejected("A test run must include at least one test", () -> run(0, 0, 0));
    }

    @Test
    void missingCountsAreRejected() {
        assertRejected("Total is required", () -> run(null, 0, 0));
        assertRejected("Passed is required", () -> run(3, null, 0));
        assertRejected("Failed is required", () -> run(3, 0, null));
    }

    @Test
    void blankToolOrDeveloperIsRejected() {
        assertRejected("Tool is required", () -> new TestRun(" ", 3, 3, 0, "", "alex", 1));
        assertRejected("Tool is required", () -> new TestRun(null, 3, 3, 0, "", "alex", 1));
        assertRejected("Developer is required", () -> new TestRun("JUnit", 3, 3, 0, "", " ", 1));
        assertRejected("Developer is required", () -> new TestRun("JUnit", 3, 3, 0, "", null, 1));
    }

    @Test
    void onlyTaskCanCreateATestRunAndItCannotChange() {
        assertEquals(0, TestRun.class.getConstructors().length, "No public constructors");
        for (Method method : TestRun.class.getDeclaredMethods()) {
            boolean isPublicSetter = Modifier.isPublic(method.getModifiers())
                    && method.getName().startsWith("set");
            assertFalse(isPublicSetter, "Unexpected setter: " + method.getName());
        }
    }
}
