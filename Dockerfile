FROM python:3.11-slim

WORKDIR /app

# Install dependencies if needed
COPY . /app

EXPOSE 3000

ENV PORT=3000
ENV PYTHONUNBUFFERED=1

CMD ["python", "production_server.py"]
