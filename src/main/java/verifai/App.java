package verifai;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.context.annotation.Bean;

import verifai.data.InMemoryTaskRepository;
import verifai.data.TaskRepository;

@SpringBootApplication
public class App {

    public static void main(String[] args) {
        SpringApplication.run(App.class, args);
    }

    /** In-memory storage until the JPA repository replaces it. */
    @Bean
    TaskRepository taskRepository() {
        return new InMemoryTaskRepository();
    }
}