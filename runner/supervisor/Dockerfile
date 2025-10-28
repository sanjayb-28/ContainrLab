FROM python:3.12-slim

ENV PYTHONUNBUFFERED=1
WORKDIR /opt/runnerd

RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates curl \
    && rm -rf /var/lib/apt/lists/*

COPY runner/supervisor/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

COPY runner/supervisor/server.py ./server.py

# Copy labs directory for starter assets
COPY labs /labs

CMD ["uvicorn", "server:app", "--host", "0.0.0.0", "--port", "8080"]
