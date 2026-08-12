#!/bin/sh
# Fix /data ownership (Docker volume mounts override build-time permissions)
# then drop to nextjs user for the app process
chown -R nextjs:nodejs /data
exec gosu nextjs "$@"
