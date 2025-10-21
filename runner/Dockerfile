FROM docker:26-dind

RUN apk add --no-cache bash curl jq git tar coreutils nodejs npm python3 py3-pip \
	&& pip3 install --no-cache-dir --break-system-packages docker

ENV DOCKER_HOST=unix:///var/run/docker.sock
RUN mkdir -p /workspace
WORKDIR /workspace

