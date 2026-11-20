package verifai;

import org.hibernate.resource.jdbc.spi.StatementInspector;

/**
 * Lets a test run code on the current thread just before Hibernate sends a
 * matching SQL statement, to put another request's commit at an exact point
 * inside a repository call. Each hook runs once.
 */
public class StatementHook implements StatementInspector {

    private record Hook(String sqlFragment, Runnable action) {
    }

    private static final ThreadLocal<Hook> HOOK = new ThreadLocal<>();

    /** Runs the action before the next statement on this thread whose SQL contains the fragment. */
    static void before(String sqlFragment, Runnable action) {
        HOOK.set(new Hook(sqlFragment.toLowerCase(), action));
    }

    static boolean pending() {
        return HOOK.get() != null;
    }

    static void clear() {
        HOOK.remove();
    }

    @Override
    public String inspect(String sql) {
        Hook hook = HOOK.get();
        if (hook != null && sql.toLowerCase().contains(hook.sqlFragment())) {
            HOOK.remove();
            hook.action().run();
        }
        return sql;
    }
}
