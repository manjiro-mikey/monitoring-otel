import Pyroscope from "@pyroscope/nodejs";

const monitoringIp =
    process.env.MONITORING_PRIVATE_IP;

Pyroscope.init({
  serverAddress:
    process.env.PYROSCOPE_SERVER_ADDRESS ||
    "http://${monitoringIp}:4040",

  appName:
    process.env.OTEL_SERVICE_NAME ||
    "node-otel-demo"
});

Pyroscope.start();

console.log(
  "Pyroscope profiling initialized"
);
