import http from "node:http";
import os from "node:os";

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
  logger.emit({
    severityNumber,
    severityText,
    body: message,
    attributes
  });

  console.log(
    JSON.stringify({
      service: serviceName,
      level: severityText,
      message,
      ...attributes
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
