FROM node:20-slim

# Install Python3, pip, and ffmpeg
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy dependency definitions
COPY package*.json ./
COPY requirements.txt ./

# Install Node dependencies
RUN npm install

# Install Python dependencies
# Using --break-system-packages because we are in a container/isolated env
RUN pip3 install --break-system-packages -r requirements.txt

# Copy the rest of the application code
COPY . .

# Expose the port
EXPOSE 3001

# Start the application
CMD ["npm", "start"]
