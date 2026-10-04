import { createRequire } from "module";
const require = createRequire(import.meta.url);
const http = require("http");
import os from "node:os";

import { trace, context } from "@opentelemetry/api";
import { SeverityNumber, logs } from "@opentelemetry/api-logs";
import { OTLPLogExporter } from "@opentelemetry/exporter-logs-otlp-proto";
import {
    defaultResource,
    resourceFromAttributes
} from "@opentelemetry/resources";
import {
    BatchLogRecordProcessor,
    LoggerProvider
} from "@opentelemetry/sdk-logs";

const serviceName =
    process.env.OTEL_SERVICE_NAME || "node-otel-demo";

const monitoringIp =
    process.env.MONITORING_PRIVATE_IP;

const authB64 =
    process.env.OTEL_AUTH_B64;

if (!monitoringIp) {
    throw new Error("MONITORING_PRIVATE_IP is required");
}

if (!authB64) {
    throw new Error("OTEL_AUTH_B64 is required");
}

const logExporter = new OTLPLogExporter({
    url:
        `http://${monitoringIp}:8427/insert/opentelemetry/v1/logs`,

    headers: {
        Authorization: `Basic ${authB64}`,
        "VL-Stream-Fields": "service.name"
    }
});

const resource = defaultResource().merge(
    resourceFromAttributes({
        "service.name": serviceName,
        "service.version": "1.0.0",
        "deployment.environment.name": "lab",
        "host.name": os.hostname()
    })
);

const loggerProvider = new LoggerProvider({
    resource,
    processors: [
        new BatchLogRecordProcessor({
            exporter: logExporter
        })
    ]
});

logs.setGlobalLoggerProvider(loggerProvider);

const logger = logs.getLogger(
    serviceName,
    "1.0.0"
);

function emitLog(
    severityNumber,
    severityText,
    message,
    attributes = {}
) {
    const span = trace.getActiveSpan();
    const spanContext = span?.spanContext();

    const traceAttributes = spanContext
        ? {
            trace_id: spanContext.traceId,
            span_id: spanContext.spanId,
            trace_flags: spanContext.traceFlags
        }
        : {};

    const logAttributes = {
        ...attributes,
        ...traceAttributes
    };

    logger.emit({
        severityNumber,
        severityText,
        body: JSON.stringify({
            service: serviceName,
            level: severityText,
            message,
            ...logAttributes
        }),
        attributes: logAttributes,
        context: context.active()
    });

    console.log(
        JSON.stringify({
            service: serviceName,
            level: severityText,
            message,
            ...logAttributes
        })
    );
}

const server = http.createServer((req, res) => {

    if (req.url === "/") {
        emitLog(
            SeverityNumber.INFO,
            "INFO",
            "Node.js application received request",
            {
                endpoint: "/",
                method: req.method
            }
        );

        res.writeHead(200, {
            "Content-Type": "application/json"
        });

        res.end(
            JSON.stringify({
                service: serviceName,
                status: "ok"
            })
        );

        return;
    }

    if (req.url === "/error") {
        emitLog(
            SeverityNumber.ERROR,
            "ERROR",
            "Simulated Node.js application error",
            {
                error_type: "DemoError",
                endpoint: "/error"
            }
        );

        res.writeHead(500, {
            "Content-Type": "application/json"
        });

        res.end(
            JSON.stringify({
                service: serviceName,
                error: "simulated"
            })
        );

        return;
    }

    if (req.url === "/chain") {
        emitLog(
            SeverityNumber.INFO,
            "INFO",
            "Calling another service to create distributed trace",
            { endpoint: "/chain" }
        );

        // OpenTelemetry HttpInstrumentation automatically creates a child span
        // for this outgoing request and injects the 'traceparent' header!
        const outgoingReq = http.get("http://java-app:8080/api/hello", (clientRes) => {
            let data = "";
            clientRes.on("data", (chunk) => { data += chunk; });
            clientRes.on("end", () => {
                res.writeHead(200, { "Content-Type": "application/json" });
                res.end(JSON.stringify({
                    message: "Called another service successfully",
                    downstream_response: JSON.parse(data)
                }));
            });
        });

        outgoingReq.on("error", (err) => {
            res.writeHead(500, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: err.message }));
        });

        return;
    }

    emitLog(
        SeverityNumber.WARN,
        "WARN",
        "Unknown endpoint requested",
        {
            endpoint: req.url
        }
    );

    res.writeHead(404);
    res.end("Not found");
});

const port = 3001;

server.listen(port, "0.0.0.0", () => {
    emitLog(
        SeverityNumber.INFO,
        "INFO",
        "Node.js application started",
        {
            port
        }
    );
});

async function shutdown() {
    console.log("Shutting down Node.js application...");

    try {
        await loggerProvider.shutdown();
    } catch (error) {
        console.error("Failed to shutdown OTel logger", error);
    }

    server.close(() => {
        process.exit(0);
    });
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);