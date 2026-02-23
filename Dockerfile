# Use Node.js 18 on Debian Slim for better compatibility with Python libraries
FROM node:18-slim

# Set the working directory
WORKDIR /app

# Install Python 3, pip, and system dependencies for PDF/Image processing
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    python3-venv \
    libgl1 \
    libglib2.0-0 \
    libgomp1 \
    && rm -rf /var/lib/apt/lists/*

# Create a virtual environment for Python to avoid conflicts and ensure 'python' command exists
ENV VIRTUAL_ENV=/opt/venv
RUN python3 -m venv $VIRTUAL_ENV
ENV PATH="$VIRTUAL_ENV/bin:$PATH"

# Upgrade pip to latest version
RUN pip install --upgrade pip setuptools wheel

# Copy requirements.txt first to leverage Docker cache
COPY requirements.txt ./

# Install Python dependencies with better error handling
RUN pip install -r requirements.txt || (echo "Failed to install requirements, trying individual packages" && \
    pip install PyMuPDF==1.24.8 && \
    pip install pdfplumber==0.11.0 && \
    pip install Flask==3.0.3 && \
    pip install flask-cors==5.0.0 && \
    pip install werkzeug==3.0.3 && \
    pip install pydantic==1.10.13)

# Copy package.json and package-lock.json
COPY package*.json ./

# Install Node.js dependencies
RUN npm install

# Copy the rest of the application code and the start script
COPY . .

# Make the start script executable
RUN chmod +x start.sh

# Create temp_uploads directory for file processing
RUN mkdir -p temp_uploads

# Expose the ports for both Node.js and Python services
EXPOSE 5001
EXPOSE 5001

# Define the command to run the start script
CMD ["./start.sh"]






