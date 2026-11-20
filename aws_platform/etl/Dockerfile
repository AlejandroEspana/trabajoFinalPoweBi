FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PYSPARK_PYTHON=python3 \
    PYSPARK_DRIVER_PYTHON=python3

RUN apt-get update && apt-get install -y --no-install-recommends \
        openjdk-21-jre-headless \
        postgresql-client \
        procps \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /etl

RUN pip install --no-cache-dir pyspark psycopg2-binary==2.9.10

COPY etl/run_pipeline.sh /etl/run_pipeline.sh
RUN sed -i 's/\r$//' /etl/run_pipeline.sh && chmod +x /etl/run_pipeline.sh

ENTRYPOINT ["/etl/run_pipeline.sh"]
