package verifai;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("demo")
class DemoDataTest {

    @Autowired
    private MockMvc mvc;

    @Test
    void demoProfileSeedsOneTaskAtEachStage() throws Exception {
        mvc.perform(get("/api/tasks"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(4))
                .andExpect(jsonPath("$[0].status").value("DRAFT"))
                .andExpect(jsonPath("$[1].status").value("DRAFT"))
                .andExpect(jsonPath("$[2].status").value("IN_PROGRESS"))
                .andExpect(jsonPath("$[2].passedChecks").value(3))
                .andExpect(jsonPath("$[3].status").value("APPROVED"))
                .andExpect(jsonPath("$[3].passedChecks").value(6))
                .andExpect(jsonPath("$[3].approvalCount").value(2));
    }
}
