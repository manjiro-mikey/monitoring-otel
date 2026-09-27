import com.sun.net.httpserver.HttpServer;
import com.sun.net.httpserver.HttpHandler;
import com.sun.net.httpserver.HttpExchange;
import java.io.IOException;
import java.io.OutputStream;
import java.net.InetSocketAddress;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

public class Main {
    private static final Logger logger = LoggerFactory.getLogger(Main.class);

    public static void main(String[] args) throws IOException {
        int port = 8080;
        HttpServer server = HttpServer.create(new InetSocketAddress(port), 0);
        
        server.createContext("/api/hello", new HttpHandler() {
            @Override
            public void handle(HttpExchange exchange) throws IOException {
                // Nhờ OTel Java Agent, dòng log này sẽ tự động được đính kèm trace_id và span_id!
                logger.info("Java App received request from Node.js on /api/hello");
                
                String response = "{\"message\": \"Hello from Java App!\", \"status\": \"success\"}";
                exchange.getResponseHeaders().set("Content-Type", "application/json");
                exchange.sendResponseHeaders(200, response.getBytes().length);
                
                try (OutputStream os = exchange.getResponseBody()) {
                    os.write(response.getBytes());
                }
            }
        });
        
        server.setExecutor(null);
        server.start();
        logger.info("Java application started on port " + port);
    }
}
