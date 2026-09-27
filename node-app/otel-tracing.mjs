import os from "node:os";

import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-proto";
import { registerInstrumentations } from "@opentelemetry/instrumentation";
import { HttpInstrumentation } from "@opentelemetry/instrumentation-http";
import {
  defaultResource,
  resourceFromAttributes
} from "@opentelemetry/resources";
import { BatchSpanProcessor } from "@opentelemetry/sdk-trace-base";
import { NodeTracerProvider } from "@opentelemetry/sdk-trace-node";

const serviceName =
  process.env.OTEL_SERVICE_NAME || "node-otel-demo";

const monitoringIp =
  process.env.MONITORING_PRIVATE_IP;

if (!monitoringIp) {
  throw new Error("MONITORING_PRIVATE_IP is required");
}

const traceExporter = new OTLPTraceExporter({
  url: `http://${monitoringIp}:4318/v1/traces`
});

const resource = defaultResource().merge(
  resourceFromAttributes({
    "service.name": serviceName,
    "service.version": "1.0.0",
    "deployment.environment.name": "lab",
    "host.name": os.hostname()
  })
);

const tracerProvider = new NodeTracerProvider({
  resource,
  spanProcessors: [
    new BatchSpanProcessor(traceExporter)
  ]
});

tracerProvider.register();

registerInstrumentations({
  instrumentations: [
    new HttpInstrumentation()
  ]
});

process.on("SIGTERM", async () => {
  await tracerProvider.shutdown();
});

process.on("SIGINT", async () => {
  await tracerProvider.shutdown();
});

console.log(
  `OpenTelemetry tracing initialized: ${serviceName}`
);
