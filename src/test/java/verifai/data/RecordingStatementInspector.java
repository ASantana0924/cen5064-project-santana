package verifai.data;

import java.util.List;
import java.util.concurrent.CopyOnWriteArrayList;

import org.hibernate.resource.jdbc.spi.StatementInspector;

/** Remembers every SQL statement Hibernate sends, so tests can check what was written. */
public class RecordingStatementInspector implements StatementInspector {

    private static final List<String> STATEMENTS = new CopyOnWriteArrayList<>();

    @Override
    public String inspect(String sql) {
        STATEMENTS.add(sql.toLowerCase());
        return sql;
    }

    static List<String> statements() {
        return List.copyOf(STATEMENTS);
    }

    static void clear() {
        STATEMENTS.clear();
    }
}
