#!/bin/bash
# Quick setup script for PermitIQ backend

echo "🚀 Setting up PermitIQ Backend..."

# Activate virtual environment
source .venv/bin/activate

# Install dependencies
echo "📦 Installing dependencies..."
pip install -q -r requirements.txt

# Check if Firebase credentials exist
if [ ! -f "serviceAccountkey.json" ]; then
    echo "⚠️  Warning: serviceAccountkey.json not found"
    echo "   Please add your Firebase service account key"
fi

# Check if .env exists
if [ ! -f ".env" ]; then
    echo "⚠️  Warning: .env file not found"
    echo "   Creating .env from template..."
    cat > .env << EOF
# Backend runtime configuration
FIREBASE_CREDENTIALS_PATH=serviceAccountkey.json

# Firestore
FIRESTORE_DATABASE_ID=(default)

# LangSmith / Studio (dev-only)
# Create a key at https://smith.langchain.com/settings
LANGSMITH_API_KEY=YOUR_LANGSMITH_API_KEY
LANGSMITH_TRACING=true
LANGCHAIN_TRACING_V2=true
LANGCHAIN_PROJECT=permitiq-local

# Z.AI GLM API (for multimodal document processing)
# Get your API key from: https://open.bigmodel.cn/
ZHIPU_API_KEY=

# Arize Phoenix Observability (optional)
PHOENIX_ENABLED=false
EOF
fi

ensure_env_kv() {
    local key="$1"
    local value="$2"
    local file=".env"
    if ! grep -q "^${key}=" "$file"; then
        echo "${key}=${value}" >> "$file"
    fi
}

# If .env already existed, make sure it has the newer keys (do not overwrite).
if [ -f ".env" ]; then
    ensure_env_kv "FIRESTORE_DATABASE_ID" "(default)"
    ensure_env_kv "LANGSMITH_API_KEY" "YOUR_LANGSMITH_API_KEY"
    ensure_env_kv "LANGSMITH_TRACING" "true"
    ensure_env_kv "LANGCHAIN_TRACING_V2" "true"
    ensure_env_kv "LANGCHAIN_PROJECT" "permitiq-local"
fi

echo "✅ Setup complete!"
echo ""
echo "Next steps:"
echo "1. Add your ZHIPU_API_KEY to .env file"
echo "2. Run: python run.py"
echo "3. Visit: http://127.0.0.1:8001/docs"
