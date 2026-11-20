FROM postgres:17-alpine

RUN apk add --no-cache aws-cli tzdata bash

WORKDIR /backup
COPY backup/backup_to_s3.sh /backup/backup_to_s3.sh
COPY backup/restore_from_s3.sh /backup/restore_from_s3.sh
COPY backup/entrypoint.sh /backup/entrypoint.sh

RUN sed -i 's/\r$//' /backup/*.sh && chmod +x /backup/*.sh

ENTRYPOINT ["/backup/entrypoint.sh"]
