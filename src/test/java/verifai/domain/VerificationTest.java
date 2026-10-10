package verifai.domain;

   import static org.junit.jupiter.api.Assertions.assertEquals;
   import static org.junit.jupiter.api.Assertions.assertFalse;
   import static org.junit.jupiter.api.Assertions.assertNotNull;
   import static org.junit.jupiter.api.Assertions.assertNull;
   import static org.junit.jupiter.api.Assertions.assertThrows;
   import static org.junit.jupiter.api.Assertions.assertTrue;

   import java.lang.reflect.Method;
   import java.lang.reflect.Modifier;

   import org.junit.jupiter.api.Test;

   class VerificationTest {

       private Verification newCheck() {
           return new Verification(VerificationType.TESTING);
       }

       @Test
       void newCheckIsPending() {
           assertEquals(VerificationStatus.PENDING, newCheck().getStatus());
       }

       @Test
       void passWithEvidenceSetsPassed() {
           Verification check = newCheck();
           check.markPassed("All 12 tests pass", "alex");
           assertEquals(VerificationStatus.PASSED, check.getStatus());
           assertEquals("All 12 tests pass", check.getEvidence());
           assertEquals("alex", check.getReviewer());
           assertNotNull(check.getReviewedOn());
       }

       @Test
       void passWithoutEvidenceIsRejected() {
           Verification check = newCheck();
           assertThrows(IllegalArgumentException.class, () -> check.markPassed("  ", "alex"));
           assertEquals(VerificationStatus.PENDING, check.getStatus());
       }

       @Test
       void failWithNotesSetsFailed() {
           Verification check = newCheck();
           check.markFailed("Missing edge case tests", "alex");
           assertEquals(VerificationStatus.FAILED, check.getStatus());
           assertEquals("Missing edge case tests", check.getNotes());
       }

       @Test
       void failWithoutNotesIsRejected() {
           Verification check = newCheck();
           assertThrows(IllegalArgumentException.class, () -> check.markFailed(null, "alex"));
           assertEquals(VerificationStatus.PENDING, check.getStatus());
       }

       @Test
       void failedCheckCanBePassedLater() {
           Verification check = newCheck();
           check.markFailed("Bug found", "alex");
           check.markPassed("Bug fixed, tests pass", "alex");
           assertEquals(VerificationStatus.PASSED, check.getStatus());
           assertNull(check.getNotes());
       }

       @Test
       void passingTwiceIsRejected() {
           Verification check = newCheck();
           check.markPassed("Looks good", "alex");
           assertThrows(IllegalStateException.class, () -> check.markPassed("Again", "sam"));
       }

       @Test
       void failingTwiceIsRejected() {
           Verification check = newCheck();
           check.markFailed("Bug", "alex");
           assertThrows(IllegalStateException.class, () -> check.markFailed("Another bug", "sam"));
       }

       @Test
       void resetReturnsToPendingAndClearsFields() {
           Verification check = newCheck();
           check.markPassed("Looks good", "alex");
           check.reset();
           assertEquals(VerificationStatus.PENDING, check.getStatus());
           assertNull(check.getEvidence());
           assertNull(check.getReviewer());
           assertNull(check.getReviewedOn());
       }

       @Test
       void onlyTaskCanChangeACheck() {
           assertTrue(Modifier.isFinal(Verification.class.getModifiers()), "Verification should be final");
           for (String name : new String[] {"markPassed", "markFailed", "reset"}) {
               for (Method method : Verification.class.getDeclaredMethods()) {
                   if (method.getName().equals(name)) {
                       assertFalse(Modifier.isPublic(method.getModifiers()), name + " should not be public");
                   }
               }
           }
       }
   }