FROM maven:3.9-eclipse-temurin-21 AS build

WORKDIR /build

COPY pom.xml .

RUN mvn -q dependency:go-offline

COPY src ./src

RUN mvn -q package -DskipTests


FROM eclipse-temurin:21-jre

WORKDIR /app

COPY --from=build \
     /build/target/java-otel-demo-1.0.0.jar \
     /app/app.jar

COPY otel/opentelemetry-javaagent.jar \
     /otel/opentelemetry-javaagent.jar

EXPOSE 8080

ENTRYPOINT ["java", "-javaagent:/otel/opentelemetry-javaagent.jar", "-jar", "/app/app.jar"]
