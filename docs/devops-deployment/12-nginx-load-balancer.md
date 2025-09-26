# Nginx Load Balancer & Reverse Proxy

## 🌐 Overview

Nginx serves as our reverse proxy, load balancer, and SSL termination point for our mini Facebook backend, providing high availability, performance optimization, and security features.

## 🏗️ Nginx Configuration

### Main Configuration
```nginx
# /etc/nginx/nginx.conf
user nginx;
worker_processes auto;
error_log /var/log/nginx/error.log warn;
pid /var/run/nginx.pid;

events {
    worker_connections 1024;
    use epoll;
    multi_accept on;
}

http {
    include /etc/nginx/mime.types;
    default_type application/octet-stream;

    # Logging format
    log_format main '$remote_addr - $remote_user [$time_local] "$request" '
                    '$status $body_bytes_sent "$http_referer" '
                    '"$http_user_agent" "$http_x_forwarded_for" '
                    'rt=$request_time uct="$upstream_connect_time" '
                    'uht="$upstream_header_time" urt="$upstream_response_time"';

    access_log /var/log/nginx/access.log main;

    # Basic settings
    sendfile on;
    tcp_nopush on;
    tcp_nodelay on;
    keepalive_timeout 65;
    types_hash_max_size 2048;
    client_max_body_size 10M;

    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_proxied any;
    gzip_comp_level 6;
    gzip_types
        text/plain
        text/css
        text/xml
        text/javascript
        application/json
        application/javascript
        application/xml+rss
        application/atom+xml
        image/svg+xml;

    # Rate limiting
    limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;
    limit_req_zone $binary_remote_addr zone=auth:10m rate=5r/s;
    limit_req_zone $binary_remote_addr zone=upload:10m rate=2r/s;

    # Connection limiting
    limit_conn_zone $binary_remote_addr zone=conn_limit_per_ip:10m;

    # Include server configurations
    include /etc/nginx/conf.d/*.conf;
    include /etc/nginx/sites-enabled/*;
}
```

### Load Balancer Configuration
```nginx
# /etc/nginx/conf.d/load-balancer.conf
upstream api_backend {
    # Load balancing method
    least_conn;
    
    # Health check
    server 127.0.0.1:3001 weight=3 max_fails=3 fail_timeout=30s;
    server 127.0.0.1:3002 weight=3 max_fails=3 fail_timeout=30s;
    server 127.0.0.1:3003 weight=2 max_fails=3 fail_timeout=30s;
    
    # Keep alive connections
    keepalive 32;
}

upstream auth_backend {
    least_conn;
    server 127.0.0.1:3101 weight=2 max_fails=3 fail_timeout=30s;
    server 127.0.0.1:3102 weight=2 max_fails=3 fail_timeout=30s;
}

upstream user_backend {
    least_conn;
    server 127.0.0.1:3201 weight=2 max_fails=3 fail_timeout=30s;
    server 127.0.0.1:3202 weight=2 max_fails=3 fail_timeout=30s;
}

upstream post_backend {
    least_conn;
    server 127.0.0.1:3301 weight=2 max_fails=3 fail_timeout=30s;
    server 127.0.0.1:3302 weight=2 max_fails=3 fail_timeout=30s;
}

upstream message_backend {
    least_conn;
    server 127.0.0.1:3401 weight=2 max_fails=3 fail_timeout=30s;
    server 127.0.0.1:3402 weight=2 max_fails=3 fail_timeout=30s;
}

upstream media_backend {
    least_conn;
    server 127.0.0.1:3501 weight=1 max_fails=3 fail_timeout=30s;
    server 127.0.0.1:3502 weight=1 max_fails=3 fail_timeout=30s;
}

upstream search_backend {
    least_conn;
    server 127.0.0.1:3601 weight=2 max_fails=3 fail_timeout=30s;
    server 127.0.0.1:3602 weight=2 max_fails=3 fail_timeout=30s;
}

upstream notification_backend {
    least_conn;
    server 127.0.0.1:3701 weight=1 max_fails=3 fail_timeout=30s;
    server 127.0.0.1:3702 weight=1 max_fails=3 fail_timeout=30s;
}
```

### Main Server Block
```nginx
# /etc/nginx/sites-enabled/mini-facebook.conf
server {
    listen 80;
    server_name api.minifacebook.com www.api.minifacebook.com;
    
    # Redirect HTTP to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name api.minifacebook.com www.api.minifacebook.com;

    # SSL Configuration
    ssl_certificate /etc/ssl/certs/minifacebook.crt;
    ssl_certificate_key /etc/ssl/private/minifacebook.key;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512:ECDHE-RSA-AES256-GCM-SHA384:DHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;

    # Security headers
    add_header X-Frame-Options DENY;
    add_header X-Content-Type-Options nosniff;
    add_header X-XSS-Protection "1; mode=block";
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin";

    # CORS headers
    add_header Access-Control-Allow-Origin "https://app.minifacebook.com" always;
    add_header Access-Control-Allow-Methods "GET, POST, PUT, DELETE, OPTIONS" always;
    add_header Access-Control-Allow-Headers "Authorization, Content-Type, X-Request-ID" always;
    add_header Access-Control-Allow-Credentials "true" always;

    # Handle preflight requests
    location / {
        if ($request_method = 'OPTIONS') {
            add_header Access-Control-Allow-Origin "https://app.minifacebook.com";
            add_header Access-Control-Allow-Methods "GET, POST, PUT, DELETE, OPTIONS";
            add_header Access-Control-Allow-Headers "Authorization, Content-Type, X-Request-ID";
            add_header Access-Control-Allow-Credentials "true";
            add_header Access-Control-Max-Age 1728000;
            add_header Content-Type "text/plain charset=UTF-8";
            add_header Content-Length 0;
            return 204;
        }

        try_files $uri $uri/ @api;
    }

    # API Gateway routing
    location @api {
        # Rate limiting
        limit_req zone=api burst=20 nodelay;
        limit_conn conn_limit_per_ip 20;

        # Proxy settings
        proxy_pass http://api_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Request-ID $request_id;

        # Timeouts
        proxy_connect_timeout 30s;
        proxy_send_timeout 30s;
        proxy_read_timeout 30s;

        # Buffering
        proxy_buffering on;
        proxy_buffer_size 4k;
        proxy_buffers 8 4k;

        # Cache control
        proxy_cache_bypass $http_upgrade;
    }

    # Authentication endpoints
    location /api/v1/auth/ {
        limit_req zone=auth burst=10 nodelay;
        
        proxy_pass http://auth_backend;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # User endpoints
    location /api/v1/users/ {
        proxy_pass http://user_backend;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Post endpoints
    location /api/v1/posts/ {
        proxy_pass http://post_backend;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Search endpoints
    location /api/v1/search/ {
        proxy_pass http://search_backend;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Notification endpoints
    location /api/v1/notifications/ {
        proxy_pass http://notification_backend;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Message endpoints
    location /api/v1/messages/ {
        proxy_pass http://message_backend;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Media upload endpoints
    location /api/v1/media/upload {
        limit_req zone=upload burst=5 nodelay;
        client_max_body_size 50M;
        
        proxy_pass http://media_backend;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # Extended timeouts for file uploads
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    # Health check endpoint
    location /health {
        access_log off;
        return 200 "healthy\n";
        add_header Content-Type text/plain;
    }

    # Static file serving (if needed)
    location /static/ {
        alias /var/www/mini-facebook/static/;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

## 🔧 Advanced Features

### WebSocket Support
```nginx
# WebSocket proxy configuration
map $http_upgrade $connection_upgrade {
    default upgrade;
    '' close;
}

server {
    listen 443 ssl http2;
    server_name ws.minifacebook.com;

    # SSL configuration (same as above)
    
    location /socket.io/ {
        proxy_pass http://message_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection $connection_upgrade;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # WebSocket specific timeouts
        proxy_read_timeout 86400;
        proxy_send_timeout 86400;
    }
}
```

### Caching Configuration
```nginx
# /etc/nginx/conf.d/cache.conf
proxy_cache_path /var/cache/nginx levels=1:2 keys_zone=api_cache:10m max_size=1g 
                 inactive=60m use_temp_path=off;

server {
    # ... other configuration

    # Cache static API responses
    location /api/v1/users/profile {
        proxy_cache api_cache;
        proxy_cache_valid 200 5m;
        proxy_cache_valid 404 1m;
        proxy_cache_key "$scheme$request_method$host$request_uri$http_authorization";
        
        proxy_pass http://user_backend;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Cache user feeds
    location /api/v1/posts/feed {
        proxy_cache api_cache;
        proxy_cache_valid 200 2m;
        proxy_cache_key "$scheme$request_method$host$request_uri$http_authorization$args";
        
        proxy_pass http://post_backend;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### Security Configuration
```nginx
# /etc/nginx/conf.d/security.conf
# Block suspicious requests
location ~* \.(php|asp|aspx|jsp)$ {
    return 444;
}

# Block access to sensitive files
location ~ /\. {
    deny all;
    access_log off;
    log_not_found off;
}

location ~ ~$ {
    deny all;
    access_log off;
    log_not_found off;
}

# Block common attack patterns
if ($request_uri ~* "(/\.|\.\./|\.php|\.asp|\.aspx|\.jsp|\.cgi|\.pl|\.py|\.sh)") {
    return 444;
}

# Block SQL injection attempts
if ($args ~* "(union|select|insert|delete|drop|create|alter|exec|script)") {
    return 444;
}

# Block XSS attempts
if ($request_uri ~* "(<script|javascript:|vbscript:|onload|onerror)") {
    return 444;
}
```

## 📊 Monitoring & Logging

### Custom Log Format
```nginx
# /etc/nginx/conf.d/logging.conf
log_format detailed '$remote_addr - $remote_user [$time_local] '
                   '"$request" $status $body_bytes_sent '
                   '"$http_referer" "$http_user_agent" '
                   'rt=$request_time uct="$upstream_connect_time" '
                   'uht="$upstream_header_time" urt="$upstream_response_time" '
                   'upstream=$upstream_addr';

access_log /var/log/nginx/api_access.log detailed;
error_log /var/log/nginx/api_error.log warn;
```

### Health Check Script
```bash
#!/bin/bash
# /usr/local/bin/nginx-health-check.sh

UPSTREAMS=("api_backend" "auth_backend" "user_backend" "post_backend" "message_backend" "media_backend")
HEALTHY_COUNT=0
TOTAL_COUNT=${#UPSTREAMS[@]}

for upstream in "${UPSTREAMS[@]}"; do
    if nginx -T 2>/dev/null | grep -q "server.*$upstream"; then
        echo "✓ $upstream is configured"
        HEALTHY_COUNT=$((HEALTHY_COUNT + 1))
    else
        echo "✗ $upstream is not configured"
    fi
done

echo "Health Check: $HEALTHY_COUNT/$TOTAL_COUNT upstreams healthy"

if [ $HEALTHY_COUNT -eq $TOTAL_COUNT ]; then
    exit 0
else
    exit 1
fi
```

## 🚀 Performance Optimization

### Worker Process Configuration
```nginx
# /etc/nginx/nginx.conf (worker processes section)
worker_processes auto;
worker_cpu_affinity auto;
worker_rlimit_nofile 65535;

events {
    worker_connections 2048;
    use epoll;
    multi_accept on;
    accept_mutex off;
}
```

### Buffer Optimization
```nginx
# /etc/nginx/conf.d/performance.conf
http {
    # Buffer sizes
    client_body_buffer_size 128k;
    client_header_buffer_size 1k;
    large_client_header_buffers 4 4k;
    
    # Timeouts
    client_body_timeout 12;
    client_header_timeout 12;
    keepalive_timeout 15;
    send_timeout 10;
    
    # File caching
    open_file_cache max=1000 inactive=20s;
    open_file_cache_valid 30s;
    open_file_cache_min_uses 2;
    open_file_cache_errors on;
}
```

## 🔄 Load Balancing Strategies

### Round Robin (Default)
```nginx
upstream backend {
    server 127.0.0.1:3001;
    server 127.0.0.1:3002;
    server 127.0.0.1:3003;
}
```

### Least Connections
```nginx
upstream backend {
    least_conn;
    server 127.0.0.1:3001;
    server 127.0.0.1:3002;
    server 127.0.0.1:3003;
}
```

### IP Hash (Session Affinity)
```nginx
upstream backend {
    ip_hash;
    server 127.0.0.1:3001;
    server 127.0.0.1:3002;
    server 127.0.0.1:3003;
}
```

### Weighted Load Balancing
```nginx
upstream backend {
    server 127.0.0.1:3001 weight=3;
    server 127.0.0.1:3002 weight=2;
    server 127.0.0.1:3003 weight=1;
}
```

This Nginx configuration provides a robust, high-performance load balancer and reverse proxy for our mini Facebook backend with proper security, caching, and monitoring features.
