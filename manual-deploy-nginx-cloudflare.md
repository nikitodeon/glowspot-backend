////////////////////////////
nano /etc/nginx/nginx.conf
////////////////////////////////
user www-data;
worker_processes auto;
pid /run/nginx.pid;
include /etc/nginx/modules-enabled/\*.conf;

events {
worker_connections 768; # multi_accept on;
}

http {

        ##
        # Basic Settings
        ##

        sendfile on;
        tcp_nopush on;
        types_hash_max_size 2048;
        # server_tokens off;

        # server_names_hash_bucket_size 64;
        # server_name_in_redirect off;

        include /etc/nginx/mime.types;
        default_type application/octet-stream;

        ##
        # SSL Settings
        ##

        ssl_protocols TLSv1 TLSv1.1 TLSv1.2 TLSv1.3; # Dropping SSLv3, ref: POODLE
        ssl_prefer_server_ciphers on;

        ##
        # Logging Settings
        ##

        access_log /var/log/nginx/access.log;
        error_log /var/log/nginx/error.log;

        ##
        # Gzip Settings
        ##

        gzip on;

        # gzip_vary on;
        # gzip_proxied any;
        # gzip_comp_level 6;
        # gzip_buffers 16 8k;
        # gzip_http_version 1.1;
        # gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript;

        ##
        # Virtual Host Configs
        ##

        include /etc/nginx/conf.d/*.conf;
        include /etc/nginx/sites-enabled/*;

}

#mail {

# # See sample authentication script at:

# # http://wiki.nginx.org/ImapAuthenticateWithApachePhpScript

#

# # auth_http localhost/auth.php;

# # pop3_capabilities "TOP" "USER";

# # imap_capabilities "IMAP4rev1" "UIDPLUS";

#

# server {

# listen localhost:110;

# protocol pop3;

# proxy on;

# }

#

# server {

# listen localhost:143;

# protocol imap;

# proxy on;

# }

#}
/////////////////////////////////////////////////
nano /etc/nginx/sites-available/glowspot.ru
////////////////////////////////////////////////

# HTTP -> HTTPS редирект

server {
listen 80;
listen [::]:80;
server_name glowspot.ru api.glowspot.ru;
return 301 https://$host$request_uri;
}

# Frontend - glowspot.ru

server {
listen 443 ssl http2;
listen [::]:443 ssl http2;
server_name glowspot.ru;

    ssl_certificate /etc/letsencrypt/live/glowspot.ru/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/glowspot.ru/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;

    include /etc/nginx/cloudflare-ips.conf;
    real_ip_header CF-Connecting-IP;
    real_ip_recursive on;

    # Security headers
    add_header Strict-Transport-Security "max-age=63072000; includeSubdomains; preload" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

}

# API - api.glowspot.ru

server {
listen 443 ssl http2;
listen [::]:443 ssl http2;
server_name api.glowspot.ru;

    ssl_certificate /etc/letsencrypt/live/glowspot.ru/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/glowspot.ru/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;

    include /etc/nginx/cloudflare-ips.conf;
    real_ip_header CF-Connecting-IP;
    real_ip_recursive on;

    location / {
        proxy_pass http://localhost:4000;
        proxy_http_version 1.1;

        # Обработка Set-Cookie заголовков
        proxy_pass_header Set-Cookie;
       # proxy_cookie_path / "/; Secure; HttpOnly; SameSite=None";

        # Передача куки от клиента к бэкенду
        #proxy_set_header Cookie $http_cookie;

        # Заголовки проксирования
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

}
////////////////////////////////////
/etc/nginx/cloudflare-ips.conf
//////////////////////////////////

set_real_ip_from 103.21.244.0/22;
set_real_ip_from 103.22.200.0/22;
set_real_ip_from 103.31.4.0/22;
set_real_ip_from 104.16.0.0/12;
set_real_ip_from 108.162.192.0/18;
set_real_ip_from 131.0.72.0/22;
set_real_ip_from 141.101.64.0/18;
set_real_ip_from 162.158.0.0/15;
set_real_ip_from 172.64.0.0/13;
set_real_ip_from 173.245.48.0/20;
set_real_ip_from 188.114.96.0/20;
set_real_ip_from 190.93.240.0/20;
set_real_ip_from 197.234.240.0/22;
set_real_ip_from 198.41.128.0/17;
set_real_ip_from 2400:cb00::/32;
set_real_ip_from 2405:8100::/32;
set_real_ip_from 2405:b500::/32;
set_real_ip_from 2606:4700::/32;
set_real_ip_from 2803:f800::/32;
set_real_ip_from 2a06:98c0::/29;
set_real_ip_from 2c0f:f248::/32;

///////////////////////////////////
/etc/redis/redis.conf
///////////////////////////////
.....
#bind 127.0.0.1 -::1
bind 0.0.0.0 ::1
......

port 6380
......
requirepass pass...

///////////////////////////////////////////
/etc/postgresql/15/main/postgresql.conf
///////////////////////////////////////
.......

# - Connection Settings -

listen_addresses = '_' # what IP address(es) to listen on; # comma-separated list of addresses; # defaults to 'localhost'; use '_' for all # (change requires restart)
port = 5433 # (change requires restart)
max_connections = 100 # (change requires restart)
#superuser_reserved_connections = 3 # (change requires restart)
unix_socket_directories = '/var/run/postgresql' # comma-separated list of directories # (change requires restart)
#unix_socket_group = '' # (change requires restart)
#unix_socket_permissions = 0777 # begin with 0 to use octal notation # (change requires restart)
.......
