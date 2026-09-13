#!/bin/bash
set -euo pipefail
install -d -m 700 /var/backups/nafes/security
cp -a /etc/ssh/sshd_config /var/backups/nafes/security/sshd_config
cat > /etc/ssh/sshd_config.d/00-nafes-hardening.conf <<'EOF'
# Keep SSH on port 22 and preserve Ubuntu public-key access.
PermitRootLogin no
PubkeyAuthentication yes
PasswordAuthentication no
KbdInteractiveAuthentication no
PermitEmptyPasswords no
MaxAuthTries 3
LoginGraceTime 30
X11Forwarding no
AllowAgentForwarding no
AllowTcpForwarding local
EOF
sshd -t
systemctl reload ssh
chmod 750 /etc/nafes
chown root:nafes /etc/nafes
chmod 700 /var/backups/nafes
# PostgreSQL16 contains only the initial staging database; retain its files offline.
pg_ctlcluster 16 main stop
printf 'manual\n' > /etc/postgresql/16/main/start.conf
apt-get update -qq
DEBIAN_FRONTEND=noninteractive NEEDRESTART_MODE=a apt-get install -y -qq fail2ban unattended-upgrades > /tmp/nafes-hardening-packages.log 2>&1
cat > /etc/fail2ban/jail.d/nafes-sshd.local <<'EOF'
[sshd]
enabled = true
backend = systemd
port = 22
maxretry = 6
findtime = 10m
bantime = 10m
ignoreip = 127.0.0.1/8 ::1
EOF
systemctl enable --now fail2ban
systemctl restart fail2ban
sshd -T | grep -E '^(port|permitrootlogin|passwordauthentication|pubkeyauthentication|x11forwarding) '
