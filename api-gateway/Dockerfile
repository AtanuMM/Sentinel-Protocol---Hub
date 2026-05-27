FROM openresty/openresty:1.25.3.1-alpine

# Install required packages
RUN apk add --no-cache \
    curl \
    bash

# Create directories (safe)
RUN mkdir -p /usr/share/nginx/html

# Copy nginx configuration
COPY nginx.conf /usr/local/openresty/nginx/conf/nginx.conf

# Copy static UI files
COPY html/ /usr/share/nginx/html/

# Expose port
EXPOSE 5000

# Start OpenResty (NGINX + Lua)
CMD ["openresty", "-g", "daemon off;"]
