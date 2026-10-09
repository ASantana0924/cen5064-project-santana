package verifai.domain;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;

import java.lang.reflect.Method;
import java.lang.reflect.Modifier;
import java.time.Instant;

import org.junit.jupiter.api.Test;

class ArtifactTest {

    private Artifact newArtifact() {
        return Artifact.first("Write a login check", "Claude", "boolean ok() { return true; }");
    }

    @Test
    void firstArtifactIsVersionOne() {
        Artifact artifact = newArtifact();
        assertEquals(1, artifact.getVersion());
        assertEquals("Write a login check", artifact.getPrompt());
        assertEquals("Claude", artifact.getAiTool());
        assertEquals("boolean ok() { return true; }", artifact.getCodeContent());
    }

    @Test
    void reviseIncreasesVersionByOne() {
        Artifact v2 = newArtifact().revise("Handle null input", "Claude", "boolean ok(String s) { return s != null; }");
        Artifact v3 = v2.revise("Trim input", "Copilot", "boolean ok(String s) { return s != null && !s.isBlank(); }");
        assertEquals(2, v2.getVersion());
        assertEquals(3, v3.getVersion());
        assertEquals("Copilot", v3.getAiTool());
    }

    @Test
    void reviseLeavesEarlierVersionUnchanged() {
        Artifact v1 = newArtifact();
        v1.revise("Handle null input", "Copilot", "new code");
        assertEquals(1, v1.getVersion());
        assertEquals("Write a login check", v1.getPrompt());
        assertEquals("Claude", v1.getAiTool());
        assertEquals("boolean ok() { return true; }", v1.getCodeContent());
    }

    @Test
    void creationTimeIsSetBySystem() {
        Instant before = Instant.now();
        Artifact artifact = newArtifact();
        Instant after = Instant.now();
        assertNotNull(artifact.getCreatedAt());
        assertFalse(artifact.getCreatedAt().isBefore(before));
        assertFalse(artifact.getCreatedAt().isAfter(after));
    }

    @Test
    void versionCannotBeSetByCallers() {
        assertEquals(0, Artifact.class.getConstructors().length, "No public constructors");
        for (Method method : Artifact.class.getDeclaredMethods()) {
            boolean isPublicSetter = Modifier.isPublic(method.getModifiers())
                    && method.getName().startsWith("set");
            assertFalse(isPublicSetter, "Unexpected setter: " + method.getName());
        }
    }

    @Test
    void firstWithBlankFieldsIsRejected() {
        assertThrows(IllegalArgumentException.class, () -> Artifact.first(" ", "Claude", "code"));
        assertThrows(IllegalArgumentException.class, () -> Artifact.first("prompt", null, "code"));
        assertThrows(IllegalArgumentException.class, () -> Artifact.first("prompt", "Claude", ""));
    }

    @Test
    void reviseWithBlankFieldsIsRejected() {
        Artifact v1 = newArtifact();
        assertThrows(IllegalArgumentException.class, () -> v1.revise(null, "Claude", "code"));
        assertThrows(IllegalArgumentException.class, () -> v1.revise("prompt", " ", "code"));
        assertThrows(IllegalArgumentException.class, () -> v1.revise("prompt", "Claude", null));
        assertEquals(1, v1.getVersion());
    }
}