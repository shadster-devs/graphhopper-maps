# Use the official Node.js 20 image as a base
FROM node:20-alpine

# Install git
RUN apk add --no-cache git

# Set the working directory in the container
WORKDIR /app

# Copy package.json and package-lock.json to the working directory
COPY src ./
COPY *.json ./
COPY *.js ./

# Install dependencies
RUN npm install

# Copy the rest of the application code
COPY . .

# Expose port 4000
EXPOSE 4000

# Start the application
CMD ["npm", "run", "serve"]