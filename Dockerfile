FROM alpine:latest

RUN apk add --no-cache unzip ca-certificates

# Download PocketBase v0.39.5 for Linux AMD64 (Fly.io default VM architecture)
ADD https://github.com/pocketbase/pocketbase/releases/download/v0.39.5/pocketbase_0.39.5_linux_amd64.zip /tmp/pb.zip
RUN unzip /tmp/pb.zip -d /pb/ && rm /tmp/pb.zip

# Copy database schema migrations so they apply automatically on deployment
COPY ./pb/pb_migrations /pb/pb_migrations

EXPOSE 8080

# Serve PocketBase, storing persistent data in /pb/pb_data volume
CMD ["/pb/pocketbase", "serve", "--http=0.0.0.0:8080", "--dir=/pb/pb_data"]
