FROM node:22-alpine

WORKDIR /app

COPY package.json .

RUN npm install --omit=dev

COPY app.mjs .
COPY otel-tracing.mjs .

ENV NODE_ENV=production

EXPOSE 3001

CMD ["node", "--import", "@opentelemetry/instrumentation/hook.mjs", "--import", "./otel-tracing.mjs", "app.mjs"]
