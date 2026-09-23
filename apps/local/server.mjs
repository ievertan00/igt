// Local Web Runtime entrypoint.
// The implementation remains in lib/server while the runtime boundary is
// introduced here, so CLI and Web startup do not depend on the CLI REPL.
import "../../lib/server/index.mjs";
