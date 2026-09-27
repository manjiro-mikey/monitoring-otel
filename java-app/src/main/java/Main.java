import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.io.IOException;
import java.io.OutputStream;
import java.net.InetSocketAddress;

public class Main {

    private static final Logger log =
            LoggerFactory.getLogger(Main.class);

    public static void main(String[] args) throws Exception {

        int port = 8080;

        HttpServer server =
                HttpServer.create(
                        new InetSocketAddress("0.0.0.0", port),
                        0
                );

        server.createContext("/", Main::handleRoot);
        server.createContext("/error", Main::handleError);

        server.setExecutor(null);

        server.start();

        log.info(
                "Java application started on port {}",
                port
        );
    }

    private static void handleRoot(
            HttpExchange exchange
    ) throws IOException {

        log.info(
                "Java application received request method={} path={}",
                exchange.getRequestMethod(),
                exchange.getRequestURI().getPath()
        );

        String response = """
                {
                  "service": "java-otel-demo",
                  "status": "ok"
                }
                """;

        sendResponse(
                exchange,
                200,
                response
        );
    }

    private static void handleError(
            HttpExchange exchange
    ) throws IOException {

        log.error(
                "Simulated Java application error errorType=DemoException"
        );

        String response = """
                {
                  "service": "java-otel-demo",
                  "error": "simulated"
                }
                """;

        sendResponse(
                exchange,
                500,
                response
        );
    }

    private static void sendResponse(
            HttpExchange exchange,
            int status,
            String body
    ) throws IOException {

        byte[] bytes =
                body.getBytes();

        exchange.getResponseHeaders()
                .set(
                        "Content-Type",
                        "application/json"
                );

        exchange.sendResponseHeaders(
                status,
                bytes.length
        );

        try (OutputStream output =
                     exchange.getResponseBody()) {

            output.write(bytes);
        }
    }
}
