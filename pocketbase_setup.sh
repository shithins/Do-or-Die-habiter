#!/bin/bash
set -e

# Target PocketBase version
PB_VERSION="0.39.5"
PB_DIR="./pb"
PB_BIN="$PB_DIR/pocketbase"

echo "PocketBase Setup Script"
echo "======================="

# Create directory for pocketbase
if [ ! -d "$PB_DIR" ]; then
  mkdir -p "$PB_DIR"
fi

# Download if not present
if [ ! -f "$PB_BIN" ]; then
  echo "Downloading PocketBase v$PB_VERSION for macOS arm64..."
  curl -L -o "$PB_DIR/pocketbase.zip" "https://github.com/pocketbase/pocketbase/releases/download/v$PB_VERSION/pocketbase_${PB_VERSION}_darwin_arm64.zip"
  
  echo "Extracting..."
  unzip -o "$PB_DIR/pocketbase.zip" -d "$PB_DIR"
  rm "$PB_DIR/pocketbase.zip"
  chmod +x "$PB_BIN"
  echo "PocketBase downloaded and extracted to $PB_BIN successfully."
else
  echo "PocketBase binary already exists at $PB_BIN"
fi

echo "Creating schema directories..."
mkdir -p "$PB_DIR/pb_data"

# Create a start script helper
cat << 'EOF' > start_pb.sh
#!/bin/bash
./pb/pocketbase serve
EOF
chmod +x start_pb.sh

echo "Setup complete! You can start PocketBase with ./start_pb.sh"
