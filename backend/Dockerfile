FROM python:3.11-slim

# Set working directory
WORKDIR /app

# Install system dependencies (required for psycopg2 and other native extensions)
RUN apt-get update && apt-get install -y \
    build-essential \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements first to leverage Docker cache
COPY requirements.txt .

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy the rest of the backend application code
COPY . .

# Cloud Run injects the PORT environment variable
ENV PORT=8080

# Command to run the application using the PORT environment variable
# Host must be 0.0.0.0 for Cloud Run
CMD exec uvicorn main:app --host 0.0.0.0 --port ${PORT:-8080}
