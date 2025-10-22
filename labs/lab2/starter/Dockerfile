# Deliberately inefficient ordering for learners to improve
FROM python:3.11-slim

WORKDIR /app

# TODO: reorder the COPY / RUN instructions to optimise caching
COPY . .

RUN pip install --no-cache-dir -r requirements.txt

CMD ["python", "app.py"]
