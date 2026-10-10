package verifai.domain;

   import java.time.LocalDate;

   public final class Verification {

       private final VerificationType type;
       private VerificationStatus status = VerificationStatus.PENDING;
       private String evidence;
       private String notes;
       private String reviewer;
       private LocalDate reviewedOn;

       public Verification(VerificationType type) {
           if (type == null) {
               throw new IllegalArgumentException("Type is required");
           }
           this.type = type;
       }

       void markPassed(String evidence, String reviewer) {
           requireText(evidence, "Evidence is required to pass a check");
           requireText(reviewer, "Reviewer is required");
           if (status == VerificationStatus.PASSED) {
               throw new IllegalStateException("Check is already passed");
           }
           this.status = VerificationStatus.PASSED;
           this.evidence = evidence;
           this.notes = null;
           this.reviewer = reviewer;
           this.reviewedOn = LocalDate.now();
       }

       void markFailed(String notes, String reviewer) {
           requireText(notes, "Notes are required to fail a check");
           requireText(reviewer, "Reviewer is required");
           if (status == VerificationStatus.FAILED) {
               throw new IllegalStateException("Check is already failed");
           }
           this.status = VerificationStatus.FAILED;
           this.notes = notes;
           this.evidence = null;
           this.reviewer = reviewer;
           this.reviewedOn = LocalDate.now();
       }

       void reset() {
           this.status = VerificationStatus.PENDING;
           this.evidence = null;
           this.notes = null;
           this.reviewer = null;
           this.reviewedOn = null;
       }

       public VerificationType getType() { return type; }
       public VerificationStatus getStatus() { return status; }
       public String getEvidence() { return evidence; }
       public String getNotes() { return notes; }
       public String getReviewer() { return reviewer; }
       public LocalDate getReviewedOn() { return reviewedOn; }

       private static void requireText(String value, String message) {
           if (value == null || value.isBlank()) {
               throw new IllegalArgumentException(message);
           }
       }
   }