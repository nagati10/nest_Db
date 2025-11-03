FROM node:18-alpine

WORKDIR /usr/src/app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source code including .env
COPY . .

# Build the application
RUN npm run build

# Create uploads directory
RUN mkdir -p uploads

EXPOSE 3005

# Start the application
CMD ["node", "dist/main"]