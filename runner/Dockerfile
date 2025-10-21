FROM docker:26-dind-rootless

RUN apk add --no-cache bash curl jq git tar coreutils nodejs npm python3 py3-pip \
    && pip3 install --no-cache-dir docker

ENV DOCKER_HOST=unix:///home/rootless/.docker/run/docker.sock
WORKDIR /workspace
USER rootless

# dockerd-rootless.sh launches the inner daemon for each learner session.
CMD ["dockerd-rootless.sh"]
