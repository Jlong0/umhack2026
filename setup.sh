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

# Z.AI GLM API (for multimodal document processing)
# Get your API key from: https://open.bigmodel.cn/
ZHIPU_API_KEY=

# Arize Phoenix Observability (optional)
PHOENIX_ENABLED=false
EOF
fi

echo "✅ Setup complete!"
echo ""
echo "Next steps:"
echo "1. Add your ZHIPU_API_KEY to .env file"
echo "2. Run: python run.py"
echo "3. Visit: http://127.0.0.1:8000/docs"
