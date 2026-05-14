FROM docker:26-dind

RUN apk add --no-cache bash curl jq git tar coreutils nodejs npm python3 \
	&& mkdir -p /workspace

ENV DOCKER_HOST=unix:///var/run/docker.sock
WORKDIR /workspace
