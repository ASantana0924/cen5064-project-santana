package verifai;

import java.time.Clock;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.context.annotation.Bean;

@SpringBootApplication
public class App {

    public static void main(String[] args) {
        SpringApplication.run(App.class, args);
    }

    /** The current time in UTC, for services that stamp what they produce. Tests pass a fixed clock instead. */
    @Bean
    Clock clock() {
        return Clock.systemUTC();
    }
}
