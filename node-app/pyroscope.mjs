import Pyroscope from "@pyroscope/nodejs";

Pyroscope.init({
  serverAddress:
    process.env.PYROSCOPE_SERVER_ADDRESS ||
    "http://172.31.9.5:4040",

  appName:
    process.env.OTEL_SERVICE_NAME ||
    "node-otel-demo"
});

Pyroscope.start();

console.log(
  "Pyroscope profiling initialized"
);
