FROM golang:1.26-alpine AS build

WORKDIR /src

COPY go.mod go.sum ./
RUN go mod download

COPY . .

RUN CGO_ENABLED=0 GOOS=linux go build -trimpath -ldflags="-s -w" -o /out/api ./cmd/api \
    && CGO_ENABLED=0 GOOS=linux go build -trimpath -ldflags="-s -w" -o /out/worker ./cmd/worker \
    && CGO_ENABLED=0 GOOS=linux go build -trimpath -ldflags="-s -w" -o /out/migrate ./cmd/migrate

FROM alpine:3.23 AS runtime

RUN apk add --no-cache ca-certificates tzdata \
    && addgroup -S -g 10001 baahar \
    && adduser -S -D -H -u 10001 -G baahar baahar

WORKDIR /app
USER baahar

FROM runtime AS api
COPY --from=build --chown=baahar:baahar /out/api /app/api
EXPOSE 8080
ENTRYPOINT ["/app/api"]

FROM runtime AS worker
COPY --from=build --chown=baahar:baahar /out/worker /app/worker
ENTRYPOINT ["/app/worker"]

FROM runtime AS migrate
COPY --from=build --chown=baahar:baahar /out/migrate /app/migrate
COPY --chown=baahar:baahar migrations /app/migrations
ENV BAAHAR_MIGRATIONS_DIR=/app/migrations
ENTRYPOINT ["/app/migrate"]
CMD ["up"]
