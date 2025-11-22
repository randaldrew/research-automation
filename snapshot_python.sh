#!/bin/bash

# Get the current date for the snapshot filename
DATE=$(date +"%Y%m%d")
OUTPUT_FILE="code_snapshot_${DATE}.txt"

# Function to write a separator line
write_separator() {
    echo "---" >> "$OUTPUT_FILE"
}

# Clear/create the output file
echo "Directory structure" > "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"

# Add directory structure using tree
# Install tree if needed: brew install tree
if ! command -v tree > /dev/null; then
    echo "Warning: 'tree' command not found. Installing via Homebrew..."
    brew install tree
fi

# Generate directory tree, excluding common directories for full-stack projects
tree -I '__pycache__|*.pyc|*.pyo|*.pyd|.git|.env|venv|.conda|.idea|.pytest_cache|node_modules|dist|build|.next|coverage|.nyc_output|*.log|.DS_Store|Thumbs.db|*.tmp|*.temp' >> "$OUTPUT_FILE"

write_separator

# Function to process a file
process_file() {
    local file="$1"

    # Get relative path without using realpath (more portable)
    local rel_path="${file#./}"

    echo "$rel_path" >> "$OUTPUT_FILE"
    echo "" >> "$OUTPUT_FILE"

    # Check if file is empty
    if [ ! -s "$file" ]; then
        echo "Currently no content in module" >> "$OUTPUT_FILE"
    else
        # Use a more robust way to cat the file
        cat "$file" >> "$OUTPUT_FILE" 2>/dev/null || echo "Error reading file" >> "$OUTPUT_FILE"
    fi

    write_separator
}

# Find and process all source files, config files, and documentation
find . -type f \( \
    -name "*.py" \
    -o -name "*.ts" \
    -o -name "*.tsx" \
    -o -name "*.js" \
    -o -name "*.jsx" \
    -o -name "*.css" \
    -o -name "*.scss" \
    -o -name "*.html" \
    -o -name "README.md" \
    -o -name "*.md" \
    -o -name "requirements.txt" \
    -o -name "package.json" \
    -o -name "package-lock.json" \
    -o -name "tsconfig*.json" \
    -o -name "vite.config.*" \
    -o -name "pyproject.toml" \
    -o -name "Dockerfile*" \
    -o -name "docker-compose*.yml" \
    -o -name "Makefile" \
    -o -name ".env.template" \
    -o -name "*.sql" \
\) \
    -not -path "./.*" \
    -not -path "./*/.*" \
    -not -path "*/venv/*" \
    -not -path "*/__pycache__/*" \
    -not -path "*/conda/*" \
    -not -path "./frontend/node_modules/*" \
    -not -path "./node_modules/*" \
    -not -path "*/dist/*" \
    -not -path "*/build/*" \
    -not -path "*/.next/*" \
    -not -path "*/coverage/*" \
    | sort \
    | while read -r file; do
        process_file "$file"
    done

echo "Snapshot created as ${OUTPUT_FILE}"
echo "Creating latest snapshot link..."
cp "${OUTPUT_FILE}" "code_snapshot_latest.txt"
echo "Done!"